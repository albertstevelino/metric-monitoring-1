import { PubSub, Subscription, Message } from '@google-cloud/pubsub';
import Bluebird from 'bluebird';
import _ from 'lodash';

import GooglePubSubConfig from '../interface/google-pub-sub-config';
import PollConfig from '../interface/poll-config';

import QueueService from '../enum/queue-service';

import Queue from './queue';
import MessageQueue from './message-queue';

const FIVE_MINUTES_IN_SECONDS = 300;

/**
 * This is a class that represents queue using Google Pub Sub vendor. Documentation for Google Pub Sub
 * can be seen here: https://googleapis.dev/nodejs/pubsub/latest/index.html.
 */
class GooglePubSub extends Queue {
  /**
   * Queue client.
   */
  client: PubSub;

  /**
   * Array of subscribers.
   */
  readonly subscriptions: Array<Subscription>;

  /**
   * Subscriber name.
   */
  readonly subscriptionName: string;

  constructor(config: GooglePubSubConfig) {
    super({
      queueService: QueueService.GooglePubSub,
      metricConfigs: config.metricConfigs,
      pollConfig: config.pollConfig,
      logger: config.logger
    });

    this.client = new PubSub({
      ...config.additionalConfig,
      credentials: {
        client_email: config.clientEmail,
        private_key: config.privateKey
      },
      projectId: config.projectId
    });

    this.subscriptions = [];
    this.subscriptionName = config.subscriptionName;
  }

  /**
   * Get default poll config.
   *
   * @return {{
   *   onError: Function,
   *   additionalConfig: {
   *     [key: string]: any
   *   }
   * }}
   */
  getDefaultPollConfig(): {
    onError: (...args: Array<any>) => void|Promise<void>,
    additionalConfig: {
      [key: string]: any
    }
  } {
    return {
      onError: (error) => this.logger.error(`Error when polling from PubSub. Error: ${JSON.stringify(error)}`),
      additionalConfig: {
        ackDeadline: FIVE_MINUTES_IN_SECONDS
      }
    };
  }

  /**
   * Process message with error handling.
   *
   * @param {Message} message
   * @param {number} subscriptionIndex
   */
  async processMessageWithErrorHandling(message: Message, subscriptionIndex: number): Promise<void> {
    return Bluebird.resolve()
      .then(async () => {
        this.logger.info(`[Subscriber ${subscriptionIndex}] Process message: ${message.data.toString()}`);

        let messageQueue;

        try {
          messageQueue = new MessageQueue(message, this.queueService);
        } catch (error) {
          this.ack(message);

          throw error;
        }

        await this.processMessage(messageQueue);

        this.logger.info(`[Subscriber ${subscriptionIndex}] Done processing message: ${JSON.stringify(messageQueue.content)}`);
      })
      .catch((error) => {
        this.logger.error(`[Subscriber ${subscriptionIndex}] Error when processing message: ${message.data.toString()}. Error: ${error.message || JSON.stringify(error.stack)}`);
      });
  }

  /**
   * Spawn a new subscriber, start polling for messages, and process them to modify the metric.
   *
   * @param {PollConfig} config
   * @param {number} subscriptionIndex
   *
   * @return {Promise<Subscription>}
   */
  async createSubscription(config: PollConfig, subscriptionIndex: number): Promise<Subscription> {
    const subscriptionConfig = {
      flowControl: {
        maxMessages: _.defaultTo(config.concurrency, 1),
        allowExcessMessages: false
      }
    };

    const subscription = this.client.subscription(this.subscriptionName, {
      ...config.additionalConfig,
      ...subscriptionConfig
    });

    subscription.on('error', config.onError);
    subscription.on('message', (message) => this.processMessageWithErrorHandling(message, subscriptionIndex));

    return subscription;
  }

  /**
   * Spawn subscribers and start polling for messages.
   * The subscriber will keep polling for messages from queue and process
   * them to modify the metric.
   */
  async poll(): Promise<void> {
    const config = _.defaults(this.pollConfig, this.getDefaultPollConfig());

    const consumerCount = _.defaultTo(config.consumerCount, 1);

    if (this.subscriptions.length > 0) {
      await this.close();
    }

    await Bluebird.mapSeries(_.range(consumerCount), async (idx) => {
      const subscriptionIndex = idx + 1;

      this.logger.info(`[Subscriber ${subscriptionIndex}] Creating subscriber ${this.subscriptionName}`);

      const subscription = await this.createSubscription(config, subscriptionIndex);

      this.subscriptions.push(subscription);
    });
  }

  /**
   * Acknowledge the message.
   *
   * @param {Message} message
   */
  ack(message: Message): void {
    message.ack();
  }

  /**
   * Unacknowledge the message.
   *
   * @param {Message} message
   */
  nack(message: Message): void {
    message.nack();
  }

  /**
   * Close the subscribers from polling. If numberOfSubscription parameter
   * is not passed, will stop all of the subscribers.
   *
   * @param {number} numberOfSubscription
   */
  async close(numberOfSubscription?: number): Promise<void> {
    const subscriptionLength = this.subscriptions.length;

    const numberOfClosedSubscription = Math.min(_.defaultTo(numberOfSubscription, subscriptionLength), subscriptionLength);

    for (let i = 0; i < numberOfClosedSubscription; i++) {
      const subscription = this.subscriptions[0];

      await subscription.close();

      this.subscriptions.shift();
    }
  }
}

export = GooglePubSub;
