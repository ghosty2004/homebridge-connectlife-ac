"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectLifeAcPlatformPlugin = void 0;
const settings_1 = require("./settings");
const accessory_1 = require("./accessory");
const utils_1 = require("./utils");
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
class ConnectLifeAcPlatformPlugin {
    log;
    config;
    api;
    Service;
    Characteristic;
    // this is used to track restored cached accessories
    accessories = [];
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
        this.api.on('didFinishLaunching', () => {
            this.initDevices();
        });
    }
    configureAccessory(accessory) {
        this.accessories.push(accessory);
    }
    initDevices() {
        const devices = (this.config?.deviceNickNames || []).map((deviceNickName) => ({
            uniqueId: deviceNickName.replace(/\s+/g, ''),
            displayName: (0, utils_1.capitalizeFirstWord)(deviceNickName),
            accessory: accessory_1.TemperatureAccessory,
        }));
        for (const device of devices) {
            const uuid = this.api.hap.uuid.generate(device.uniqueId);
            const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
            if (existingAccessory) {
                this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
                new device.accessory(this, existingAccessory);
            }
            else {
                this.log.info('Adding new accessory:', device.displayName);
                const accessory = new this.api.platformAccessory(device.displayName, uuid);
                // eslint-disable-next-line
                const { accessory: _, ...ctx } = device;
                accessory.context.device = ctx;
                new device.accessory(this, accessory);
                this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                    accessory,
                ]);
            }
        }
    }
}
exports.ConnectLifeAcPlatformPlugin = ConnectLifeAcPlatformPlugin;
//# sourceMappingURL=platform.js.map