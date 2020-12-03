import _ from 'lodash';
import Bluebird from 'bluebird';
import async from 'async';

class PromiseRunner {
  /**
   * Task that will be done.
   */
  readonly task: Function;

  constructor (task) {
    this.task = task;
  }

  /**
   * Run the task until the predicate condition is met.
   *
   * @param {Function} predicate - the predicate function to retrieve the current condition
   *
   * @return {Promise<{result: any, runCount: number}>}
   */
  async until(predicate: Function): Promise<{result: any, runCount: number}> {
    let runCount = 0;
    const task = this.task;

    const firstRunCheck = predicate({
      result: undefined,
      runCount: runCount
    });

    if (firstRunCheck) {
      return Bluebird.resolve({
        result: undefined,
        runCount: runCount
      });
    }

    return new Bluebird((resolve, reject) => {
      let result;

      const untilPredicate = () => {
        const resultObj = {
          result,
          runCount
        };

        return predicate(resultObj);
      };

      const iterationCallback = (callback) => {
        runCount = runCount + 1;

        return task()
          .then(_result => {
            result = _result;

            return callback(null, _result);
          })
          .catch(callback);
      };

      const doneCallback = (err, result) => {
        if (err) {
          return reject(err);
        }

        return resolve({
          result,
          runCount
        });
      };

      return async.until(untilPredicate, iterationCallback, doneCallback);
    });
  }

  /**
   * Create a runner to run the task until the predicate condition is met.
   *
   * @param {Function} predicate - the predicate function to retrieve the current condition
   *
   * @return {Promise<{result: any, runCount: number}>}
   */
  async while (predicate: (...args: Array<any>) => boolean): Promise<{result: any, runCount: number}> {
    return this.until(_.negate(predicate));
  }
}

export = PromiseRunner;
