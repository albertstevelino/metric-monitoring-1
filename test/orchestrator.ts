import _ from 'lodash';
import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import Bluebird from 'bluebird';

import MetricType from '../lib/enum/metric-type';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class CounterStub {
}

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

  static getPromMetric() {
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

class DuplicateMetricDeclarationErrorStub extends Error {
  message: string;
  options: object;
  name: string = 'DuplicateMetricDeclarationError';

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
    './error/duplicate-metric-declaration-error': DuplicateMetricDeclarationErrorStub,
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

  describe('validateMetricSpecification', () => {
    it('should return first layer validation message', () => {
      sandbox.stub(satpamStub, 'validate')
        .onCall(0)
        .returns({
          success: false,
          messages: {
            a: 'a'
          }
        })
        .onCall(1)
        .returns({
          success: true
        });

      expect(Orchestrator.validateMetricSpecification({
        metrics: [{}]
      })).to.be.deep.equal({
        a: 'a'
      });
    });

    it('should return first layer and metric validation message', () => {
      sandbox.stub(satpamStub, 'validate')
        .onCall(0)
        .returns({
          success: false,
          messages: {
            metrics: {
              required: 'This field is required'
            }
          }
        })
        .onCall(1)
        .returns({
          success: false,
          messages: {
            b: 'b'
          }
        });

      expect(Orchestrator.validateMetricSpecification({
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

  describe('validateQueueSpecification', () => {
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

      orchestrator = new Orchestrator({});

      expect(orchestrator.validateQueueSpecification({
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

      orchestrator = new Orchestrator({});

      expect(orchestrator.validateQueueSpecification({
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

  describe('registerMetric', () => {
    it('should throw DuplicateMetricDeclarationError', () => {
      sandbox.stub(MetricStub, 'getPromMetric')
        .returns(new CounterStub());

      orchestrator = new Orchestrator({});

      orchestrator.registerMetric({
        name: 'counter',
        help: 'counter_help',
        type: MetricType.Counter
      });

      expect(orchestrator.registerMetric.bind(orchestrator, {
        name: 'counter',
        help: 'counter_help',
        type: MetricType.Counter
      })).to.throw(DuplicateMetricDeclarationErrorStub);
    });

    it('should success', () => {
      sandbox.stub(MetricStub, 'getPromMetric')
        .returns(new CounterStub());

      orchestrator = new Orchestrator({});

      orchestrator.registerMetric({
        name: 'counter',
        help: 'counter_help',
        type: MetricType.Counter
      });

      expect(orchestrator.metricByName).to.have.property('counter');
    });
  });

  describe('register', () => {
    it('should success', async () => {
      const registerMetricsStub = sandbox.stub(Orchestrator.prototype, 'registerMetrics');
      const registerQueuesStub = sandbox.stub(Orchestrator.prototype, 'registerQueues');

      orchestrator = new Orchestrator({});

      await orchestrator.register({});

      expect(registerMetricsStub.args.length).to.be.equal(1);
      expect(registerQueuesStub.args.length).to.be.equal(1);
    });
  });

  describe('startQueues', () => {
    it('should poll every queue in queue collection', async () => {
      const awsPollStub = sandbox.stub(AWSQueueStub.prototype, 'poll');
      const pubsubPollStub = sandbox.stub(GooglePubSubStub.prototype, 'poll');
      sandbox.stub(Orchestrator.prototype, 'getQueue')
        .onCall(0)
        .returns(new AWSQueueStub())
        .onCall(1)
        .returns(new AWSQueueStub())
        .onCall(2)
        .returns(new GooglePubSubStub())
        .onCall(3)
        .returns(new GooglePubSubStub());

      orchestrator = new Orchestrator({});

      orchestrator.registerQueue({});
      orchestrator.registerQueue({});
      orchestrator.registerQueue({});
      orchestrator.registerQueue({});

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
      const stopQueuesStub = sandbox.stub(Orchestrator.prototype, 'stopQueues');
      sandbox.stub(Orchestrator.prototype, 'getQueue')
        .onCall(0)
        .returns(new AWSQueueStub())
        .onCall(1)
        .returns(new AWSQueueStub())
        .onCall(2)
        .returns(new GooglePubSubStub())
        .onCall(3)
        .returns(new GooglePubSubStub());

      orchestrator = new Orchestrator({});

      orchestrator.registerQueue({});
      orchestrator.registerQueue({});
      orchestrator.registerQueue({});
      orchestrator.registerQueue({});

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
      sandbox.stub(Orchestrator.prototype, 'getQueue')
        .onCall(0)
        .returns(new AWSQueueStub())
        .onCall(1)
        .returns(new GooglePubSubStub());

      orchestrator = new Orchestrator({});

      orchestrator.registerQueue({});
      orchestrator.registerQueue({});

      await orchestrator.stopQueues();

      expect(awsCloseStub.args.length).to.be.equal(1);
      expect(pubsubCloseStub.args.length).to.be.equal(1);
    });
  });

  describe('registerMetrics', () => {
    it('should return error message from specification validations', async () => {
      sandbox.stub(Orchestrator, 'getAllSpecificationsFromPaths')
        .returns([
          {
            filePath: '1',
            metrics: [
              {
                name: 'counter_1'
              }
            ]
          },
          {
            filePath: '2',
            metrics: [
              {
                name: 'counter_2'
              }
            ]
          }
        ]);
      sandbox.stub(Orchestrator, 'validateMetricSpecification')
        .onCall(0)
        .returns({})
        .onCall(1)
        .returns({
          b: 'b'
        });
      sandbox.stub(Orchestrator.prototype, 'registerMetric');

      orchestrator = new Orchestrator({});

      let error;

      try {
        await orchestrator.registerMetrics({});
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

    it('should register metrics for each specifications', async () => {
      sandbox.stub(Orchestrator, 'getAllSpecificationsFromPaths')
        .returns([
          {
            filePath: '1',
            metrics: [
              {
                name: 'counter_1'
              }
            ]
          },
          {
            filePath: '2',
            metrics: [
              {
                name: 'counter_2'
              }
            ]
          }
        ]);
      sandbox.stub(Orchestrator, 'validateMetricSpecification');
      const registerMetricStub = sandbox.stub(Orchestrator.prototype, 'registerMetric');

      orchestrator = new Orchestrator({});

      await orchestrator.registerMetrics({});

      expect(registerMetricStub.args.length).to.be.equal(2);
      expect(registerMetricStub.args[0][0]).to.be.deep.equal({
        name: 'counter_1'
      });
      expect(registerMetricStub.args[1][0]).to.be.deep.equal({
        name: 'counter_2'
      });
    });
  });

  describe('registerQueues', () => {
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
      sandbox.stub(Orchestrator.prototype, 'validateQueueSpecification')
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
        await orchestrator.registerQueues({});
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
      sandbox.stub(Orchestrator.prototype, 'validateQueueSpecification')
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
        await orchestrator.registerQueues({});
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
      sandbox.stub(Orchestrator.prototype, 'validateQueueSpecification');
      sandbox.stub(Orchestrator, 'extractServiceNamesFromSpecifications');
      sandbox.stub(Orchestrator.prototype, 'validateCredential');
      const registerQueueStub = sandbox.stub(Orchestrator.prototype, 'registerQueue');

      orchestrator = new Orchestrator({});

      await orchestrator.registerQueues({});

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

      await orchestrator.start(1234, 'https://google.com');

      expect(listenStub.args.length).to.be.equal(1);
      expect(sendStub.args.length).to.be.equal(1);
      expect(sendStub.args[0][0]).to.be.equal('metrics');
    });
  });
});
