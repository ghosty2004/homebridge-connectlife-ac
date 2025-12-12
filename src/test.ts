import {ConnectLifeApi} from './lib';

async function main() {
    const loginID: string = 'example@example.com';
    const password: string = 'somepassword';
    const deviceNickName: string = 'some device name';
    const api = new ConnectLifeApi(loginID, password, {});

    try {
        const token = await api.getAccessToken();
        console.log('Access token OK:', token);

        const deviceId = await api.getDeviceIdByNickName(deviceNickName);
        console.log('Device ID:', deviceId);

        const status = await api.getDeviceProperties(deviceNickName, {
            power: 'integer',
            temperature: 'integer',
            mode: 'string',
        });

        console.log('Status:', status);

        await api.changeDeviceProperties(deviceNickName, {
            t_power: '1',
        });

        console.log('Properties changed');

    } catch (err) {
        console.error('ERROR:', err);
    }
}

main();
