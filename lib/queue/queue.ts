import { Observable } from 'rxjs';

import QueueConfig from '../interface/queue-config';
import PollConfig from '../interface/poll-config';

import QueueService from '../enum/queue-service';

import MessageQueue from './message-queue';
import Metric from '../metric/metric';
import Logger from '../common/logger';

abstract class Queue {
  /**
   * Queue service name.
   */
  readonly queueService: QueueService;

  /**
   * Config to poll from queue.
   */
  readonly pollConfig: PollConfig;

  /**
   * Array of metrics that will be modified according to the message received.
   */
  readonly metrics: Array<Metric>;

  /**
   * Logger to print to console.
   */
  readonly logger: Logger;

  protected constructor(config: QueueConfig) {
    this.metrics = [];
    this.queueService = config.queueService;
    this.pollConfig = config.pollConfig;
    this.logger = config.logger;

    for (const metricConfig of config.metricConfigs) {
      const metric = new Metric({
        ...metricConfig,
        metricByName: config.metricByName,
        logger: this.logger
      });

      this.metrics.push(metric);
    }
  }

  abstract poll(): Promise<void>|void;
  abstract ack(message: any): Promise<void>|void;
  abstract nack(message: any): Promise<void>|void;
  abstract close(number?: number): Promise<void>|void;

  /**
   * Process message by modifying prometheus metrics according to the message content
   * and acknowledge it.
   *
   * @param {MessageQueue} message
   */
  processMessage(message: MessageQueue): Promise<void>|void {
    const observer = new Observable((subscriber) => {
      subscriber.next(message.content);

      this.ack(message.instance);
    });

    for (const metric of this.metrics) {
      observer.subscribe((messageContent) => {
        metric.modify(messageContent as {
          [key: string]: any
        });
      });
    }
  }
}

export = Queue;
