'use strict';

import { jest } from '@jest/globals';

import Logger, { ILogger } from '../Logger';

describe('Logger', () => {
  let mockLogger: jest.Mocked<ILogger>;
  let logger: Logger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    logger = new Logger(mockLogger);
  });

  it('should call log method with correct arguments', () => {
    const args = ['Test log message'];
    logger.log(...args);
    expect(mockLogger.log).toHaveBeenCalledWith(...args);
  });

  it('should call error method with correct arguments', () => {
    const args = ['Test error message'];
    logger.error(...args);
    expect(mockLogger.error).toHaveBeenCalledWith(...args);
  });
});
