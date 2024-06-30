import axios from 'axios';
import NodeCache from 'node-cache';
import { Appliance } from '../interfaces';
import { CharacteristicValue } from 'homebridge';

axios.defaults.headers['User-Agent'] = 'connectlife-api-connector 2.1.11';

const cache = new NodeCache();

export class ConnectLifeApi {
  constructor(
    private readonly loginID: string,
    private readonly password: string,
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

  async getDeviceIdByNickName(deviceNickName: string) {
    const deviceIdCache = cache.get<string>(`device_id_${deviceNickName}`);

    if (deviceIdCache) {
      return deviceIdCache;
    }

    const deviceId = axios
      .get<Appliance[]>('https://connectlife.bapi.ovh/appliances', {
        headers: {
          'X-Token': await this.getAccessToken(),
        },
      })
      .then(
        ({ data }) =>
          data.find(
            ({ deviceNickName: nickname }) =>
              nickname?.toLocaleLowerCase() === deviceNickName.toLowerCase(),
          )?.puid,
      );

    cache.set(`device_id_${deviceNickName}`, deviceId);

    return deviceId;
  }

  async changeDeviceProperties<T extends keyof Appliance['statusList']>(
    deviceNickname: string,
    properties: Record<T, CharacteristicValue>,
  ) {
    axios.post(
      'https://connectlife.bapi.ovh/appliances',
      {
        puid: await this.getDeviceIdByNickName(deviceNickname),
        properties,
      },
      {
        headers: {
          'X-Token': await this.getAccessToken(),
        },
      },
    );
  }

  async getDeviceProperties<T extends Record<string, 'integer' | 'string'>>(
    deviceNickname: string,
    properties: T,
  ) {
    return axios
      .get<Appliance[]>('https://connectlife.bapi.ovh/appliances', {
        headers: {
          'X-Token': await this.getAccessToken(),
        },
      })
      .then(
        ({ data }) =>
          Object.entries(
            data?.find?.(
              async ({ puid }) =>
                puid === (await this.getDeviceIdByNickName(deviceNickname)),
            )?.statusList || {},
          ).reduce((acc, [key, value]: [string, unknown]) => {
            const format = properties[key];
            if (!format) {
              return acc;
            }
            acc[key] =
              format === 'integer' ? parseInt(value as string) : `${value}`;
            return acc;
            // eslint-disable-next-line
          }, {} as Record<string, any>) as Promise<
            Record<keyof T, T[keyof T] extends 'integer' ? number : string>
          >,
      )
      .catch(() => ({
        // fallback to some defaults values in case of any error
        ...Object.fromEntries(
          Object.entries(properties).map(([key, type]) => [
            key,
            type === 'integer' ? 0 : '',
          ]),
        ),
      }));
  }
}
