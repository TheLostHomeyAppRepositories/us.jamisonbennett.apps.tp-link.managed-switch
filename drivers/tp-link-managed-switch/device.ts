'use strict';

import Homey from 'homey';
import DeviceAPI from './deviceAPI';

class Device extends Homey.Device {

  private linkStateChanged: Homey.FlowCardTriggerDevice | null = null;
  private suspendRefreshTime = 300000; // Suspend refreshing for 5 minutes to prepare for a repair
  private refreshPromise: Promise<void> | null = null;
  private lastSuspendRefreshTime = 0;
  private needsFullRefresh = false;
  private registeredCapabilities = new Set();
  private address: string = ""
  private username: string = ""
  private password: string = ""
  private deviceAPI: DeviceAPI | null = null
  private refreshInterval: NodeJS.Timeout | null = null
  private refreshIntervalProcessing: boolean = false
  private refreshTimeIterval = 60000; // 1 minute
  private refreshAndLoginTimeIterval = 3600000; // 1 Hour, this will cause other users to be logged out of the managed switch so don't make it too frequent
  private lastRefreshLoginTime = 0;
  private lastAllLinksStatus: boolean[] | null = null;

  private configurablePorts: boolean[] | null = null;

  async onInit() {
    this.log('TP-Link managed switch device has been initialized');

    this.registerCapabilityListener("onoff.favorite", this.onCapabilityOnoffFavorite.bind(this));
    this.registerCapabilityListener("onoff.leds", this.onCapabilityOnoffLeds.bind(this));

    this.linkStateChanged = this.homey.flow.getDeviceTriggerCard('link_state_changed');

    return this.fullRefresh().catch(async (error) => {
      this.log('Error performing init: ', error);
      await this.setUnavailable(error);
    }).finally( () => {
      this.refreshInterval = setInterval(async () => {
        if (this.getRefreshIntervalProcessing()) {
          return;
        }
        if (Date.now() - this.suspendRefreshTime < this.lastSuspendRefreshTime) {
          return;
        }
        try {
          this.setRefreshIntervalProcessing(true);
          if (this.needsFullRefresh) {
            this.fullRefresh().catch(async (error) => {
              this.log('Error performing full refresh: ', error);
              await this.setUnavailable(error);
            });
          } else {
            const isLoggedIn = this.deviceAPI != null && (await this.deviceAPI.isLoggedIn());
            const forceRefresh = Date.now() - this.lastRefreshLoginTime >= this.refreshAndLoginTimeIterval;
            if (forceRefresh) {
              this.lastRefreshLoginTime = Date.now();
            }
            if (isLoggedIn || forceRefresh) {
              this.refreshState().catch(error => {
                this.log('Error refreshing state: ', error);
              });
            }
          }
        } finally {
          this.setRefreshIntervalProcessing(false);
        }
      }, this.refreshTimeIterval);
    });
  }

