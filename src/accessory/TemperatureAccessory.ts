import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import {ConnectLifeAcPlatformPlugin} from '../platform';
import {ConnectLifeApi} from '../lib';
import {WorkModes} from '../constants';
import {celsiusToFahrenheit, fahrenheitToCelsius} from '../utils';

export class TemperatureAccessory {
  private readonly debugMode: boolean;
  private readonly deviceNickName: string;
  private connectLifeApi: ConnectLifeApi;
  private service: Service;

  private state = {
    active: 0,
    currentTemp: 0,
    targetTemp: 22,
    swing: 0,
    tempUnit: 0,
    workMode: WorkModes.Auto,
  };

  constructor(
        private readonly platform: ConnectLifeAcPlatformPlugin,
        private readonly accessory: PlatformAccessory,
  ) {
    const {loginID, password} = platform.config;
    const deviceNickName = accessory.context.device?.displayName?.toLowerCase();

    if (!deviceNickName || !loginID || !password) {
      throw new Error('Missing required config');
    }

    this.debugMode = !!platform.config?.debugMode;
    this.deviceNickName = deviceNickName;

    this.connectLifeApi = new ConnectLifeApi(loginID, password, {
      debugMode: this.debugMode,
      log: platform.log,
    });

        this.accessory
          .getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Manufacturer, 'ConnectLife')
          .setCharacteristic(this.platform.Characteristic.Model, 'Air Conditioner')
          .setCharacteristic(this.platform.Characteristic.SerialNumber, 'N/A');

        this.service =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
            this.accessory.addService(this.platform.Service.HeaterCooler);

        this.service.setCharacteristic(
          this.platform.Characteristic.Name,
          accessory.context.device.displayName,
        );

        this.service
          .getCharacteristic(this.platform.Characteristic.Active)
          .onSet(this.setActive.bind(this))
          .onGet(this.getActive.bind(this));

        this.service
          .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
          .onGet(this.getCurrentTemperature.bind(this));

        this.service
          .getCharacteristic(this.platform.Characteristic.SwingMode)
          .onSet(this.setSwingMode.bind(this))
          .onGet(this.getSwingMode.bind(this));

        this.service
          .getCharacteristic(
            this.platform.Characteristic.CoolingThresholdTemperature,
          )
          .onSet(this.setCoolingThresholdTemperature.bind(this))
          .onGet(this.getCoolingThresholdTemperature.bind(this));

        this.service
          .getCharacteristic(
            this.platform.Characteristic.HeatingThresholdTemperature,
          )
          .onSet(this.setHeatingThresholdTemperature.bind(this))
          .onGet(this.getHeatingThresholdTemperature.bind(this));

        this.service
          .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
          .onSet(this.setTemperatureDisplayUnits.bind(this))
          .onGet(this.getTemperatureDisplayUnits.bind(this));

        this.startPolling();
  }

  private startPolling() {
    const POLL_INTERVAL = 15000; // 15s (seguro para la API)

    setInterval(async () => {
      try {
        const data = await this.connectLifeApi.getDeviceProperties(
          this.deviceNickName,
          {
            t_power: 'integer',
            t_temp: 'integer',
            t_temp_type: 'integer',
            t_up_down: 'integer',
            t_work_mode: 'integer',
            f_temp_in: 'integer',
          },
        );

        const {
          t_power,
          t_temp,
          t_temp_type,
          t_up_down,
          t_work_mode,
          f_temp_in,
        } = data as {
                    t_power: number;
                    t_temp: number;
                    t_temp_type: number;
                    t_up_down: number;
                    t_work_mode: number;
                    f_temp_in: number;
                };

        this.state.active = t_power;
        this.state.targetTemp = t_temp;
        this.state.tempUnit = t_temp_type;
        this.state.swing = t_up_down;
        this.state.workMode = t_work_mode;

        this.state.currentTemp =
                    t_temp_type === 1
                      ? fahrenheitToCelsius(f_temp_in)
                      : f_temp_in;

        this.service.updateCharacteristic(
          this.platform.Characteristic.Active,
          this.state.active ? 1 : 0,
        );

        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.state.currentTemp,
        );
      } catch (err) {
        this.platform.log.warn(
          `[${this.deviceNickName}] Polling failed`,
          err,
        );
      }
    }, POLL_INTERVAL);
  }

  getActive(): CharacteristicValue {
    return this.state.active ? 1 : 0;
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.state.currentTemp;
  }

  getSwingMode(): CharacteristicValue {
    return this.state.swing;
  }

  getCoolingThresholdTemperature(): CharacteristicValue {
    if (this.state.workMode !== WorkModes.Cool) {
      return 10;
    }
    return this.state.targetTemp;
  }

  getHeatingThresholdTemperature(): CharacteristicValue {
    if (this.state.workMode !== WorkModes.Heat) {
      return 0;
    }
    return this.state.targetTemp;
  }

  getTemperatureDisplayUnits(): CharacteristicValue {
    return this.state.tempUnit;
  }

  async setActive(value: CharacteristicValue) {
    const newValue = value ? 1 : 0;

    if (this.state.active === newValue) {
      return;
    }

    this.state.active = newValue;

    await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_power: newValue.toString(),
    });

    if (this.debugMode) {
      this.platform.log.info('Set Active', newValue);
    }
  }

  async setSwingMode(value: CharacteristicValue) {
    this.state.swing = value as number;

    await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_up_down: value.toString(),
    });

    if (this.debugMode) {
      this.platform.log.info('Set SwingMode', value);
    }
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    const temp = value as number;
    this.state.targetTemp = temp;
    this.state.workMode = WorkModes.Cool;

    await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_temp:
                this.state.tempUnit === 1
                  ? celsiusToFahrenheit(temp).toString()
                  : temp.toString(),
      t_work_mode: WorkModes.Cool.toString(),
    });

    if (this.debugMode) {
      this.platform.log.info('Set CoolingThresholdTemperature', temp);
    }
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    const temp = value as number;
    this.state.targetTemp = temp;
    this.state.workMode = WorkModes.Heat;

    await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_temp:
                this.state.tempUnit === 1
                  ? celsiusToFahrenheit(temp).toString()
                  : temp.toString(),
      t_work_mode: WorkModes.Heat.toString(),
    });

    if (this.debugMode) {
      this.platform.log.info('Set HeatingThresholdTemperature', temp);
    }
  }

  async setTemperatureDisplayUnits(value: CharacteristicValue) {
    this.state.tempUnit = value as number;

    await this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_temp_type: value.toString(),
    });

    if (this.debugMode) {
      this.platform.log.info('Set TemperatureDisplayUnits', value);
    }
  }
}
