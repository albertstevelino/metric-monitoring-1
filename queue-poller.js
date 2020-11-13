const _ = require('lodash');
const moment = require('moment');
const Bluebird = require('bluebird');
const url = require('url');

const logger = require('@cermati/cermati-utils/logger')(__filename);
const PromiseRunner = require('@cermati/cermati-utils/promise/runner').PromiseRunner;
const queueUtils = require('@cermati/cermati-utils/queue');
const TEN_MINUTES = 10 * 60; // seconds

exports.poll = ({
  pollOptions,
  queueClient,
  delayer,
  processMessage,
  onResponse,
  sleepHours,
  concurrency = 1
}) => {
  const task = async () => {
    try {
      if (sleepHours) {
        const currentHour = moment().utcOffset(7).hour();

        if (_.includes(sleepHours, currentHour)) {
          return delayer.delay();
        }
      }

      const response = await queueClient.poll(_.defaults(pollOptions, {
        waitTime: 20,
        visibilityTimeout: TEN_MINUTES
      }));

      const messageMetadatas = _.map(response.Messages, message => {
        return _.pick(message, ['Body', 'MessageId']);
      });

      logger.info(
        'Response after polling %s, got %s messages',
        JSON.stringify(messageMetadatas, null, 2),
        _.get(response, ['Messages', 'length'], 0)
      );

      if (_.isEmpty(response.Messages)) {
        logger.info(`No message will delay for ${delayer.nextDelay()}ms`);

        return delayer.delay();
      }

      if (_.isFunction(onResponse)) {
        await onResponse(response);
      } else {
        if (concurrency === 1) {
          // Make sure the messages are consumed in order
          await Bluebird.mapSeries(response.Messages, processMessage);
        } else {
          await Bluebird.map(response.Messages, processMessage, { concurrency });
        }
      }
    } catch (error) {
      logger.error(
        'Error when pulling queue %s. Error %s',
        queueClient.queueUrl,
        JSON.stringify(error.stack || error, null, 2)
      );
    }

    delayer.reset();

    return delayer.delay();
  };

  const runner = new PromiseRunner(task);

  return runner
    .while(_.constant(true))
    .catch(error => {
      logger.error('Error while running runner.while loop %s', JSON.stringify(error.stack || error));
    });
};