  async fullRefresh() {
    this.needsFullRefresh = true;

    this.refreshPromise = new Promise<void>(async (resolve, reject) => {
      try {
        this.address = this.getStoreValue('address');
        this.username = this.getStoreValue('username');
        this.password = this.getStoreValue('password');
        this.deviceAPI = new DeviceAPI(this, this.address, this.username, this.password);
        this.lastRefreshLoginTime = Date.now();
        if (!await this.deviceAPI.connect()) {
          throw new Error("Unable to connect to managed switch");
        } 

        // Await for each one in order so they are properly ordered
        for (let i = 1; i <= this.deviceAPI.getNumPorts(); i++ ) {
          await this.addCapabilityIfNeeded(i);
        }

        await this.waitForInitialCapabilityRegistrationToFinish();

        const promises = [];
        for (let i = 1; i <= this.deviceAPI.getNumPorts(); i++ ) {
          promises.push(this.setupCapability(i));
        }

        promises.push(this.setEnergy(this.energyUsage()));

        this.handleConfigurablePortsChange(this.getSetting('configurable_ports'));

        await Promise.all(promises).then(async () => {
          await this.setAvailable();
          this.needsFullRefresh = false;
          // Set the current values of each switch
          return this.refreshState();
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        resolve();
      }
    });
    return this.refreshPromise;
  }

  async onUninit() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private async addCapabilityIfNeeded(port: number) {
    // Avoid adding a capability that already exists since it is an expensive operation
    const capability = `onoff.${port}`;
    if (!this.getCapabilities().includes(capability)) {
      return this.addCapability(capability);
    }
  }

  private async setupCapability(port: number) {
    const capability = `onoff.${port}`;

    if (!this.registeredCapabilities.has(capability)) {
      this.registerCapabilityListener(capability, this.onCapabilityOnoff.bind(this, port));
      this.registeredCapabilities.add(capability);
    }

    // Avoid setting capability options (ie title) if it already is set since it is an expensive operation.
    // Checking if its already set can thrown an exception if its not set.
    let needToSetTitle = true;
    let needToSetUiQuickAction = true;
    const title = this.homey.__(`settings.drivers.tp-link-managed-switch.portName`, { number: port });
    try {
      needToSetTitle = title != this.getCapabilityOptions(capability).title;
      needToSetUiQuickAction = !this.getCapabilityOptions(capability).uiQuickAction;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid Capability:')) {
        // ignore if the capability is not registered because this just means it needs to be registered
      } else {
        throw error;
      }
    }
    if (needToSetTitle || needToSetUiQuickAction) {
      return this.setCapabilityOptions(capability, {
        title: title,
        uiQuickAction: false,
      });
    }
  }

  private async waitForInitialCapabilityRegistrationToFinish(retries: number = 100, retryDelay: number = 100): Promise<void> {
    // Sometimes the registered capabilities are not registered eventhough the promise for registering comes before the code that uses the capability.
    // This allows all of the capabilities to register before using them.
    const registeredCapabilities = this.getCapabilities();
    const requiredCapabilities = ["onoff.favorite"];
    if (this.deviceAPI) {
      for (let i = 1; i <= this.deviceAPI.getNumPorts(); i++ ) {
        requiredCapabilities.push(`onoff.${i}`);
      }
    }

    if (requiredCapabilities.every(capability => registeredCapabilities.includes(capability))) {
      return;
    }

    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return this.waitForInitialCapabilityRegistrationToFinish(retries - 1, retryDelay);
    }

    throw new Error('Failed to register all required capabilities within the expected time.');
  }

  private async refreshState() {
    if (this.deviceAPI == null) {
      return;
    }

    const promises = [];

    // Set the current values of each switch
    const portStatus = await this.deviceAPI.getAllPortsEnabled();
    if (portStatus) {
      const defaultPortNumber = this.getSetting('default_port_number') || 0;
      if (defaultPortNumber == 0) {
        promises.push(this.setCapabilityIfNeeded(`onoff.favorite`, true));
      } else if (defaultPortNumber > 0 && defaultPortNumber <= portStatus.length) {
        promises.push(this.setCapabilityIfNeeded(`onoff.favorite`, portStatus[defaultPortNumber-1]));
      }
      for (let i = 0; i < portStatus.length; i++) {
        promises.push(this.setCapabilityIfNeeded(`onoff.${i+1}`, portStatus[i]));
      }
    }
    const ledStatus = await this.deviceAPI.getLedsEnabled();
    if (ledStatus != null) {
      promises.push(this.setCapabilityIfNeeded(`onoff.leds`, ledStatus));
    }

    // Handle link up/down triggers
    const allLinksStatus = await this.deviceAPI.getAllLinksUp();
    if (allLinksStatus && this.lastAllLinksStatus && allLinksStatus.length == this.lastAllLinksStatus.length) {
      for (let port = 0; port < allLinksStatus.length; port++) {
        if (allLinksStatus[port] != this.lastAllLinksStatus[port]) {
          this.linkStateChanged?.trigger(this, {port: port+1, linkUp: allLinksStatus[port]}, {});
        }
      }
    }
    if (allLinksStatus) {
      this.lastAllLinksStatus = allLinksStatus;
    }

    return Promise.all(promises).then(() => undefined);
  }

