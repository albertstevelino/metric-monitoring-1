import _ from 'lodash';
import Bluebird from 'bluebird';
import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import QueueService = require('../../lib/enum/queue-service');

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class DelayerStub {
  startingDelay: number;
  calculateNextDelay: Function;
  maximumDelay: number;
  currentDelay: number;

  constructor(startingDelay: number, calculateNextDelay: Function, maximumDelay: number) {
    this.startingDelay = startingDelay;
    this.currentDelay = startingDelay;
    this.calculateNextDelay = calculateNextDelay;
    this.maximumDelay = maximumDelay;
  }

  reset() {
  }

  delay() {
  }

  nextDelay() {
    return this.calculateNextDelay(this.currentDelay);
  }
}

class QueueStub {
  logger: any;
  pollConfig: any;

  constructor({ logger, pollConfig }) {
    this.logger = logger;
    this.pollConfig = pollConfig;
  }

  processMessage(...args: Array<any>) {
  }
}

class SQSStub {
  receiveMessage(...args: Array<any>) {
  }

  deleteMessage(...args: Array<any>) {
  }
}

class LoggerStub {
  info() {
  }

  error() {
  }
}

class MessageQueueStub {
  message: any;
  queueService: QueueService;

  constructor(message: any, queueService: QueueService) {
    this.message = JSON.parse(message);
    this.queueService = queueService;
  }
}

class PromiseRunnerStub {
  task: Function;

  constructor(task: Function) {
    this.task = task;
  }

  while(func: Function) {
    return func();
  }
}

