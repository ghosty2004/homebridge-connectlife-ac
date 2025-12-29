import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export declare class ConnectLifeAcPlatformPlugin implements DynamicPlatformPlugin {
    readonly log: Logging;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory[];
    constructor(log: Logging, config: PlatformConfig, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    initDevices(): void;
}