  private async setCapabilityIfNeeded(capabilityId: string, newValue: boolean) {
    const currentValue = this.getCapabilityValue(capabilityId);
    if (currentValue != newValue) {
      return this.setCapabilityValue(capabilityId, newValue);
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

  async onCapabilityOnoffFavorite(value: boolean) {
    const favoritePortNumber = this.getSetting('favorite_port_number') || 0;
    this.log(`Turning the favorite switch port ${favoritePortNumber} ${value ? 'on' : 'off'}`);
    if (favoritePortNumber == 0) {
      // There is no favorite port
      return this.refreshState();
    }

    return this.onCapabilityOnoff(favoritePortNumber, value);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }: { oldSettings: any, newSettings: any, changedKeys: string[] }) {

    if (changedKeys.includes('favorite_port_number')) {
      this.handleDefaultPortChange(newSettings.favorite_port_number);
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

      // Refresh the favorite switch state
      this.refreshState();
    } catch (error) {
      if (error instanceof Error) {
        this.log("Invalid favorite port number:", error.message);
        throw new Error(`Invalid favorite port number ${error.message}`);
      } else {
        this.log("Invalid favorite port number");
        throw new Error("Invalid favorite port number");
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

  async onCapabilityOnoffLeds(value: boolean) {
    this.log(`Turning the leds ${value ? 'on' : 'off'}`);

    if (this.deviceAPI == null) {
      this.log(`Unable to set the LEDs ${value ? 'on' : 'off'} because the device is not initialized.`);
      throw new Error(`Unable to set the LEDs ${value ? 'on' : 'off'} because the device is not initialized.`);
    }
    const result = await this.deviceAPI.setLedsEnabled(value);
    if (!result) {
      this.log(`Unable to set the LEDs ${value ? 'on' : 'off'}`);
      throw new Error(`Unable to set the LEDs ${value ? 'on' : 'off'}`);
    } 
    return this.refreshState();
  }

  async restart() {
    this.log("Restarting managed switch");

    if (this.deviceAPI == null) {
      this.log(`Unable to restart the manged switch because the device is not initialized.`);
      throw new Error(`Unable to restart the manged switch because the device is not initialized.`);
    }
    const result = await this.deviceAPI.restart();
    if (!result) {
      this.log(`Unable to restart the manged switch.`);
      throw new Error(`Unable to restart the manged switch.`);
    }
  }

  async isLinkUp(port: number): Promise<boolean> {
    this.log(`Checking if link is up for port ${port}.`);

    if (this.deviceAPI == null) {
      this.log(`Unable to check if the link is up because the device is not initialized.`);
      throw new Error(`Unable to check if the link is up because the device is not initialized.`);
    }
    const result = await this.deviceAPI.isLinkUp(port);
    if (result == null) {
      this.log(`Unable to check if the link is up.`);
      throw new Error(`Unable to check if the link is up.`);
    }
    return result;
  } 

  private energyUsage() {
    if (!this.deviceAPI) {
      throw new Error("Unable to estimate energy usage with a device that is not initilized");
    }

    // The data sheet was used for a 24 port switch.
    const wattsPerPort = 0.591;
    return {
      approximation: {
        usageConstant: this.deviceAPI.getNumPorts() * wattsPerPort
      }
    };
  }

  public async repair(address: string, username: string, password: string) {
    this.log("Updating device");

    this.address = address;
    this.username = username;
    this.password = password;

    await this.save();
    await this.suspendRefresh();
    return this.fullRefresh().finally(() => {
      this.resumeRefresh();
    });
  }

  public async save() {
    const promises = [];
    promises.push(this.setStoreValue('address', this.address));
    promises.push(this.setStoreValue('username', this.username));
    promises.push(this.setStoreValue('password', this.password));
    return Promise.all(promises).then(() => undefined);
  }

  public getAddress() {
    return this.getStoreValue('address');
  }

  public getUsername() {
    return this.getStoreValue('username');
  }

  public getPassword() {
    return this.getStoreValue('password');
  }

  public async suspendRefresh() {
    if (this.refreshPromise) {
      await this.refreshPromise; // Wait for the ongoing refresh to finish
    }
    this.lastSuspendRefreshTime = Date.now();
  }

  public async resumeRefresh() {
    this.lastSuspendRefreshTime = 0;
  }

  private setRefreshIntervalProcessing(value: boolean) {
    this.refreshIntervalProcessing = value;
  }

  private getRefreshIntervalProcessing() {
    const refreshIntervalProcessing = this.refreshIntervalProcessing;
    return refreshIntervalProcessing;
  }
}

module.exports = Device;
