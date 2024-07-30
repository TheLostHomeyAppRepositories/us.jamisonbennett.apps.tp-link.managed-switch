import Homey from 'homey';
import DeviceAPI from './deviceAPI';

class Device extends Homey.Device {

  private deviceAPI: DeviceAPI | null = null

  async onInit() {
    this.log('TP-Link managed switch device has been initialized');

    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    const address = this.getStoreValue('address');
    const username = this.getStoreValue('username');
    const password = this.getStoreValue('password');
    this.deviceAPI = new DeviceAPI(address, username, password);
    if (!await this.deviceAPI.connect()) {
      this.log("Unable to connect to managed switch");
    }
  }

  async onCapabilityOnoff(value: boolean) {
    this.log('Turning switch', value ? 'on' : 'off');
    if (this.deviceAPI == null) {
      return;
    }
    const result = await this.deviceAPI.setPortEnabled(5, value); // TODO this is hardcoded for now
    if (!result) {
      this.log(`Unable to set the port ${value ? 'on' : 'off'}`);
    }
  }
}

module.exports = Device;
