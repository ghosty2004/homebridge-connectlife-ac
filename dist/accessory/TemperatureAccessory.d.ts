import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { ConnectLifeAcPlatformPlugin } from '../platform';
export declare class TemperatureAccessory {
    private readonly platform;
    private readonly accessory;
    private debugMode;
    private deviceNickName;
    private connectLifeApi;
    private service;
    private pollingTimer?;
    private cachedState;
    constructor(platform: ConnectLifeAcPlatformPlugin, accessory: PlatformAccessory);
    private startPolling;
    private refreshState;
    private fetchDeviceState;
    private mapWorkModeToCurrentState;
    private mapWorkModeToTargetState;
    private mapTargetStateToWorkMode;
    setActive(value: CharacteristicValue): Promise<void>;
    getActive(): Promise<CharacteristicValue>;
    getCurrentHeaterCoolerState(): Promise<CharacteristicValue>;
    setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void>;
    getTargetHeaterCoolerState(): Promise<CharacteristicValue>;
    /**
     * Get the current ambient/room temperature.
     * CRITICAL FIX: Uses f_temp_in (indoor temperature sensor) instead of t_temp (target temperature)
     */
    getCurrentTemperature(): Promise<CharacteristicValue>;
    setSwingMode(value: CharacteristicValue): Promise<void>;
    getSwingMode(): Promise<CharacteristicValue>;
    setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void>;
    /**
     * Get the cooling threshold temperature.
     * CRITICAL FIX: Always returns the target temperature (t_temp), properly converted.
     * No longer returns arbitrary defaults when not in cooling mode.
     */
    getCoolingThresholdTemperature(): Promise<CharacteristicValue>;
    setHeatingThresholdTemperature(value: CharacteristicValue): Promise<void>;
    /**
     * Get the heating threshold temperature.
     * CRITICAL FIX: Always returns the target temperature (t_temp), properly converted.
     * No longer returns arbitrary defaults when not in heating mode.
     */
    getHeatingThresholdTemperature(): Promise<CharacteristicValue>;
    setTemperatureDisplayUnits(value: CharacteristicValue): Promise<void>;
    getTemperatureDisplayUnits(): Promise<CharacteristicValue>;
}
