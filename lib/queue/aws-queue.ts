import _ from 'lodash';
import AWS from 'aws-sdk';
import Bluebird from 'bluebird';
import url from 'url';

import AWSQueueConfig from '../interface/aws-queue-config';
import PollConfig from '../interface/poll-config';

import QueueService from '../enum/queue-service';

import Queue from './queue';
import MessageQueue from './message-queue';
import PromiseRunner from '../common/promise-runner';
import Delayer from '../common/delayer';

AWS.config.setPromisesDependency(Bluebird);

const FIVE_MINUTES_IN_SECONDS = 300;
const TEN_SECONDS = 10;

/**
 * This is a class that represents queue using AWS SQS vendor. Documentation for AWS SQS queue
 * can be seen here: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html.
 */
class AWSQueue extends Queue {
  /**
   * Queue client.
   */
  client: AWS.SQS;

  /**
   * Queue URL.
   */
  queueUrl: string;

  /**
   * Array of statuses that represents whether
   * each consumer is polling or not.
   */
  pollingStatuses: Array<boolean>;

  /**
   * Get default poll config.
   *
   * @return {{
   *   delayer: Delayer,
   *   additionalConfig: {
   *     [key: string]: any
   *   }
   * }}
   */
  static getDefaultPollConfig(): {
    delayer: Delayer,
    additionalConfig: {
      [key: string]: any
    }
  } {
    const delayer = new Delayer(
      1000,
      (seconds) => seconds * 2,
      60000
    );

    return {
      delayer,
      additionalConfig: {
        VisibilityTimeout: FIVE_MINUTES_IN_SECONDS,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: TEN_SECONDS
      }
    };
  }

  constructor(config: AWSQueueConfig) {
    super({
      queueService: QueueService.AWS,
      metricConfigs: config.metricConfigs,
      pollConfig: config.pollConfig,
      logger: config.logger,
      metricByName: config.metricByName
    });

    this.queueUrl = url.resolve(config.queuePrefixUrl, config.subscriptionName);
    this.pollingStatuses = [];

    this.client = new AWS.SQS({
      ...config.additionalConfig,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken
      },
      region: config.region
    });
  }

  /**
   * Create task to be run at each polling iteration.
   *
   * @param {PollConfig} config
   * @param {number} consumerIndex
   *
   * @return {Function} - the task
   */
  createTask(config: PollConfig, consumerIndex: number): Function {
    return async () => {
      const response = await this.client.receiveMessage({
        ...config.additionalConfig,
        QueueUrl: this.queueUrl
      }).promise();

      const messages = _.defaultTo(response.Messages, []);
      const messageLength = _.size(messages);

      this.logger.info(`[Consumer ${consumerIndex}] Response after polling got ${messageLength} messages`);

      const concurrency = _.defaultTo(config.concurrency, 1);

      await Bluebird.map(messages, (message) => {
        return Bluebird.resolve()
          .then(async () => {
            this.logger.info(`[Consumer ${consumerIndex}] Process message: ${JSON.stringify(message.Body)}`);

            let messageQueue;

            try {
              messageQueue = new MessageQueue(message, this.queueService);
            } catch (error) {
              this.ack(message);

              throw error;
            }

            await this.processMessage(messageQueue);

            this.logger.info(`[Consumer ${consumerIndex}] Done processing message: ${JSON.stringify(messageQueue.content)}`);
          })
          .catch((error) => {
            this.logger.error(`[Consumer ${consumerIndex}] Error when processing message: ${JSON.stringify(message.Body)}. Error: ${error.message || JSON.stringify(error.stack)}`);
          });
      }, {
        concurrency
      });

      if (messageLength > 0) {
        await config.delayer.reset();
      } else {
        this.logger.info(`[Consumer ${consumerIndex}] No message will delay for ${config.delayer.nextDelay()} ms`);
      }

      await config.delayer.delay();
    };
  }

  /**
   * Spawn consumers and start polling for messages.
   * Check the polling status for each consumer, while the polling status
   * is true, the consumer will keep polling for messages from queue and process
   * them to modify the metric.
   */
  async poll(): Promise<void> {
    const config = _.defaults(this.pollConfig, AWSQueue.getDefaultPollConfig());

    const consumerCount = _.defaultTo(config.consumerCount, 1);

    if (this.pollingStatuses.length > 0) {
      this.close();

      // Wait for all of existing polls terminated
      await Bluebird.delay(Number(config.delayer.maximumDelay) + 30000);
    }

    this.pollingStatuses = Array(consumerCount).fill(true);

    await Bluebird.map(_.range(consumerCount), async (idx) => {
      const consumerIndex = idx + 1;

      const task = this.createTask({
        ...config,
        /**
         * Create a new delayer instance for each consumer.
         * WARNING: This method only copies primitive types. For array and object, the new instance still
         * references to the old one.
         */
        delayer: Object.assign(Object.create(Object.getPrototypeOf(config.delayer)), config.delayer)
      }, consumerIndex);

      const runner = new PromiseRunner(task);

      this.logger.info(`[Consumer ${consumerIndex}] Creating consumer`);

      await runner.while(() => Boolean(this.pollingStatuses[idx]));
    }, { concurrency: consumerCount });
  }

  /**
   * Acknowledge the message.
   *
   * @param {any} message
   */
  async ack(message: any): Promise<void> {
    await this.client.deleteMessage({
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.ReceiptHandle
    }).promise();
  }

  /**
   * Unacknowledge the message.
   *
   * @param {any} message
   */
  nack(message: any): void {}

  /**
   * Stop the consumers from polling. If numberOfConsumer parameter
   * is not passed, will stop all of the consumers.
   *
   * @param {number} numberOfConsumer
   */
  close(numberOfConsumer?: number): void {
    const consumerLength = this.pollingStatuses.length;

    const numberOfClosedSubscription = Math.min(_.defaultTo(numberOfConsumer, consumerLength), consumerLength);

    for (let i = 0; i < numberOfClosedSubscription; i++) {
      // Undefined polling status will terminate the consumer loop and stop the consumer
      this.pollingStatuses.shift();
    }
  }
}

export = AWSQueue;
