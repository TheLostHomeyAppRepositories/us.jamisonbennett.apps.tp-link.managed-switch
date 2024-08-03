import Homey from 'homey';
import DeviceAPI from './deviceAPI';

class Device extends Homey.Device {

  private deviceAPI: DeviceAPI | null = null
  private refreshInterval: NodeJS.Timeout | null = null
  private refeshTimeIterval = 3600000; // 1 Hour, this will cause other users to be logged out of the managed switch so don't make it too frequent

  private configurablePorts: boolean[] | null = null

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

    await this.handleConfigurablePortsChange(this.getSetting('configurable_ports'));

    // Set the current values of each switch
    this.refreshState();

    this.refreshInterval = setInterval(() => {
      this.refreshState().catch(error => {
        this.log('Error refreshing state: ', error);
      });
    }, this.refeshTimeIterval);
  }

  async onUninit() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refreshState() {
    if (this.deviceAPI == null) {
      return;
    }

    // Set the current values of each switch
    const portStatus = await this.deviceAPI.getAllPortsEnabled();
    if (portStatus) {
      const defaultPortNumber = this.getSetting('default_port_number') || 0;
      if (defaultPortNumber == 0) {
        await this.setCapabilityValue(`onoff.default`, true);
      } else if (defaultPortNumber > 0 && defaultPortNumber <= portStatus.length) {
        await this.setCapabilityValue(`onoff.default`, portStatus[defaultPortNumber-1]);
      }
      for (let i = 0; i < portStatus.length; i++) {
        await this.setCapabilityValue(`onoff.${i+1}`, portStatus[i]);
      }
    }
  }

  async onCapabilityOnoff(port: number, value: boolean) {
    this.log(`Turning switch port ${port} ${value ? 'on' : 'off'}`);
    if (this.deviceAPI == null) {
      this.log(`Unable to set the port ${port} ${value ? 'on' : 'off'} because the device is not initialized.`);
      throw new Error(`Unable to set the port ${port} ${value ? 'on' : 'off'} because the device is not initialized.`);
    }
    if (this.configurablePorts == null || this.configurablePorts[port-1]) {
      const result = await this.deviceAPI.setPortEnabled(port, value);
      if (!result) {
        this.log(`Unable to set the port ${port} ${value ? 'on' : 'off'}`);
        throw new Error(`Unable to set the port ${port} ${value ? 'on' : 'off'}`);
      }
    } else {
      this.log(`Unable to set the port ${port} ${value ? 'on' : 'off'} because it was configuration is restricted.`);
      throw new Error(`Unable to set the port ${port} ${value ? 'on' : 'off'} because it was configuration is restricted.`);
    }
    return this.refreshState();
  }

  async onCapabilityOnoffDefault(value: boolean) {
    const defaultPortNumber = this.getSetting('default_port_number') || 0;
    this.log(`Turning the default switch port ${defaultPortNumber} ${value ? 'on' : 'off'}`);
    if (defaultPortNumber == 0) {
      // There is no default port
      return this.refreshState();
    }

    return this.onCapabilityOnoff(defaultPortNumber, value);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }: { oldSettings: any, newSettings: any, changedKeys: string[] }) {

    if (changedKeys.includes('default_port_number')) {
      this.handleDefaultPortChange(newSettings.default_port_number);
    }

    if (changedKeys.includes('configurable_ports')) {
      this.handleConfigurablePortsChange(newSettings.configurable_ports);
    }
  }

  private handleDefaultPortChange(newDefaultPortNumber: any) {
    // Ensure the device actually has the port number on it
    try {
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

      // Refresh the default swich state
      this.refreshState().then(() => undefined);
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

  private handleConfigurablePortsChange(newPorts: any) {
    if (newPorts) {
      const ports = this.parsePortNumbers(newPorts);
      if (this.deviceAPI != null) {
        const maxPortNumber = this.deviceAPI.getNumPorts();
        let configurablePorts: boolean[] = new Array(maxPortNumber).fill(false);
        ports.forEach(port => {
          if (port <= 0 || port > maxPortNumber) {
            throw new Error(`Port number out of range: ${port}`);
          }
          configurablePorts[port-1] = true;
        });
        this.configurablePorts = configurablePorts;
      } else {
        this.configurablePorts = null;
      }
    } else {
      this.configurablePorts = null;
    }
  }

  private parsePortNumbers(input: string): number[] {
    if (!input) {
      return []; // Empty value indicates all ports
    }

    const ports: number[] = [];
    const ranges = input.replace(/\s+/g, '').split(',');

    ranges.forEach(range => {
      const [start, end] = range.split('-').map(Number);
      if (!Number.isInteger(start) || (end !== undefined && !Number.isInteger(end))) {
        throw new Error(`Invalid port range: ${range}`);
      }

      if (end === undefined) {
        ports.push(start);
      } else {
        if (start > end) {
          throw new Error(`Invalid range: ${range}`);
        }
        for (let i = start; i <= end; i++) {
          ports.push(i);
        }
      }
    });

    return ports;
  }
}

module.exports = Device;
