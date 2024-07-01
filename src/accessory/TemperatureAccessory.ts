import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { ConnectLifeAcPlatformPlugin } from '../platform';
import { ConnectLifeApi } from '../lib';
import { WorkModes } from '../constants';
import { celsiusToFahrenheit, fahrenheitToCelsius } from '../utils';

export class TemperatureAccessory {
  private deviceNickName: string;
  private connectLifeApi: ConnectLifeApi;
  private service: Service;

  constructor(
    private readonly platform: ConnectLifeAcPlatformPlugin,
    private readonly accessory: PlatformAccessory,
  ) {
    const { deviceNickName, loginID, password } = platform.config;

    if (!deviceNickName || !loginID || !password) {
      throw new Error('Missing required config');
    }

    this.deviceNickName = deviceNickName;
    this.connectLifeApi = new ConnectLifeApi(loginID, password);

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'null')
      .setCharacteristic(this.platform.Characteristic.Model, 'null')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'null');

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
      .onSet(this.setCurrentTemperature.bind(this))
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
  }

  async setActive(value: CharacteristicValue) {
    const { t_power } = await this.connectLifeApi.getDeviceProperties(
      this.deviceNickName,
      {
        t_power: 'integer',
      },
    );

    if (t_power === value) {
      return;
    }

    this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_power: value,
    });

    this.platform.log.info('Set Active', value);
  }

  async getActive(): Promise<CharacteristicValue> {
    const { t_power } = await this.connectLifeApi.getDeviceProperties(
      this.deviceNickName,
      {
        t_power: 'integer',
      },
    );

    return t_power;
  }

  setCurrentTemperature(_value: CharacteristicValue) {
    this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_work_mode: WorkModes.Auto,
    });
    this.platform.log.info('Set CurrentTemperature', _value);
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const { t_temp, t_temp_type } =
      await this.connectLifeApi.getDeviceProperties(this.deviceNickName, {
        t_temp: 'integer',
        t_temp_type: 'integer',
      });

    return t_temp_type === 1 ? fahrenheitToCelsius(t_temp as number) : t_temp;
  }

  setSwingMode(value: CharacteristicValue) {
    this.platform.log.info('Set SwingMode', value);
  }

  getSwingMode(): CharacteristicValue {
    return 0;
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    const { t_temp_type } = await this.connectLifeApi.getDeviceProperties(
      this.deviceNickName,
      {
        t_temp_type: 'integer',
      },
    );

    this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_temp: t_temp_type === 1 ? celsiusToFahrenheit(value as number) : value,
      t_work_mode: WorkModes.Cool,
    });
    this.platform.log.info('Set CoolingThresholdTemperature', value);
  }

  async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
    const { t_temp, t_temp_type, t_work_mode } =
      await this.connectLifeApi.getDeviceProperties(this.deviceNickName, {
        t_temp: 'integer',
        t_temp_type: 'integer',
        t_work_mode: 'integer',
      });

    if (t_work_mode !== WorkModes.Cool) {
      return 10;
    }

    return t_temp_type === 1 ? fahrenheitToCelsius(t_temp as number) : t_temp;
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    const { t_temp_type } = await this.connectLifeApi.getDeviceProperties(
      this.deviceNickName,
      {
        t_temp_type: 'integer',
      },
    );

    this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_temp: t_temp_type === 1 ? celsiusToFahrenheit(value as number) : value,
      t_work_mode: WorkModes.Heat,
    });
    this.platform.log.info('Set HeatingThresholdTemperature', value);
  }

  async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
    const { t_temp, t_temp_type, t_work_mode } =
      await this.connectLifeApi.getDeviceProperties(this.deviceNickName, {
        t_temp: 'integer',
        t_temp_type: 'integer',
        t_work_mode: 'integer',
      });

    if (t_work_mode !== WorkModes.Heat) {
      return 0;
    }

    return t_temp_type === 1 ? fahrenheitToCelsius(t_temp as number) : t_temp;
  }

  setTemperatureDisplayUnits(value: CharacteristicValue) {
    this.connectLifeApi.changeDeviceProperties(this.deviceNickName, {
      t_temp_type: value,
    });
    this.platform.log.info('Set TemperatureDisplayUnits', value);
  }

  async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
    const { t_temp_type } = await this.connectLifeApi.getDeviceProperties(
      this.deviceNickName,
      {
        t_temp_type: 'integer',
      },
    );

    return t_temp_type;
  }
}
