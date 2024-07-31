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
}

module.exports = Device;
