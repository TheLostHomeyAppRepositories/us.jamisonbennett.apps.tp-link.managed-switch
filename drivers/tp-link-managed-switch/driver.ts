import Homey from 'homey';
import DeviceAPI from './deviceAPI';

class Driver extends Homey.Driver {

  async onInit() {
    this.log('TP-Link managed switch driver has been initialized');

    const linkUpCondition = this.homey.flow.getConditionCard('link_up');
    linkUpCondition.registerRunListener(async (args: any, state: any) => {
      this.validatePortCardArgs(args);
      return args.device.isLinkUp(args.port, true);
    });

    const linkDownCondition = this.homey.flow.getConditionCard('link_down');
    linkDownCondition.registerRunListener(async (args: any, state: any) => {
      this.validatePortCardArgs(args);
      return args.device.isLinkUp(args.port, true).then((result: boolean) => !result);
    });

    const enablePortAction = this.homey.flow.getActionCard('enable_port');
    enablePortAction.registerRunListener(async (args: any, state: any) => {
      this.validatePortCardArgs(args);
      return args.device.onCapabilityOnoff(args.port, true);
    });

    const disablePortAction = this.homey.flow.getActionCard('disable_port');
    disablePortAction.registerRunListener(async (args: any, state: any) => {
      this.validatePortCardArgs(args);
      return args.device.onCapabilityOnoff(args.port, false);
    });

    const enableLedsAction = this.homey.flow.getActionCard('enable_leds');
    enableLedsAction.registerRunListener(async (args: any, state: any) => {
      this.validateDeviceCardArgs(args);
      return args.device.onCapabilityOnoffLeds(true);
    });
    const disableLedsAction = this.homey.flow.getActionCard('disable_leds');
    disableLedsAction.registerRunListener(async (args: any, state: any) => {
      this.validateDeviceCardArgs(args);
      return args.device.onCapabilityOnoffLeds(false);
    });

    const restartAction = this.homey.flow.getActionCard('restart');
    restartAction.registerRunListener(async (args: any, state: any) => {
      this.validateDeviceCardArgs(args);
      return args.device.restart();
    });
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

  private validateDeviceCardArgs(args: any) {
    if (!args.device) {
      throw Error('Switch device is not available');
    }
  }

  private validatePortCardArgs(args: any) {
    this.validateDeviceCardArgs(args);
    if (!args.port || !Number.isInteger(args.port)) {
      throw Error('Port number is unknown');
    }
  }

}

module.exports = Driver;
