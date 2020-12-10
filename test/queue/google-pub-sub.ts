import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import QueueService = require('../../lib/enum/queue-service');

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class SubscriptionStub {
  on(...args: Array<any>) {
  }

  close() {
  }
}

class PubSubStub {
  subscription(...args: Array<any>) {
    return new SubscriptionStub();
  }
}

class MessageStub {
  data: any;
  content: any;

  constructor(message: any, content?: any) {
    this.data = message;
    this.content = content;
  }

  ack() {
  }

  nack() {
  }
}

class LoggerStub {
  error() {
  }

  info() {
  }
}

class QueueStub {
  logger: LoggerStub;
  pollConfig: object;

  constructor({ logger, pollConfig }) {
    this.logger = logger;
    this.pollConfig = pollConfig;
  }

  processMessage(...args: Array<any>) {
  }
}

class MessageQueueStub {
  message; any;

  constructor(message: any, queueService: QueueService) {
    this.message = message.content.toString();
  }
}

describe('GooglePubSub', () => {
  const GooglePubSub = proxyquire.noCallThru()('../../lib/queue/google-pub-sub.js', {
    '@google-cloud/pubsub': {
      PubSub: PubSubStub,
      Subscription: SubscriptionStub,
      Message: MessageStub
    },
    './queue': QueueStub,
    './message-queue': MessageQueueStub
  });

  const sandbox = sinon.createSandbox();

  let queue: typeof GooglePubSub;

  afterEach(() => sandbox.restore());

  describe('constructor', () => {
    it('should set initial properties', () => {
      queue = new GooglePubSub({
        subscriptionName: 'subscription-name'
      });

      expect(queue.client).to.be.instanceOf(PubSubStub);
      expect(queue.subscriptions.length).to.be.equal(0);
      expect(queue.subscriptionName).to.be.equal('subscription-name');
    });
  });

  describe('getDefaultPollConfig', () => {
    it('should return default error', () => {
      const logger = new LoggerStub();

      const errorStub = sandbox.stub(logger, 'error');

      queue = new GooglePubSub({
        subscriptionName: 'subscription-name',
        logger
      });

      const config = queue.getDefaultPollConfig();

      expect(config).to.have.property('onError');
      config.onError('error message');
      expect(errorStub.args.length).to.be.equal(1);

      expect(config).to.have.property('additionalConfig');
      expect(config.additionalConfig).to.be.deep.equal({
        ackDeadline: 300
      })
    });
  });

  describe('processMessageWithErrorHandling', () => {
    it('should call process message', async () => {
      const processMessageStub = sandbox.stub(QueueStub.prototype, 'processMessage');

      const logger = new LoggerStub();

      const errorStub = sandbox.stub(logger, 'error');

      queue = new GooglePubSub({
        subscriptionName: 'subscription-name',
        logger
      });

      await queue.processMessageWithErrorHandling(new MessageStub({}, {}), 0);

      expect(processMessageStub.args.length).to.be.equal(1);
      expect(processMessageStub.args[0][0]).to.be.instanceOf(MessageQueueStub);
      expect(errorStub.args.length).to.be.equal(0);
    });

    it('should call ack', async () => {
      const processMessageStub = sandbox.stub(QueueStub.prototype, 'processMessage');

      const logger = new LoggerStub();

      const errorStub = sandbox.stub(logger, 'error');

      queue = new GooglePubSub({
        subscriptionName: 'subscription-name',
        logger
      });

      const ackStub = sandbox.stub(queue, 'ack');

      await queue.processMessageWithErrorHandling(new MessageStub({}), 0);

      expect(processMessageStub.args.length).to.be.equal(0);
      expect(errorStub.args.length).to.be.equal(1);
      expect(ackStub.args.length).to.be.equal(1);
      expect(ackStub.args[0][0]).to.be.instanceOf(MessageStub);
    });

    it('should not call ack when error in process message', async () => {
      const processMessageStub = sandbox.stub(QueueStub.prototype, 'processMessage')
        .throws(() => {
          throw new Error();
        });

      const logger = new LoggerStub();

      const errorStub = sandbox.stub(logger, 'error');

      queue = new GooglePubSub({
        subscriptionName: 'subscription-name',
        logger
      });

      const ackStub = sandbox.stub(queue, 'ack');

      await queue.processMessageWithErrorHandling(new MessageStub({}, {}), 0);

      expect(processMessageStub.args.length).to.be.equal(1);
      expect(errorStub.args.length).to.be.equal(1);
      expect(ackStub.args.length).to.be.equal(0);
    });
  });

  describe('createSubscription', () => {
    it('should create subscription', async () => {
      sandbox.stub(SubscriptionStub.prototype, 'on')
        .callsFake((event: string, callback: Function) => {
          callback();
        });

      queue = new GooglePubSub({
        subscriptionName: 'subscription-name'
      });

      const processMessageStub = sandbox.stub(queue, 'processMessageWithErrorHandling');

      await queue.createSubscription({
        onError: () => false
      }, 0);

      expect(processMessageStub.args.length).to.be.equal(1);
    });
  });

  describe('poll', () => {
    it('should close existing subscribers before spawning the new ones', async () => {
      queue = new GooglePubSub({
        subscriptionName: 'subscription-name',
        pollConfig: {
          consumerCount: 5
        },
        logger: new LoggerStub()
      });

      queue.subscriptions = [
        new SubscriptionStub(),
        new SubscriptionStub()
      ];

      const closeStub = sandbox.stub(queue, 'close');
      const createSubscriptionStub = sandbox.stub(queue, 'createSubscription');

      await queue.poll();

      expect(closeStub.args.length).to.be.equal(1);
      expect(createSubscriptionStub.args.length).to.be.equal(5);
    });

    it('should directly spawn the new subscribers', async () => {
      queue = new GooglePubSub({
        subscriptionName: 'subscription-name',
        pollConfig: {
          consumerCount: 5
        },
        logger: new LoggerStub()
      });

      const closeStub = sandbox.stub(queue, 'close');
      const createSubscriptionStub = sandbox.stub(queue, 'createSubscription');

      await queue.poll();

      expect(closeStub.args.length).to.be.equal(0);
      expect(createSubscriptionStub.args.length).to.be.equal(5);
    });
  });

  describe('ack', () => {
    it('should ack message', async () => {
      queue = new GooglePubSub({
        subscriptionName: 'subscription-name',
        pollConfig: {
          consumerCount: 5
        },
        logger: new LoggerStub()
      });

      const message = new MessageStub({}, {});

      const ackStub = sandbox.stub(message, 'ack');

      queue.ack(message);

      expect(ackStub.args.length).to.be.equal(1);
    });
  });

  describe('nack', () => {
    it('should nack message', async () => {
      queue = new GooglePubSub({
        pollConfig: {
          consumerCount: 5
        },
        subscriptionName: 'subscription-name',
        logger: new LoggerStub()
      });

      const message = new MessageStub({}, {});

      const nackStub = sandbox.stub(message, 'nack');

      queue.nack(message);

      expect(nackStub.args.length).to.be.equal(1);
    });
  });

  describe('close', async () => {
    it('should close all of the subscribers', async () => {
      const closeStub = sandbox.stub(SubscriptionStub.prototype, 'close');

      queue = new GooglePubSub({
        pollConfig: {
          consumerCount: 3
        },
        subscriptionName: 'subscription-name',
        logger: new LoggerStub()
      });

      queue.subscriptions = [
        new SubscriptionStub(),
        new SubscriptionStub(),
        new SubscriptionStub()
      ];

      await queue.close();

      expect(closeStub.args.length).to.be.equal(3);
      expect(queue.subscriptions.length).to.be.equal(0);
    });

    it('should close several subscribers', async () => {
      const closeStub = sandbox.stub(SubscriptionStub.prototype, 'close');

      queue = new GooglePubSub({
        pollConfig: {
          consumerCount: 3
        },
        subscriptionName: 'subscription-name',
        logger: new LoggerStub()
      });

      queue.subscriptions = [
        new SubscriptionStub(),
        new SubscriptionStub(),
        new SubscriptionStub()
      ];

      await queue.close(1);

      expect(closeStub.args.length).to.be.equal(1);
      expect(queue.subscriptions.length).to.be.equal(2);
    });

    it('should not error if number of closed subscribers passed is bigger than the actual number of subscribers', async () => {
      const closeStub = sandbox.stub(SubscriptionStub.prototype, 'close');

      queue = new GooglePubSub({
        pollConfig: {
          consumerCount: 3
        },
        subscriptionName: 'subscription-name',
        logger: new LoggerStub()
      });

      queue.subscriptions = [
        new SubscriptionStub(),
        new SubscriptionStub(),
        new SubscriptionStub()
      ];

      await queue.close(999);

      expect(closeStub.args.length).to.be.equal(3);
      expect(queue.subscriptions.length).to.be.equal(0);
    });
  });
});