describe('AWSQueue', () => {
  const AWSStub = {
    config: {
      setPromisesDependency: _.identity
    },
    SQS: SQSStub
  };

  const PollConfig = proxyquire.noCallThru()('../../lib/interface/poll-config.js', {
    '../common/delayer': DelayerStub
  });

  const AWSQueue = proxyquire.noCallThru()('../../lib/queue/aws-queue.js', {
    '../common/delayer': DelayerStub,
    './queue': QueueStub,
    'aws-sdk': AWSStub,
    './message-queue': MessageQueueStub,
    '../interface/poll-config': PollConfig,
    'bluebird': Bluebird,
    '../common/promise-runner': PromiseRunnerStub
  });

  const sandbox = sinon.createSandbox();

  let queue: typeof AWSQueue;

  afterEach(() => sandbox.restore());

  describe('getDefaultPollConfig', () => {
    it('should return default config', () => {
      const defaultConfig: {
        [key: string]: any
      } = AWSQueue.getDefaultPollConfig();

      defaultConfig.delayer.delay();

      expect(defaultConfig).to.have.property('delayer');
      expect(defaultConfig.delayer).to.be.instanceOf(DelayerStub);
      expect(defaultConfig.delayer.nextDelay()).to.be.equal(2000);
      expect(defaultConfig).to.have.property('additionalConfig');
      expect(defaultConfig.additionalConfig).to.be.deep.equal({
        VisibilityTimeout: 300,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 10
      })
    });
  });

  describe('constructor', () => {
    it('should initialize the properties correctly', () => {
      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom'
      });

      expect(queue.queueUrl).to.be.equal('https://www.queue-url.com/dev_playroom');
      expect(queue.client).to.be.instanceOf(SQSStub);
      expect(queue.pollingStatuses).to.be.deep.equal([]);
    });
  });

  describe('createTask', () => {
    it('should construct message queue from message when messages are not empty', async () => {
      sandbox.stub(SQSStub.prototype, 'receiveMessage')
        .returns({
          promise: () => {
            return {
              Messages: [
                '{"a":"a"}',
                '{"b":"b"}'
              ]
            }
          }
        });

      const processMessageStub = sandbox.stub(QueueStub.prototype, 'processMessage');

      sandbox.stub(queue, 'ack');

      const logger = new LoggerStub();

      sandbox.stub(logger, 'error');

      const delayer = new DelayerStub(1000, _.identity, 5000);

      const delayerResetStub = sandbox.stub(delayer, 'reset');
      const delayerDelayStub = sandbox.stub(delayer, 'delay');

      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger
      });

      const task: Function = queue.createTask({
        delayer
      }, 0);

      await task();

      expect(processMessageStub.args[0][0]).to.be.instanceOf(MessageQueueStub);
      expect(processMessageStub.args[0][0].message).to.be.deep.equal({
        a: 'a'
      });
      expect(processMessageStub.args[1][0]).to.be.instanceOf(MessageQueueStub);
      expect(processMessageStub.args[1][0].message).to.be.deep.equal({
        b: 'b'
      });

      expect(delayerResetStub.args.length).to.be.equal(1);
      expect(delayerDelayStub.args.length).to.be.equal(1);
    });

    it('should ack message if error when constructing message queue', async () => {
      sandbox.stub(SQSStub.prototype, 'receiveMessage')
        .returns({
          promise: () => {
            return {
              Messages: [
                '{"a":"a"}',
                {
                  b: 'b'
                }
              ]
            }
          }
        });

      const processMessageStub = sandbox.stub(QueueStub.prototype, 'processMessage');

      processMessageStub
        .onCall(0)
        .throws(() => {
          throw new Error();
        });

      const logger = new LoggerStub();

      const errorStub = sandbox.stub(logger, 'error');

      const delayer = new DelayerStub(1000, _.identity, 5000);

      const delayerResetStub = sandbox.stub(delayer, 'reset');
      const delayerDelayStub = sandbox.stub(delayer, 'delay');

      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger
      });

      const ackStub = sandbox.stub(queue, 'ack');

      const task: Function = queue.createTask({
        delayer
      }, 0);

      await task();

      expect(processMessageStub.args[0][0]).to.be.instanceOf(MessageQueueStub);
      expect(processMessageStub.args[0][0].message).to.be.deep.equal({
        a: 'a'
      });
      expect(ackStub.args[0][0]).to.be.deep.equal({
        b: 'b'
      });

      expect(ackStub.args.length).to.be.equal(1);
      expect(processMessageStub.args.length).to.be.equal(1);
      expect(errorStub.args.length).to.be.equal(2);
      expect(delayerResetStub.args.length).to.be.equal(1);
      expect(delayerDelayStub.args.length).to.be.equal(1);
    });

    it('should not reset delayer if message length equal to 0', async () => {
      sandbox.stub(SQSStub.prototype, 'receiveMessage')
        .returns({
          promise: () => {
            return {}
          }
        });

      const processMessageStub = sandbox.stub(QueueStub.prototype, 'processMessage');

      const logger = new LoggerStub();

      const errorStub = sandbox.stub(logger, 'error');

      const delayer = new DelayerStub(1000, _.identity, 5000);

      const delayerResetStub = sandbox.stub(delayer, 'reset');
      const delayerDelayStub = sandbox.stub(delayer, 'delay');

      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger
      });

      const ackStub = sandbox.stub(queue, 'ack');

      const task: Function = queue.createTask({
        delayer
      }, 0);

      await task();

      expect(processMessageStub.args.length).to.be.equal(0);
      expect(errorStub.args.length).to.be.equal(0);
      expect(ackStub.args.length).to.be.equal(0);
      expect(delayerResetStub.args.length).to.be.equal(0);
      expect(delayerDelayStub.args.length).to.be.equal(1);
    });
  });

  describe('poll', async () => {
    it('should clean all existing consumers before spawning new consumers', async () => {
      const delayStub = sandbox.stub(Bluebird, 'delay');
      sandbox.stub(AWSQueue, 'getDefaultPollConfig')
        .returns({
          additionalConfig: {
            VisibilityTimeout: 1000
          }
        });

      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger: new LoggerStub(),
        pollConfig: {
          delayer: new DelayerStub(1000, _.identity, 5000),
          consumerCount: 5
        }
      });

      const closeStub = sandbox.stub(queue, 'close');
      const createTaskStub = sandbox.stub(queue, 'createTask');

      queue.pollingStatuses = [true, true, true];

      await queue.poll();

      expect(queue.pollingStatuses).to.be.deep.equal([
        true,
        true,
        true,
        true,
        true
      ]);
      expect(delayStub.args[0][0]).to.be.equal(35000);
      expect(createTaskStub.args.length).to.be.equal(5);
      expect(closeStub.args.length).to.be.equal(1);
    });

    it('should not call delay if the initial polling statuses is empty', async () => {
      const delayStub = sandbox.stub(Bluebird, 'delay');
      sandbox.stub(AWSQueue, 'getDefaultPollConfig')
        .returns({
          additionalConfig: {
            VisibilityTimeout: 1000
          }
        });

      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger: new LoggerStub(),
        pollConfig: {
          delayer: new DelayerStub(1000, _.identity, 5000),
          consumerCount: 5
        }
      });

      sandbox.stub(queue, 'close');
      const createTaskStub = sandbox.stub(queue, 'createTask');

      await queue.poll();

      expect(queue.pollingStatuses).to.be.deep.equal([
        true,
        true,
        true,
        true,
        true
      ]);
      expect(delayStub.args.length).to.be.equal(0);
      expect(createTaskStub.args.length).to.be.equal(5);
    });
  });

  describe('ack', async () => {
    it('should delete message', async () => {
      const deleteMessageStub = sandbox.stub(SQSStub.prototype, 'deleteMessage')
        .returns({
          promise: () => {}
        });

      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger: new LoggerStub()
      });

      await queue.ack({});

      expect(deleteMessageStub.args.length).to.be.equal(1);
    });
  });

  describe('nack', async () => {
    it('should do nothing', async () => {
      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger: new LoggerStub()
      });

      queue.nack({});
    });
  });

  describe('close', async () => {
    it('should close all of the consumers', async () => {
      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger: new LoggerStub()
      });

      queue.pollingStatuses = [true, true, true];

      queue.close();

      expect(queue.pollingStatuses.length).to.be.equal(0);
    });

    it('should close several consumers', async () => {
      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger: new LoggerStub()
      });

      queue.pollingStatuses = [true, true, true, true, true];

      queue.close(3);

      expect(queue.pollingStatuses.length).to.be.equal(2);
    });

    it('should not error if number of closed consumers passed is bigger than the actual number of consumers', async () => {
      queue = new AWSQueue({
        queuePrefixUrl: 'https://www.queue-url.com/',
        subscriptionName: 'dev_playroom',
        logger: new LoggerStub()
      });

      queue.pollingStatuses = [true, true, true, true, true];

      queue.close(999);

      expect(queue.pollingStatuses.length).to.be.equal(0);
    });
  });
});
