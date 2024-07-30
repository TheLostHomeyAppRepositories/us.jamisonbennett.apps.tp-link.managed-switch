import Homey from 'homey';
import DeviceAPI from './deviceAPI';

class Driver extends Homey.Driver {

  async onInit() {
    this.log('TP-Link managed switch driver has been initialized');
  }

  async onPair(session: Homey.Driver.PairSession) {
    let address = "";
    let username = "";
    let password = "";
    let deviceAPI: DeviceAPI | null = null

    session.setHandler("set_connection_info", async (data) => {
      address = data.address;
      username = data.username;
      password = data.password;
      await session.nextView();
      return true;
    });

    session.setHandler('showView', async (view) => {
      if (view === 'loading') {
        deviceAPI = new DeviceAPI(address, username, password);
        const result = await deviceAPI.connect();
        if (result) {
          await session.showView('list_devices');
        } else {
          await session.showView('connection_error');
        }
      }
    });

    session.setHandler("list_devices", async () => {
      if (deviceAPI == null) {
        return [];
      }
      const deviceData = {
        name: deviceAPI.getName(),
        data: {
          id: deviceAPI.getMacAddress().replace(/:/g, ''),
        },
        store: {
          address: address,
          username: username,
          password: password,
        },
      };
      return [deviceData];
    });

    session.setHandler('close_connection', async () => {
      await session.done();
      return true;
    });
  }

}

module.exports = Driver;
