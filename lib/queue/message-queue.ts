import QueueService from '../enum/queue-service';

import UnsupportedQueueServiceError from '../error/unsupported-queue-service-error';

class MessageQueue {
  /**
   * Content parsed from incoming message.
   */
  content: object;

  /**
   * Incoming message instance.
   */
  instance: any;

  /**
   * Queue service name.
   */
  private readonly queueService: QueueService;

  constructor(messageInstance: any, queueService: QueueService) {
    this.queueService = queueService;
    this.instance = messageInstance;

    if (queueService === QueueService.GooglePubSub) {
      this.content = JSON.parse(messageInstance.data.toString());
    } else if (queueService === QueueService.AWS) {
      this.content = JSON.parse(messageInstance.Body);
    } else {
      throw new UnsupportedQueueServiceError(`Queue service ${queueService} is not supported.`);
    }
  }
}

export = MessageQueue;
