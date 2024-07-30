'use strict';

import Homey from 'homey';

class App extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('TP-Link Managed Switch App has been initialized');
  }
}

module.exports = App;
