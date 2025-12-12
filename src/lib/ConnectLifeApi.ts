import axios from 'axios';
import NodeCache from 'node-cache';
import { Appliance } from '../interfaces';
import { CharacteristicValue } from 'homebridge';
import { ConnectLifeAcPlatformPlugin } from '../platform';

axios.defaults.headers['User-Agent'] = 'connectlife-api-connector 2.1.11';

const cache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 120,
});

type DevicePropertyResult<T> = {
    [K in keyof T]: T[K] extends 'integer' ? number : string;
};

export class ConnectLifeApi {
  private accessTokenPromise?: Promise<string>;

  constructor(
        private readonly loginID: string,
        private readonly password: string,
        private readonly options: {
            debugMode?: boolean;
            log?: ConnectLifeAcPlatformPlugin['log'];
        } = {},
  ) {}

  async getAccessToken(): Promise<string> {
    const cached = cache.get<string>('access_token');
    if (cached) {
      return cached;
    }

    if (!this.accessTokenPromise) {
      this.accessTokenPromise = this.loginFlow();
    }

    return this.accessTokenPromise;
  }

  private async loginFlow(): Promise<string> {
    try {
      const apiKey = '4_yhTWQmHFpZkQZDSV1uV-_A';
      const gmid =
                'gmid.ver4.AtLt3mZAMA.C8m5VqSTEQDrTRrkYYDgOaJWcyQ-XHow5nzQSXJF3EO3TnqTJ8tKUmQaaQ6z8p0s.zcTbHe6Ax6lHfvTN7JUj7VgO4x8Vl-vk1u0kZcrkKmKWw8K9r0shyut_at5Q0ri6zTewnAv2g1Dc8dauuyd-Sw.sc3';
      const clientId = '5065059336212';

      const loginParams = new URLSearchParams();
      loginParams.append('loginID', this.loginID);
      loginParams.append('password', this.password);
      loginParams.append('APIKey', apiKey);

      const loginResponse = (
        await axios.post(
          'https://accounts.eu1.gigya.com/accounts.login',
          loginParams,
        )
      ).data;

      const sessionToken = loginResponse.sessionInfo?.cookieValue;
      if (!sessionToken) {
        throw new Error(`Login failed: ${JSON.stringify(loginResponse)}`);
      }

      const jwtParams = new URLSearchParams();
      jwtParams.append('APIKey', apiKey);
      jwtParams.append('gmid', gmid);
      jwtParams.append('login_token', sessionToken);

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
          thirdClientId: loginResponse.UID,
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

      cache.set('access_token', tokenResponse.access_token);
      this.accessTokenPromise = undefined;

      return tokenResponse.access_token;
    } catch (err) {
      this.accessTokenPromise = undefined;
      this.options.log?.error('ConnectLife login failed', err);
      throw err;
    }
  }

  async getDeviceIdByNickName(deviceNickName: string): Promise<string> {
    const key = `device_id_${deviceNickName}`;
    const cached = cache.get<string>(key);
    if (cached) {
      return cached;
    }

    const { data } = await axios.get<Appliance[]>(
      'https://connectlife.bapi.ovh/appliances',
      { headers: { 'X-Token': await this.getAccessToken() } },
    );

    const deviceId = data.find(
      d => d.deviceNickName?.toLowerCase() === deviceNickName.toLowerCase(),
    )?.puid;

    if (!deviceId) {
      throw new Error(`Device not found: ${deviceNickName}`);
    }

    cache.set(key, deviceId);
    return deviceId;
  }

  async changeDeviceProperties<T extends keyof Appliance['statusList']>(
    deviceNickname: string,
    properties: Record<T, CharacteristicValue>,
  ): Promise<void> {
    try {
      await axios.post(
        'https://connectlife.bapi.ovh/appliances',
        {
          puid: await this.getDeviceIdByNickName(deviceNickname),
          properties,
        },
        { headers: { 'X-Token': await this.getAccessToken() } },
      );

      if (this.options.debugMode) {
        this.options.log?.info('changeDeviceProperties', properties);
      }
    } catch (err) {
      this.options.log?.error('changeDeviceProperties failed', err);
      throw err;
    }
  }

  async getDeviceProperties<T extends Record<string, 'integer' | 'string'>>(
    deviceNickname: string,
    properties: T,
  ): Promise<DevicePropertyResult<T>> {
    try {
      const token = await this.getAccessToken();
      const deviceId = await this.getDeviceIdByNickName(deviceNickname);

      const { data } = await axios.get<Appliance[]>(
        'https://connectlife.bapi.ovh/appliances',
        { headers: { 'X-Token': token } },
      );

      const device = data.find(d => d.puid === deviceId);
      const statusList = device?.statusList ?? {};

      const result = {} as DevicePropertyResult<T>;

      for (const [key, type] of Object.entries(properties)) {
        const raw = statusList[key as keyof typeof statusList];
        if (raw === undefined) {
          continue;
        }

        (result as Record<string, number | string>)[key] =
                    type === 'integer' ? parseInt(String(raw), 10) : String(raw);
      }

      return result;
    } catch {
      const fallback = {} as DevicePropertyResult<T>;
      for (const [key, type] of Object.entries(properties)) {
        (fallback as Record<string, number | string>)[key] =
                    type === 'integer' ? 0 : '';
      }
      return fallback;
    }
  }
}
