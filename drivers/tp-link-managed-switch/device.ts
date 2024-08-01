import Homey from 'homey';
import DeviceAPI from './deviceAPI';

class Device extends Homey.Device {

  private deviceAPI: DeviceAPI | null = null

  async onInit() {
    this.log('TP-Link managed switch device has been initialized');

    const address = this.getStoreValue('address');
    const username = this.getStoreValue('username');
    const password = this.getStoreValue('password');
    this.deviceAPI = new DeviceAPI(address, username, password);
    if (!await this.deviceAPI.connect()) {
      this.log("Unable to connect to managed switch");
    }

    const defaultCapability = "onoff.default";
    await this.addCapability(defaultCapability);
    this.registerCapabilityListener(defaultCapability, this.onCapabilityOnoffDefault.bind(this));

    const defaultTitle = this.homey.__(`settings.drivers.tp-link-managed-switch.defaultPort`);
    await this.setCapabilityOptions(defaultCapability, {
      title: defaultTitle
    });

    for (let i = 1; i <= this.deviceAPI.getNumPorts(); i++ ) {
      this.log(`Loading switch port ${i}`);
      const capability = `onoff.${i}`;
      await this.addCapability(capability);
      this.registerCapabilityListener(capability, this.onCapabilityOnoff.bind(this, i));

      const title = this.homey.__(`settings.drivers.tp-link-managed-switch.portName`, { number: i });
      await this.setCapabilityOptions(capability, {
        title: title
      });
    }
  }

  async onCapabilityOnoff(port: number, value: boolean) {
    this.log(`Turning switch port ${port} ${value ? 'on' : 'off'}`);
    if (this.deviceAPI == null) {
      return;
    }
    const result = await this.deviceAPI.setPortEnabled(port, value);
    if (!result) {
      this.log(`Unable to set the port ${port} ${value ? 'on' : 'off'}`);
    }
  }

  async onCapabilityOnoffDefault(value: boolean) {
    const defaultPortNumber = this.getSetting('default_port_number') || 0;
    this.log(`Turning the default switch port ${defaultPortNumber} ${value ? 'on' : 'off'}`);
    if (defaultPortNumber == 0) {
      // There is no default port
      return;
    }

    return this.onCapabilityOnoff(defaultPortNumber, value);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }: { oldSettings: any, newSettings: any, changedKeys: string[] }) {

    if (changedKeys.includes('default_port_number')) {
      // Ensure the device actually has the port number on it
      try {
        const newDefaultPortNumber = newSettings.default_port_number;
        if (!Number.isInteger(newDefaultPortNumber)) {
          throw new Error('Non-integer port number are not supported.');
        }
        if (newDefaultPortNumber < 0) {
          throw new Error('Negative port numberr are not supported');
        }
        if (this.deviceAPI != null) {
          const maxPortNumber = this.deviceAPI.getNumPorts();
          if (newDefaultPortNumber > maxPortNumber) {
            throw new Error(`The maximum port number on this device is ${this.deviceAPI.getNumPorts()}.`);
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          this.log("Invalid default port number:", error.message);
          throw new Error(`Invalid default port number ${error.message}`);
        } else {
          this.log("Invalid default port number");
          throw new Error("Invalid default port number");
        }
      }
    }
  }
}

module.exports = Device;
