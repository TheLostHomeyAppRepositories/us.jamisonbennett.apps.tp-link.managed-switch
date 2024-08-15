'use strict';

interface ILogger {
  log(...args: any[]): void;
  error(...args: any[]): void;
}

class Logger {
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  public log(...args: any[]): void {
    this.logger.log(...args);
  }

  public error(...args: any[]): void {
    this.logger.error(...args);
  }
}

export default Logger;
