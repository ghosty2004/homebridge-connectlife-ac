export interface Appliance {
  wifiId: string;
  deviceId: string;
  puid: string;
  deviceNickName: string;
  deviceFeatureCode: string;
  deviceFeatureName: string;
  deviceTypeCode: string;
  deviceTypeName: string;
  bindTime: number;
  role: number;
  roomId: number;
  roomName: string;
  statusList: {
    t_work_mode: string;
    t_power: string;
    t_temp: string;
    t_temp_type: string;
    t_fan_speed: string;
    t_fan_speed_s: string;
    t_up_down: string;
    t_sleep: string;
    t_eco: string;
    t_fan_mute: string;
    t_super: string;
    f_temp_in: string;
    f_e_push: string;
    f_e_intemp: string;
    f_e_incoiltemp: string;
    f_e_inhumidity: string;
    f_e_infanmotor: string;
    f_e_arkgrille: string;
    f_e_invzero: string;
    f_e_incom: string;
    f_e_indisplay: string;
    f_e_inkeys: string;
    f_e_inwifi: string;
    f_e_inele: string;
    f_e_ineeprom: string;
    f_e_outeeprom: string;
    f_e_outcoiltemp: string;
    f_e_outgastemp: string;
    f_e_outtemp: string;
    daily_energy_kwh: number;
  };
  useTime: number;
  offlineState: number;
  seq: number;
  createTime: number;
}
