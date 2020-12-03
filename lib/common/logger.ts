import _ from 'lodash';

class Logger {
  private logger: any;

  constructor(logger: any) {
    this.logger = _.defaultTo(logger, console);
  }

  /**
   * Log info message to console.
   *
   * @param {string} message
   */
  info(message: string) {
    this.logger.info(message);
  }

  /**
   * Log error message to console.
   *
   * @param {string} message
   */
  error(message: string) {
    this.logger.error(message);
  }

  /**
   * Log debugging message to console.
   *
   * @param {string} message
   */
  debug(message: string) {
    this.logger.debug(message);
  }

  /**
   * Log warning message to console.
   *
   * @param {string} message
   */
  warn(message: string) {
    this.logger.warn(message);
  }
}

export = Logger;
