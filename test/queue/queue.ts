import _ from 'lodash';
import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class MetricStub {
  modify(...args: Array<any>) {
  }
}

class ObservableStub {
  constructor(callback: Function) {
    callback({
      next: _.noop
    });
  }

  subscribe(...args: Array<any>) {
  }
}

class MessageQueueStub {
}

class LoggerStub {
}

describe('Queue', () => {
  const Queue = proxyquire.noCallThru()('../../lib/queue/queue.js', {
    '../metric/metric': MetricStub,
    'rxjs': {
      Observable: ObservableStub
    },
    './message-queue': MessageQueueStub,
    '../common/logger': LoggerStub
  });

  class AWSQueue extends Queue {
    constructor(config: any) {
      super(config);
    }

    poll() {
    }

    ack() {
    }

    nack() {
    }

    close() {
    }
  }

  const sandbox = sinon.createSandbox();

  let queue: typeof Queue;

  afterEach(() => sandbox.restore());

  describe('constructor', () => {
    it('should populate initial properties', () => {
      queue = new AWSQueue({
        metricConfigs: [{}, {}, {}]
      });

      expect(queue.metrics.length).to.be.equal(3);
      expect(queue.metrics[0]).to.be.instanceOf(MetricStub);
      expect(queue.metrics[1]).to.be.instanceOf(MetricStub);
      expect(queue.metrics[2]).to.be.instanceOf(MetricStub);
    });
  });

  describe('processMessage', () => {
    it('should modify all of the metrics', () => {
      const modifyStub = sandbox.stub(MetricStub.prototype, 'modify');

      const ackStub = sandbox.stub(AWSQueue.prototype, 'ack');

      sandbox.stub(ObservableStub.prototype, 'subscribe')
        .callsFake((callback) => {
          callback({});
        });

      queue = new AWSQueue({
        metricConfigs: [{}, {}, {}]
      });

      queue.processMessage(new MessageQueueStub());

      expect(modifyStub.args.length).to.be.equal(3);
      expect(ackStub.args.length).to.be.equal(1);
    });
  });
});
