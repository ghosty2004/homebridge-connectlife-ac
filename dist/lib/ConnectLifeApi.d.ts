import { Appliance } from '../interfaces';
import { CharacteristicValue, Logging } from 'homebridge';
export declare class ConnectLifeApi {
    private readonly loginID;
    private readonly password;
    private readonly options;
    private applianceCache;
    private applianceCacheTime;
    private readonly APPLIANCE_CACHE_TTL_MS;
    constructor(loginID: string, password: string, options?: {
        debugMode?: boolean;
        log?: Logging;
    });
    getAccessToken(): Promise<any>;
    getDeviceIdByNickName(deviceNickName: string): Promise<string | undefined>;
    /**
     * Fetch all appliances with caching and rate limiting
     */
    private getAppliances;
    changeDeviceProperties<T extends keyof Appliance['statusList']>(deviceNickname: string, properties: Record<T, CharacteristicValue>): Promise<void>;
    getDeviceProperties<T extends Record<string, 'integer' | 'string'>>(deviceNickname: string, properties: T): Promise<Record<string, number | string>>;
    private getDefaultProperties;
}
