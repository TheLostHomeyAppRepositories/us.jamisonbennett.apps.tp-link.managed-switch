'use strict';

import Homey from 'homey';
const Device = require('../device');
import DeviceAPI from '../deviceAPI';
const Driver = require('../driver');

jest.mock('homey', () => {
  return {
    Device: class {
      log = jest.fn();
    },
    Driver: class {
      log = jest.fn();
    },
  };
});
jest.mock('../device');
jest.mock('../deviceAPI');

describe('Driver', () => {
  let driver: any;

  beforeEach(async () => {
    driver = new Driver();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onInit', () => {
    it('should initialize and register flow cards correctly', async () => {
      const mockFlow = {
        getConditionCard: jest.fn().mockReturnValue({
          registerRunListener: jest.fn(),
        }),
        getActionCard: jest.fn().mockReturnValue({
          registerRunListener: jest.fn(),
        }),
      };

      driver.homey = { flow: mockFlow };

      await driver.onInit();

      expect(mockFlow.getConditionCard).toHaveBeenCalledWith('link_up');
      expect(mockFlow.getActionCard).toHaveBeenCalledWith('enable_port');
      expect(mockFlow.getActionCard).toHaveBeenCalledWith('disable_port');
      expect(mockFlow.getActionCard).toHaveBeenCalledWith('enable_leds');
      expect(mockFlow.getActionCard).toHaveBeenCalledWith('disable_leds');
      expect(mockFlow.getActionCard).toHaveBeenCalledWith('restart');
    });
  });

  describe('onPair', () => {
    it('should handle device pairing correctly', async () => {
      const mockSession = {
        setHandler: jest.fn(),
        nextView: jest.fn(),
        showView: jest.fn(),
        done: jest.fn(),
      };

      await driver.onPair(mockSession);

      expect(mockSession.setHandler).toHaveBeenCalledWith('set_connection_info', expect.any(Function));
      expect(mockSession.setHandler).toHaveBeenCalledWith('showView', expect.any(Function));
      expect(mockSession.setHandler).toHaveBeenCalledWith('list_devices', expect.any(Function));
      expect(mockSession.setHandler).toHaveBeenCalledWith('close_connection', expect.any(Function));
    });
  });

  describe('onRepair', () => {
    it('should handle device repair correctly', async () => {
      const mockSession = {
        setHandler: jest.fn(),
        nextView: jest.fn(),
        showView: jest.fn(),
        done: jest.fn(),
      };

      const mockDevice = {
        getData: jest.fn().mockReturnValue({ id: 'mocked-id' }),
        repair: jest.fn(),
      };

      await driver.onRepair(mockSession, mockDevice);

      expect(mockSession.setHandler).toHaveBeenCalledWith('getDeviceMacAddress', expect.any(Function));
      expect(mockSession.setHandler).toHaveBeenCalledWith('set_connection_info', expect.any(Function));
      expect(mockSession.setHandler).toHaveBeenCalledWith('showView', expect.any(Function));
      expect(mockSession.setHandler).toHaveBeenCalledWith('close_connection', expect.any(Function));
    });

    it('should throw an error if the device is unsupported', async () => {
      const mockSession = {
        setHandler: jest.fn(),
      };

      await expect(driver.onRepair(mockSession, null)).rejects.toThrow('Unsupported device');
    });
  });

});
