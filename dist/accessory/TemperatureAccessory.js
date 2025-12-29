"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemperatureAccessory = void 0;
const lib_1 = require("../lib");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
// Temperature limits for HomeKit HeaterCooler
const MIN_TEMP = 10;
const MAX_TEMP = 35;
// Polling interval for state updates (ms)
const POLLING_INTERVAL = 60000; // 1 minute
class TemperatureAccessory {
    platform;
    accessory;
    debugMode;
    deviceNickName;
    connectLifeApi;
    service;
    pollingTimer;
    // Cache the last known state to prevent UI flickering
    cachedState = {
        t_power: 0,
        t_temp: 22,
        t_temp_type: 0,
        t_work_mode: constants_1.WorkModes.Cool,
        t_up_down: 0,
        f_temp_in: 22,
    };
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        const { loginID, password } = platform.config;
        const deviceNickName = accessory.context.device?.displayName?.toLowerCase();
        if (!deviceNickName || !loginID || !password) {
            throw new Error('Missing required config');
        }
        this.debugMode = !!platform.config?.debugMode;
        this.deviceNickName = deviceNickName;
        this.connectLifeApi = new lib_1.ConnectLifeApi(loginID, password, {
            debugMode: this.debugMode,
            log: platform.log,
        });
        // Set accessory information
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Hisense/ConnectLife')
            .setCharacteristic(this.platform.Characteristic.Model, 'Air Conditioner')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.UUID.substring(0, 8));
        // Get or create HeaterCooler service
        this.service =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
                this.accessory.addService(this.platform.Service.HeaterCooler);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        // Configure temperature characteristics with proper ranges
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .setProps({ minValue: -40, maxValue: 100, minStep: 0.1 });
        this.service
            .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .setProps({ minValue: MIN_TEMP, maxValue: MAX_TEMP, minStep: 1 });
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .setProps({ minValue: MIN_TEMP, maxValue: MAX_TEMP, minStep: 1 });
        // Register handlers
        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.setActive.bind(this))
            .onGet(this.getActive.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .onGet(this.getCurrentHeaterCoolerState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onSet(this.setTargetHeaterCoolerState.bind(this))
            .onGet(this.getTargetHeaterCoolerState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.SwingMode)
            .onSet(this.setSwingMode.bind(this))
            .onGet(this.getSwingMode.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .onSet(this.setCoolingThresholdTemperature.bind(this))
            .onGet(this.getCoolingThresholdTemperature.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .onSet(this.setHeatingThresholdTemperature.bind(this))
            .onGet(this.getHeatingThresholdTemperature.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
            .onSet(this.setTemperatureDisplayUnits.bind(this))
            .onGet(this.getTemperatureDisplayUnits.bind(this));
        // Start polling for state updates
        this.startPolling();
        // Initial state fetch
        this.refreshState().catch((error) => {
            this.platform.log.error('Initial state fetch failed:', error.message);
        });
    }
    startPolling() {
        this.pollingTimer = setInterval(() => {
            this.refreshState().catch((error) => {
                this.platform.log.error('Polling failed:', error.message);
            });
        }, POLLING_INTERVAL);
    }
    async refreshState() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        // Update HomeKit characteristics with fresh data
        const tempInCelsius = state.t_temp_type === 1
            ? (0, utils_1.fahrenheitToCelsius)(state.f_temp_in)
            : state.f_temp_in;
        const targetTempCelsius = state.t_temp_type === 1
            ? (0, utils_1.fahrenheitToCelsius)(state.t_temp)
            : state.t_temp;
        // Clamp target temperature to valid range
        const clampedTargetTemp = Math.max(MIN_TEMP, Math.min(MAX_TEMP, targetTempCelsius));
        this.service.updateCharacteristic(this.platform.Characteristic.Active, state.t_power);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, tempInCelsius);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.mapWorkModeToCurrentState(state.t_work_mode, state.t_power));
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.mapWorkModeToTargetState(state.t_work_mode));
        // Update threshold temperatures based on current mode
        this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, clampedTargetTemp);
        this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, clampedTargetTemp);
        this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, state.t_up_down);
        this.service.updateCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits, state.t_temp_type);
        if (this.debugMode) {
            this.platform.log.debug('State refreshed:', {
                power: state.t_power,
                mode: state.t_work_mode,
                targetTemp: state.t_temp,
                indoorTemp: state.f_temp_in,
                tempType: state.t_temp_type === 0 ? 'Celsius' : 'Fahrenheit',
            });
        }
    }
    async fetchDeviceState() {
        const result = await this.connectLifeApi.getDeviceProperties(this.deviceNickName, {
            t_power: 'integer',
            t_temp: 'integer',
            t_temp_type: 'integer',
            t_work_mode: 'integer',
            t_up_down: 'integer',
            f_temp_in: 'integer',
        });
        // Use cached state for temperature values when API returns invalid defaults (0)
        // Temperature values of 0 are invalid for AC operation (valid range: 10-35)
        const tTemp = result.t_temp;
        const fTempIn = result.f_temp_in;
        return {
            t_power: result.t_power ?? this.cachedState.t_power,
            t_temp: (tTemp && tTemp >= MIN_TEMP) ? tTemp : this.cachedState.t_temp,
            t_temp_type: result.t_temp_type ?? this.cachedState.t_temp_type,
            t_work_mode: result.t_work_mode ?? this.cachedState.t_work_mode,
            t_up_down: result.t_up_down ?? this.cachedState.t_up_down,
            f_temp_in: fTempIn > 0 ? fTempIn : this.cachedState.f_temp_in,
        };
    }
    // Map ConnectLife work modes to HomeKit CurrentHeaterCoolerState
    mapWorkModeToCurrentState(workMode, power) {
        const { CurrentHeaterCoolerState } = this.platform.Characteristic;
        if (power === 0) {
            return CurrentHeaterCoolerState.INACTIVE;
        }
        switch (workMode) {
            case constants_1.WorkModes.Heat:
                return CurrentHeaterCoolerState.HEATING;
            case constants_1.WorkModes.Cool:
            case constants_1.WorkModes.Dry:
                return CurrentHeaterCoolerState.COOLING;
            case constants_1.WorkModes.FanOnly:
            case constants_1.WorkModes.Auto:
            default:
                return CurrentHeaterCoolerState.IDLE;
        }
    }
    // Map ConnectLife work modes to HomeKit TargetHeaterCoolerState
    mapWorkModeToTargetState(workMode) {
        const { TargetHeaterCoolerState } = this.platform.Characteristic;
        switch (workMode) {
            case constants_1.WorkModes.Heat:
                return TargetHeaterCoolerState.HEAT;
            case constants_1.WorkModes.Cool:
            case constants_1.WorkModes.Dry:
                return TargetHeaterCoolerState.COOL;
            case constants_1.WorkModes.Auto:
            case constants_1.WorkModes.FanOnly:
            default:
                return TargetHeaterCoolerState.AUTO;
        }
    }
    // Map HomeKit TargetHeaterCoolerState to ConnectLife work mode
    mapTargetStateToWorkMode(targetState) {
        const { TargetHeaterCoolerState } = this.platform.Characteristic;
        switch (targetState) {
            case TargetHeaterCoolerState.HEAT:
                return constants_1.WorkModes.Heat;
            case TargetHeaterCoolerState.COOL:
                return constants_1.WorkModes.Cool;
            case TargetHeaterCoolerState.AUTO:
            default:
                return constants_1.WorkModes.Auto;
        }
    }
    async setActive(value) {
        if (this.cachedState.t_power === value) {
            return;
        }
        await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
            t_power: value,
        });
        this.cachedState.t_power = value;
        if (this.debugMode) {
            this.platform.log.info('Set Active:', value);
        }
    }
    async getActive() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        return state.t_power;
    }
    async getCurrentHeaterCoolerState() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        return this.mapWorkModeToCurrentState(state.t_work_mode, state.t_power);
    }
    async setTargetHeaterCoolerState(value) {
        const workMode = this.mapTargetStateToWorkMode(value);
        await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
            t_work_mode: workMode,
        });
        this.cachedState.t_work_mode = workMode;
        if (this.debugMode) {
            this.platform.log.info('Set TargetHeaterCoolerState:', value, '-> WorkMode:', workMode);
        }
    }
    async getTargetHeaterCoolerState() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        return this.mapWorkModeToTargetState(state.t_work_mode);
    }
    /**
     * Get the current ambient/room temperature.
     * CRITICAL FIX: Uses f_temp_in (indoor temperature sensor) instead of t_temp (target temperature)
     */
    async getCurrentTemperature() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        // f_temp_in is the indoor temperature sensor reading
        const tempInCelsius = state.t_temp_type === 1
            ? (0, utils_1.fahrenheitToCelsius)(state.f_temp_in)
            : state.f_temp_in;
        if (this.debugMode) {
            this.platform.log.debug('getCurrentTemperature: f_temp_in =', state.f_temp_in, '-> Celsius =', tempInCelsius);
        }
        return tempInCelsius;
    }
    async setSwingMode(value) {
        await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
            t_up_down: value,
        });
        this.cachedState.t_up_down = value;
        if (this.debugMode) {
            this.platform.log.info('Set SwingMode:', value);
        }
    }
    async getSwingMode() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        return state.t_up_down;
    }
    async setCoolingThresholdTemperature(value) {
        const tempCelsius = value;
        // Convert to device units if needed
        const deviceTemp = this.cachedState.t_temp_type === 1
            ? Math.round((0, utils_1.celsiusToFahrenheit)(tempCelsius))
            : tempCelsius;
        await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
            t_temp: deviceTemp,
            t_work_mode: constants_1.WorkModes.Cool,
        });
        this.cachedState.t_temp = deviceTemp;
        this.cachedState.t_work_mode = constants_1.WorkModes.Cool;
        if (this.debugMode) {
            this.platform.log.info('Set CoolingThresholdTemperature:', tempCelsius, '-> Device:', deviceTemp);
        }
    }
    /**
     * Get the cooling threshold temperature.
     * CRITICAL FIX: Always returns the target temperature (t_temp), properly converted.
     * No longer returns arbitrary defaults when not in cooling mode.
     */
    async getCoolingThresholdTemperature() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        const tempCelsius = state.t_temp_type === 1
            ? (0, utils_1.fahrenheitToCelsius)(state.t_temp)
            : state.t_temp;
        // Clamp to valid HomeKit range
        return Math.max(MIN_TEMP, Math.min(MAX_TEMP, tempCelsius));
    }
    async setHeatingThresholdTemperature(value) {
        const tempCelsius = value;
        // Convert to device units if needed
        const deviceTemp = this.cachedState.t_temp_type === 1
            ? Math.round((0, utils_1.celsiusToFahrenheit)(tempCelsius))
            : tempCelsius;
        await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
            t_temp: deviceTemp,
            t_work_mode: constants_1.WorkModes.Heat,
        });
        this.cachedState.t_temp = deviceTemp;
        this.cachedState.t_work_mode = constants_1.WorkModes.Heat;
        if (this.debugMode) {
            this.platform.log.info('Set HeatingThresholdTemperature:', tempCelsius, '-> Device:', deviceTemp);
        }
    }
    /**
     * Get the heating threshold temperature.
     * CRITICAL FIX: Always returns the target temperature (t_temp), properly converted.
     * No longer returns arbitrary defaults when not in heating mode.
     */
    async getHeatingThresholdTemperature() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        const tempCelsius = state.t_temp_type === 1
            ? (0, utils_1.fahrenheitToCelsius)(state.t_temp)
            : state.t_temp;
        // Clamp to valid HomeKit range
        return Math.max(MIN_TEMP, Math.min(MAX_TEMP, tempCelsius));
    }
    async setTemperatureDisplayUnits(value) {
        await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
            t_temp_type: value,
        });
        this.cachedState.t_temp_type = value;
        if (this.debugMode) {
            this.platform.log.info('Set TemperatureDisplayUnits:', value === 0 ? 'Celsius' : 'Fahrenheit');
        }
    }
    async getTemperatureDisplayUnits() {
        const state = await this.fetchDeviceState();
        this.cachedState = state;
        return state.t_temp_type;
    }
}
exports.TemperatureAccessory = TemperatureAccessory;
//# sourceMappingURL=TemperatureAccessory.js.map