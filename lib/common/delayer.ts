import Bluebird from 'bluebird';

class Delayer {
  /**
   * Starting delay in milliseconds.
   */
  readonly startingDelay: number;

  /**
   * Current delay in milliseconds.
   */
  currentDelay: number;

  /**
   * Maximum delay in milliseconds.
   * After reaching the maximum delay, the delayer will not increment the currentDelay anymore.
   */
  readonly maximumDelay: number;

  /**
   * Function to calculate the next delay.
   */
  readonly calculateNextDelay: (currentDelay: number) => number;

  constructor(startingDelay: number, calculateNextDelay: (currentDelay: number) => number, maximumDelay: number) {
    this.startingDelay = startingDelay;
    this.currentDelay = startingDelay;
    this.maximumDelay = maximumDelay;
    this.calculateNextDelay = calculateNextDelay;
  }

  /**
   * Calculate the next delay and delay as long as the current delay time.
   */
  delay() {
    const delay = this.currentDelay;

    this.currentDelay = this.nextDelay();

    return Bluebird.delay(delay);
  }

  /**
   * Calculate the next delay.
   *
   * @return {number} - the next delay
   */
  nextDelay() {
    return Math.min(this.maximumDelay, this.calculateNextDelay(this.currentDelay));
  }

  /**
   * Reset the delay time to the startingDelay.
   */
  reset() {
    this.currentDelay = this.startingDelay;
  }
}

export = Delayer;
