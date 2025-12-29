import axios, { AxiosError } from 'axios';
import NodeCache from 'node-cache';
import { Appliance } from '../interfaces';
import { CharacteristicValue, Logging } from 'homebridge';

axios.defaults.headers['User-Agent'] = 'connectlife-api-connector 2.1.11';

// Cache with reasonable TTLs
const cache = new NodeCache();

// Rate limiting: track last API call time
let lastApiCallTime = 0;
const MIN_API_INTERVAL_MS = 1000; // Minimum 1 second between API calls

export class ConnectLifeApi {
  private applianceCache: Appliance[] | null = null;
  private applianceCacheTime = 0;
  private readonly APPLIANCE_CACHE_TTL_MS = 30000; // 30 seconds

  constructor(
    private readonly loginID: string,
    private readonly password: string,
    private readonly options: {
      debugMode?: boolean;
      log?: Logging;
    } = {},
  ) {}

  async getAccessToken() {
    const cachedToken = cache.get<string>('access_token');

    if (cachedToken) {
      return cachedToken;
    }

    // no wonder, this is always the same (tested with multiple accounts - reverse engine with mitmproxy)
    const apiKey = '4_yhTWQmHFpZkQZDSV1uV-_A';
    const gmid =
      // eslint-disable-next-line
      'gmid.ver4.AtLt3mZAMA.C8m5VqSTEQDrTRrkYYDgOaJWcyQ-XHow5nzQSXJF3EO3TnqTJ8tKUmQaaQ6z8p0s.zcTbHe6Ax6lHfvTN7JUj7VgO4x8Vl-vk1u0kZcrkKmKWw8K9r0shyut_at5Q0ri6zTewnAv2g1Dc8dauuyd-Sw.sc3';
    const clientId = '5065059336212';

    const loginParams = new URLSearchParams();
    loginParams.append('loginID', this.loginID);
    loginParams.append('password', this.password);
    loginParams.append('APIKey', apiKey);
    loginParams.append('gmid', gmid);
    const loginResponse = (
      await axios.post(
        'https://accounts.eu1.gigya.com/accounts.login',
        loginParams,
      )
    ).data;

    const token = loginResponse.sessionInfo.cookieValue ?? null;

    if (!token) {
      throw new Error('Login failed');
    }

    const uid = loginResponse.UID;

    const jwtParams = new URLSearchParams();
    jwtParams.append('APIKey', apiKey);
    jwtParams.append('gmid', gmid);
    jwtParams.append('login_token', token);
    const jwtResponse = (
      await axios.post(
        'https://accounts.eu1.gigya.com/accounts.getJWT',
        jwtParams,
      )
    ).data;

    const authorizeResponse = (
      await axios.post('https://oauth.hijuconn.com/oauth/authorize', {
        client_id: clientId,
        idToken: jwtResponse.id_token,
        response_type: 'code',
        redirect_uri: 'https://api.connectlife.io/swagger/oauth2-redirect.html',
        thirdType: 'CDC',
        thirdClientId: uid,
      })
    ).data;

    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', clientId);
    tokenParams.append('code', authorizeResponse.code);
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append(
      'client_secret',
      '07swfKgvJhC3ydOUS9YV_SwVz0i4LKqlOLGNUukYHVMsJRF1b-iWeUGcNlXyYCeK',
    );
    tokenParams.append(
      'redirect_uri',
      'https://api.connectlife.io/swagger/oauth2-redirect.html',
    );
    const tokenResponse = (
      await axios.post('https://oauth.hijuconn.com/oauth/token', tokenParams)
    ).data;

    cache.set('access_token', tokenResponse.access_token, 60 * 60);

    return tokenResponse.access_token;
  }

  async getDeviceIdByNickName(deviceNickName: string): Promise<string | undefined> {
    const cacheKey = `device_id_${deviceNickName.toLowerCase()}`;
    const deviceIdCache = cache.get<string>(cacheKey);

    if (deviceIdCache) {
      return deviceIdCache;
    }

    const appliances = await this.getAppliances();
    const appliance = appliances.find(
      ({ deviceNickName: nickname }) =>
        nickname?.toLowerCase() === deviceNickName.toLowerCase(),
    );

    if (appliance?.puid) {
      // Cache device ID for 1 hour (devices don't change often)
      cache.set(cacheKey, appliance.puid, 60 * 60);
    }

    return appliance?.puid;
  }

