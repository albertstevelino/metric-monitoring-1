import _ from 'lodash';
import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import Bluebird from 'bluebird';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class AWSQueueStub {
  poll() {
  }

  close() {
  }
}

class GooglePubSubStub {
  poll() {
  }

  close() {
  }
}

class QueueStub {
}

class MetricStub {
  static validateMetricConfig() {
  }
}

class LoggerStub {
  error() {
  }

  info() {
  }
}

class ServerStub {
  listen() {
  }
}

class UnsupportedQueueServiceErrorStub extends TypeError {
  message: string;
  options: object;
  name: string = 'UnsupportedQueueServiceError';

  constructor(message: string, options: {
    [key: string]: any
  } = {}) {
    super(message);

    this.options = options;
  }
}

class ValidationErrorStub extends Error {
  message: string;
  options: object;
  name: string = 'ValidationError';

  constructor(message: string, options: {
    [key: string]: any
  } = {}) {
    super(message);

    this.options = options;
  }
}

describe('Orchestrator', () => {
  const satpamStub = {
    validate: _.noop
  };

  const expressStub = {
    initiate: _.noop
  };

  const registerStub = {
    metrics: _.noop
  };

  const resStub = {
    send: _.noop,
    set: _.noop
  };

  const Orchestrator = proxyquire.noCallThru()('../lib/orchestrator.js', {
    './queue/aws-queue': AWSQueueStub,
    './queue/google-pub-sub': GooglePubSubStub,
    './queue/queue': QueueStub,
    './metric/metric': MetricStub,
    './common/logger': LoggerStub,
    './error/unsupported-queue-service-error': UnsupportedQueueServiceErrorStub,
    'satpam': satpamStub,
    'express': () => expressStub.initiate(),
    'prom-client': {
      register: registerStub
    },
    'http': {
      Server: ServerStub
    },
    './error/validation-error': ValidationErrorStub
  });

  const sandbox = sinon.createSandbox();

  let orchestrator: typeof Orchestrator;

  afterEach(() => sandbox.restore());

  describe('getAllFilePaths', () => {
    it('should get all file paths', () => {
      return expect(Orchestrator.getAllFilePaths('test/resource')).to.eventually.be.deep.equal([
        'test/resource/aws/spec-example-2.json',
        'test/resource/google-pub-sub/spec-example-1.json'
      ]);
    });
  });

  describe('getAllSpecificationsFromPaths', () => {
    it('should read all of the specifications', () => {
      sandbox.stub(Orchestrator, 'getAllFilePaths')
        .callsFake((directoryPath) => {
          if (directoryPath === 'test/resource') {
            return [
              'test/resource/aws/spec-example-2.json',
              'test/resource/google-pub-sub/spec-example-1.json'
            ];
          } else {
            return [];
          }
        });

      return expect(Orchestrator.getAllSpecificationsFromPaths({
        filePaths: [
          'test/resource/aws/spec-example-2.json'
        ],
        directoryPaths: [
          'test/resource'
        ]
      })).to.eventually.be.deep.equal([
        {
          filePath: 'test/resource/aws/spec-example-2.json',
          service: 'AWS'
        },
        {
          filePath: 'test/resource/aws/spec-example-2.json',
          service: 'AWS'
        },
        {
          filePath: 'test/resource/google-pub-sub/spec-example-1.json',
          service: 'GOOGLE_PUB_SUB'
        }
      ]);
    });
  });

  describe('validateSpecification', () => {
    it('should return first layer validation message', () => {
      sandbox.stub(satpamStub, 'validate')
        .returns({
          success: false,
          messages: {
            a: 'a'
          }
        });

      sandbox.stub(MetricStub, 'validateMetricConfig')
        .returns({});

      expect(Orchestrator.validateSpecification({
        metrics: [{}, {}, {}]
      })).to.be.deep.equal({
        a: 'a'
      });
    });

    it('should return first layer and metric validation message', () => {
      sandbox.stub(satpamStub, 'validate')
        .returns({
          success: false,
          messages: {
            metrics: {
              required: 'This field is required'
            }
          }
        });

      sandbox.stub(MetricStub, 'validateMetricConfig')
        .returns({
          b: 'b'
        });

      expect(Orchestrator.validateSpecification({
        metrics: [{}]
      })).to.be.deep.equal({
        metrics: {
          required: 'This field is required',
          elementOfArray: {
            0: {
              b: 'b'
            }
          }
        }
      });
    });
  });

  describe('extractServiceNamesFromSpecifications', () => {
    it('should extract service names from specifications correctly', () => {
      return expect(Orchestrator.extractServiceNamesFromSpecifications([
        {
          service: 'AWS'
        },
        {
          service: 'AWS'
        },
        {
          service: 'GOOGLE_PUB_SUB'
        },
        {
          service: 'GOOGLE_PUB_SUB'
        }
      ])).to.be.deep.equal([
        'AWS',
        'GOOGLE_PUB_SUB'
      ])
    });
  });

  describe('getQueue', () => {
    it('should return AWSQueue', () => {
      orchestrator = new Orchestrator({});

      expect(orchestrator.getQueue({
        service: 'AWS'
      })).to.be.instanceOf(AWSQueueStub);
    });

    it('should return GooglePubSub', () => {
      orchestrator = new Orchestrator({});

      expect(orchestrator.getQueue({
        service: 'GOOGLE_PUB_SUB'
      })).to.be.instanceOf(GooglePubSubStub);
    });

    it('should return UnsupportedQueueServiceError', () => {
      orchestrator = new Orchestrator({});

      expect(orchestrator.getQueue.bind(orchestrator,{
        service: 'RANDOM'
      })).to.throw(UnsupportedQueueServiceErrorStub);
    });
  });

  describe('validateCredential', () => {
    it('should return validation messages', () => {
      sandbox.stub(satpamStub, 'validate')
        .returns({
          success: false,
          messages: {
            a: 'a'
          }
        });

      orchestrator = new Orchestrator({
        AWS: {
          queuePrefixUrl: 'https://queue.com',
          accessKeyId: '1234',
          secretAccessKey: '1234'
        }
      });

      expect(orchestrator.validateCredential([
        'AWS',
        'GOOGLE_PUB_SUB'
      ])).to.be.deep.equal({
        a: 'a'
      });
    });
  });

  describe('registerQueue', () => {
    it('should push queue to the queue collection', () => {
      orchestrator = new Orchestrator({});

      sandbox.stub(orchestrator, 'getQueue')
        .returns(new AWSQueueStub());

      orchestrator.registerQueue({});

      expect(orchestrator.queues.length).to.be.equal(1);
      expect(orchestrator.queues[0]).to.be.instanceOf(AWSQueueStub);
    });
  });

  describe('startQueues', () => {
    it('should poll every queue in queue collection', async () => {
      const awsPollStub = sandbox.stub(AWSQueueStub.prototype, 'poll');
      const pubsubPollStub = sandbox.stub(GooglePubSubStub.prototype, 'poll');

      orchestrator = new Orchestrator({});
      orchestrator.queues = [
        new AWSQueueStub(),
        new AWSQueueStub(),
        new GooglePubSubStub(),
        new GooglePubSubStub()
      ];

      await orchestrator.startQueues();

      expect(awsPollStub.args.length).to.be.equal(2);
      expect(pubsubPollStub.args.length).to.be.equal(2);
    });

    it('should stop all queues if one of the queues is error when polling', async () => {
      sandbox.stub(AWSQueueStub.prototype, 'poll');
      sandbox.stub(GooglePubSubStub.prototype, 'poll')
        .usingPromise(Bluebird)
        .rejects(new Error());
      const errorStub = sandbox.stub(LoggerStub.prototype, 'error');

      orchestrator = new Orchestrator({});
      orchestrator.queues = [
        new AWSQueueStub(),
        new AWSQueueStub(),
        new GooglePubSubStub(),
        new GooglePubSubStub()
      ];

      const stopQueuesStub = sandbox.stub(orchestrator, 'stopQueues');

      let error;

      try {
        await orchestrator.startQueues();
      } catch (e) {
        error = e;
      }

      expect(error).to.be.instanceof(Error);
      expect(errorStub.args.length > 0).to.be.equal(true);
      expect(stopQueuesStub.args.length).to.be.equal(1);
    });
  });

  describe('stopQueues', () => {
    it('should stop all queues', async () => {
      const awsCloseStub = sandbox.stub(AWSQueueStub.prototype, 'close');
      const pubsubCloseStub = sandbox.stub(GooglePubSubStub.prototype, 'close');

      orchestrator = new Orchestrator({});

      orchestrator.queues = [
        new AWSQueueStub(),
        new GooglePubSubStub()
      ];

      await orchestrator.stopQueues();

      expect(awsCloseStub.args.length).to.be.equal(1);
      expect(pubsubCloseStub.args.length).to.be.equal(1);
    });
  });

  describe('register', () => {
    it('should return error message from credential validation', async () => {
      sandbox.stub(Orchestrator, 'getAllSpecificationsFromPaths')
        .returns([
          {
            filePath: '1'
          },
          {
            filePath: '2'
          }
        ]);
      sandbox.stub(Orchestrator, 'validateSpecification')
        .returns({
          b: 'b'
        });
      sandbox.stub(Orchestrator, 'extractServiceNamesFromSpecifications');
      sandbox.stub(Orchestrator.prototype, 'validateCredential')
        .returns({
          a: 'a'
        });

      orchestrator = new Orchestrator({});

      let error;

      try {
        await orchestrator.register({});
      } catch (e) {
        error = e;
      }

      expect(error).to.be.instanceOf(ValidationErrorStub);
      expect(error.options).to.be.deep.equal({
        message: {
          a: 'a'
        }
      });
    });

    it('should return error message from specification validations', async () => {
      sandbox.stub(Orchestrator, 'getAllSpecificationsFromPaths')
        .returns([
          {
            filePath: '1'
          },
          {
            filePath: '2'
          }
        ]);
      sandbox.stub(Orchestrator, 'validateSpecification')
        .onCall(0)
        .returns({})
        .onCall(1)
        .returns({
          b: 'b'
        });
      sandbox.stub(Orchestrator, 'extractServiceNamesFromSpecifications');
      sandbox.stub(Orchestrator.prototype, 'validateCredential')
        .returns({});

      orchestrator = new Orchestrator({});

      let error;

      try {
        await orchestrator.register({});
      } catch (e) {
        error = e;
      }

      expect(error).to.be.instanceOf(ValidationErrorStub);
      expect(error.options).to.be.deep.equal({
        messages: [
          {
            filePath: '2',
            message: {
              b: 'b'
            }
          }
        ]
      })
    });

    it('should register queue for each specifications', async () => {
      sandbox.stub(Orchestrator, 'getAllSpecificationsFromPaths')
        .returns([
          {
            filePath: '1'
          },
          {
            filePath: '2'
          }
        ]);
      sandbox.stub(Orchestrator, 'validateSpecification');
      sandbox.stub(Orchestrator, 'extractServiceNamesFromSpecifications');
      sandbox.stub(Orchestrator.prototype, 'validateCredential');
      const registerQueueStub = sandbox.stub(Orchestrator.prototype, 'registerQueue');

      orchestrator = new Orchestrator({});

      await orchestrator.register({});

      expect(registerQueueStub.args.length).to.be.equal(2);
      expect(registerQueueStub.args[0][0]).to.be.deep.equal({
        filePath: '1'
      });
      expect(registerQueueStub.args[1][0]).to.be.deep.equal({
        filePath: '2'
      });
    });
  });

  describe('start', () => {
    it('should start port', async () => {
      const listenStub = sandbox.stub(ServerStub.prototype, 'listen')
        .callsFake((port, callback) => callback());

      sandbox.stub(registerStub, 'metrics')
        .returns('metrics');

      const sendStub = sandbox.stub(resStub, 'send');

      sandbox.stub(expressStub, 'initiate')
        .returns({
          get: async (url, callback) => await callback({}, resStub)
        });

      orchestrator = new Orchestrator({});

      await orchestrator.start('1234', 'https://google.com');

      expect(listenStub.args.length).to.be.equal(1);
      expect(sendStub.args.length).to.be.equal(1);
      expect(sendStub.args[0][0]).to.be.equal('metrics');
    });
  });
});
