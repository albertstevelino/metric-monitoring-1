import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import QueueService = require('../../lib/enum/queue-service');

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class UnsupportedQueueServiceErrorStub extends TypeError {
  message: string;
  options: object;
  name: string = 'UnsupportedQueueServiceError';

  constructor(message: string, options: object = {}) {
    super(message);

    this.options = options;
  }
}

describe('MessageQueue', () => {
  const MessageQueue = proxyquire.noCallThru()('../../lib/queue/message-queue.js', {
    '../error/unsupported-queue-service-error': UnsupportedQueueServiceErrorStub
  });

  const sandbox = sinon.createSandbox();

  let messageQueue: typeof MessageQueue;

  afterEach(() => sandbox.restore());

  describe('constructor', () => {
    it('should parse Google PubSub message content', () => {
      messageQueue = new MessageQueue({
        data: Buffer.from('{"a":"a"}', 'utf8')
      }, QueueService.GooglePubSub);

      expect(messageQueue.content).to.be.deep.equal({
        a: 'a'
      });
    });

    it('should parse AWS SQS message content', () => {
      messageQueue = new MessageQueue({
        Body: JSON.stringify({
          a: 'a'
        })
      }, QueueService.AWS);

      expect(messageQueue.content).to.be.deep.equal({
        a: 'a'
      });
    });

    it('should throw UnsupportedQueueServiceError', () => {
      let error;

      try {
        messageQueue = new MessageQueue({
          Body: JSON.stringify({
            a: 'a'
          })
        }, 'UNKNOWN');
      } catch (e) {
        error = e;
      }

      expect(error).to.be.instanceOf(UnsupportedQueueServiceErrorStub);
    });
  });
});