  /**
   * Fetch all appliances with caching and rate limiting
   */
  private async getAppliances(): Promise<Appliance[]> {
    const now = Date.now();

    // Return cached data if still valid
    if (this.applianceCache && now - this.applianceCacheTime < this.APPLIANCE_CACHE_TTL_MS) {
      return this.applianceCache;
    }

    // Rate limiting
    const timeSinceLastCall = now - lastApiCallTime;
    if (timeSinceLastCall < MIN_API_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL_MS - timeSinceLastCall));
    }

    try {
      lastApiCallTime = Date.now();
      const response = await axios.get<Appliance[]>('https://connectlife.bapi.ovh/appliances', {
        headers: {
          'X-Token': await this.getAccessToken(),
        },
      });

      this.applianceCache = response.data;
      this.applianceCacheTime = Date.now();

      if (this.options.debugMode) {
        this.options.log?.debug('Fetched appliances:', JSON.stringify(response.data, null, 2));
      }

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 429) {
        this.options.log?.warn('Rate limited by ConnectLife API, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.getAppliances();
      }

      if (axiosError.response?.status === 401) {
        // Token expired, clear cache and retry
        cache.del('access_token');
        return this.getAppliances();
      }

      this.options.log?.error('Failed to fetch appliances:', axiosError.message);

      // Return cached data if available, even if stale
      if (this.applianceCache) {
        this.options.log?.warn('Returning stale cache due to API error');
        return this.applianceCache;
      }

      return [];
    }
  }

  async changeDeviceProperties<T extends keyof Appliance['statusList']>(
    deviceNickname: string,
    properties: Record<T, CharacteristicValue>,
  ): Promise<void> {
    const puid = await this.getDeviceIdByNickName(deviceNickname);
    if (!puid) {
      this.options.log?.error(`Device not found: ${deviceNickname}`);
      return;
    }

    try {
      await axios.post(
        'https://connectlife.bapi.ovh/appliances',
        { puid, properties },
        {
          headers: {
            'X-Token': await this.getAccessToken(),
          },
        },
      );

      // Invalidate cache so next read gets fresh data
      this.applianceCacheTime = 0;

      if (this.options.debugMode) {
        this.options.log?.debug('Changed device properties:', { puid, properties });
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      this.options.log?.error('Failed to change device properties:', axiosError.message);
      throw error;
    }
  }

  async getDeviceProperties<T extends Record<string, 'integer' | 'string'>>(
    deviceNickname: string,
    properties: T,
  ): Promise<Record<string, number | string>> {
    try {
      const appliances = await this.getAppliances();
      const deviceId = await this.getDeviceIdByNickName(deviceNickname);

      const appliance = appliances.find(({ puid }) => puid === deviceId);

      if (!appliance) {
        this.options.log?.warn(`Device not found: ${deviceNickname}`);
        return this.getDefaultProperties(properties);
      }

      const result: Record<string, number | string> = {};

      for (const [key, format] of Object.entries(properties)) {
        const value = (appliance.statusList as Record<string, unknown>)?.[key];
        if (value !== undefined) {
          result[key] = format === 'integer' ? parseInt(String(value), 10) : String(value);
        } else {
          result[key] = format === 'integer' ? 0 : '';
        }
      }

      if (this.options.debugMode) {
        this.options.log?.debug('getDeviceProperties:', result);
      }

      return result;
    } catch (error) {
      this.options.log?.error('Error getting device properties:', (error as Error).message);
      return this.getDefaultProperties(properties);
    }
  }

  private getDefaultProperties<T extends Record<string, 'integer' | 'string'>>(
    properties: T,
  ): Record<string, number | string> {
    const result: Record<string, number | string> = {};
    for (const [key, type] of Object.entries(properties)) {
      result[key] = type === 'integer' ? 0 : '';
    }
    return result;
  }
}
