import _ from 'lodash';
import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

import MetricType from '../../lib/enum/metric-type';

const expect = chai.expect;

class GaugeStub {
  name: string;
  help: string;
  labelNames?: Array<string>;

  constructor({ name, help, labelNames }) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
  }
}

class CounterStub {
  name: string;
  help: string;
  labelNames?: Array<string>;

  constructor({ name, help, labelNames }) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
  }
}

class LoggerStub {
  logger: any;

  constructor(logger: any) {
    this.logger = logger;
  }

  warn() {
  }
}

class IncrementStub {
  modify() {
  }
}

class DecrementStub {
  modify() {
  }
}

class EqualStub {
  modify() {
  }
}

class UnsupportedMetricTypeErrorStub extends TypeError {
  message: string;
  options: object;
  name: string = 'UnsupportedMetricTypeError';

  constructor(message: string, options: object = {}) {
    super(message);

    this.options = options;
  }
}

class MetricNotDeclaredErrorStub extends Error {
  message: string;
  options: object;
  name: string = 'MetricNotDeclaredError';

  constructor(message: string, options: object = {}) {
    super(message);

    this.options = options;
  }
}

class DuplicateMetricDeclarationErrorStub extends Error {
  message: string;
  options: object;
  name: string = 'DuplicateMetricDeclarationError';

  constructor(message: string, options: object = {}) {
    super(message);

    this.options = options;
  }
}

describe('Metric', () => {
  const satpamStub = {
    validate: _.noop
  };

  const Metric = proxyquire.noCallThru()('../../lib/metric/metric.js', {
    'prom-client': {
      Gauge: GaugeStub,
      Counter: CounterStub
    },
    'satpam': satpamStub,
    '../error/unsupported-metric-type-error': UnsupportedMetricTypeErrorStub,
    '../error/metric-not-declared-error': MetricNotDeclaredErrorStub,
    '../error/duplicate-metric-declaration-error': DuplicateMetricDeclarationErrorStub,
    '../common/logger': LoggerStub,
    './increment': IncrementStub,
    './decrement': DecrementStub,
    './equal': EqualStub
  });

  const sandbox = sinon.createSandbox();

  let metric: typeof Metric;

  afterEach(() => sandbox.restore());

  describe('getPromMetric', () => {
    it('should return Counter', () => {
      expect(Metric.getPromMetric({
        name: 'counter',
        help: 'counter_help',
        type: MetricType.Counter
      })).to.be.instanceOf(CounterStub);
    });

    it('should return Gauge', () => {
      expect(Metric.getPromMetric({
        name: 'counter',
        help: 'counter_help',
        type: MetricType.Gauge
      })).to.be.instanceOf(GaugeStub);
    });

    it('should return Gauge with labelNames property', () => {
      const gauge: GaugeStub = Metric.getPromMetric({
        name: 'counter',
        help: 'counter_help',
        type: MetricType.Gauge,
        labels: ['a']
      });

      expect(gauge.labelNames).to.be.deep.equal(['a']);
      expect(gauge).to.be.instanceOf(GaugeStub);
    });

    it('should return UnsupportedMetricTypeError', () => {
      expect(Metric.getPromMetric.bind(Metric, {
        name: 'counter',
        help: 'counter_help',
        type: 'HISTOGRAM',
        valueModifier: {
          increase: {
            constant: 5
          }
        }
      })).to.throw(UnsupportedMetricTypeErrorStub);
    });
  });

  describe('getMetricType', () => {
    it('should return Counter', () => {
      expect(Metric.getMetricType(new CounterStub({
        name: 'counter',
        help: 'counter_help',
        labelNames: []
      }))).to.be.equal(MetricType.Counter);
    });

    it('should return Gauge', () => {
      expect(Metric.getMetricType(new GaugeStub({
        name: 'gauge',
        help: 'gauge_help',
        labelNames: []
      }))).to.be.equal(MetricType.Gauge);
    });

    it('should return UnsupportedMetricTypeError', () => {
      expect(Metric.getMetricType.bind(Metric, new Error())).to.throw(UnsupportedMetricTypeErrorStub);
    });
  });

  describe('validateMetricConfig', () => {
    it('should return validation message when first layer validation fails', () => {
      const validateStub = sandbox.stub(satpamStub, 'validate');

      validateStub.onCall(0).returns({
        success: false,
        messages: {
          a: 'a'
        }
      });

      const metricByName = {
        counter: new CounterStub({
          name: 'counter',
          help: 'counter_help',
          labelNames: []
        })
      };

      const metricNameSet = new Set();

      expect(Metric.validateMetricConfig({
        name: 'counter',
        valueModifier: {
          increase: {
            constant: 5
          }
        }
      }, metricByName, metricNameSet)).to.be.deep.equal({
        a: 'a'
      });
    });

    it('should throw MetricNotDeclaredError', () => {
      const validateStub = sandbox.stub(satpamStub, 'validate');

      validateStub.onCall(0).returns({
        success: true
      });

      const metricByName = {};

      const metricNameSet = new Set();

      expect(Metric.validateMetricConfig.bind(Metric, {
        name: 'counter',
        valueModifier: {
          increase: {
            constant: 5
          }
        }
      }, metricByName, metricNameSet)).to.throw(MetricNotDeclaredErrorStub);
    });

    it('should throw DuplicateMetricDeclarationError', () => {
      const validateStub = sandbox.stub(satpamStub, 'validate');

      validateStub.onCall(0).returns({
        success: true
      });

      const metricByName = {
        counter_2: new CounterStub({
          name: 'counter_2',
          help: 'counter_help',
          labelNames: []
        })
      };

      const metricNameSet = new Set(['counter_2']);

      expect(Metric.validateMetricConfig.bind(Metric, {
        name: 'counter_2',
        valueModifier: {
          increase: {
            constant: 5
          }
        }
      }, metricByName, metricNameSet)).to.throw(DuplicateMetricDeclarationErrorStub);
    });

    it('should return validation message when second layer validation fails', () => {
      const validateStub = sandbox.stub(satpamStub, 'validate');

      validateStub.onCall(0).returns({
        success: true
      });

      validateStub.onCall(1).returns({
        success: false,
        messages: {
          b: 'b'
        }
      });

      sandbox.stub(Metric, 'getValueModifierFirstValidationRule')
        .returns({
          d: ['required']
        });

      const metricByName = {
        counter: new CounterStub({
          name: 'counter',
          help: 'counter_help',
          labelNames: ['b', 'c']
        })
      }

      const metricNameSet = new Set();

      const message = Metric.validateMetricConfig({
        name: 'counter',
        valueModifier: {
          increase: {
            constant: 5
          }
        },
        labelPath: {
          b: 'b',
          c: 'c'
        }
      }, metricByName, metricNameSet);

      expect(message).to.be.deep.equal({
        b: 'b'
      });

      expect(validateStub.lastCall.args[0]).to.be.deep.equal({
        labelPath: {
          b: ['required', 'string'],
          c: ['required', 'string']
        },
        d: ['required']
      });
    });

    it('should return validation message when third layer validation fails', () => {
      const validateStub = sandbox.stub(satpamStub, 'validate');

      validateStub.onCall(0).returns({
        success: true
      });

      validateStub.onCall(1).returns({
        success: true
      });

      validateStub.onCall(2).returns({
        success: false,
        messages: {
          c: 'c'
        }
      });

      sandbox.stub(Metric, 'getValueModifierFirstValidationRule')
        .returns({
          d: ['required']
        });

      sandbox.stub(Metric, 'getValueModifierSecondValidationRule')
        .returns({
          e: ['required']
        });

      const metricByName = {
        counter: new CounterStub({
          name: 'counter',
          help: 'counter_help',
          labelNames: ['b', 'c']
        })
      };

      const metricNameSet = new Set();

      const message = Metric.validateMetricConfig({
        name: 'counter',
        valueModifier: {
          increase: {
            constant: 5
          }
        },
        labelPath: {
          b: 'b',
          c: 'c'
        }
      }, metricByName, metricNameSet);

      expect(message).to.be.deep.equal({
        c: 'c'
      });

      expect(validateStub.args[1][0]).to.be.deep.equal({
        labelPath: {
          b: ['required', 'string'],
          c: ['required', 'string']
        },
        d: ['required']
      });

      expect(validateStub.lastCall.args[0]).to.be.deep.equal({
        e: ['required']
      });
    });
  });

  describe('getValueModifierFirstValidationRule', () => {
    it('should return validation for counter', () => {
      expect(Metric.getValueModifierFirstValidationRule(MetricType.Counter)).to.be.deep.equal({
        valueModifier: {
          increase: ['required', 'plainObject']
        }
      });
    });

    it('should return validation for gauge', () => {
      expect(Metric.getValueModifierFirstValidationRule(MetricType.Gauge)).to.be.deep.equal({
        valueModifier: {
          increase: [{
            fullName: 'requiredIf:$1:$2',
            params: [{
              type: 'and',
              mappings: {
                decrease: {
                  type: 'or',
                  mappings: {
                    decrease: [
                      { '$equal': null },
                      { '$equal': undefined }
                    ]
                  }
                },
                set: {
                  type: 'or',
                  mappings: {
                    set: [
                      { '$equal': null },
                      { '$equal': undefined }
                    ]
                  }
                }
              }
            }]
          }, 'plainObject'],
          decrease: [{
            fullName: 'requiredIf:$1:$2',
            params: [{
              type: 'and',
              mappings: {
                increase: {
                  type: 'or',
                  mappings: {
                    increase: [
                      { '$equal': null },
                      { '$equal': undefined }
                    ]
                  }
                },
                set: {
                  type: 'or',
                  mappings: {
                    set: [
                      { '$equal': null },
                      { '$equal': undefined }
                    ]
                  }
                }
              }
            }]
          }, 'plainObject'],
          set: [{
            fullName: 'requiredIf:$1:$2',
            params: [{
              type: 'and',
              mappings: {
                increase: {
                  type: 'or',
                  mappings: {
                    increase: [
                      { '$equal': null },
                      { '$equal': undefined }
                    ]
                  }
                },
                decrease: {
                  type: 'or',
                  mappings: {
                    decrease: [
                      { '$equal': null },
                      { '$equal': undefined }
                    ]
                  }
                }
              }
            }]
          }, 'plainObject']
        }
      });
    });

    it('should throw UnsupportedMetricTypeError', () => {
      expect(Metric.getValueModifierFirstValidationRule.bind(Metric, 'HISTOGRAM')).to.throw(UnsupportedMetricTypeErrorStub);
    });
  });

  describe('getValueModifierSecondValidationRule', () => {
    it('should return validation for counter', () => {
      expect(Metric.getValueModifierSecondValidationRule(
        MetricType.Counter,
        {
          increase: {},
          decrease: {}
        }
      )).to.be.deep.equal({
        valueModifier: {
          increase: {
            constant: [{
              fullName: 'requiredIf:$1:$2',
              params: [{
                type: 'or',
                mappings: {
                  path: [
                    { '$equal': null },
                    { '$equal': undefined },
                    { '$equal': '' }
                  ]
                }
              }]
            }, 'integer', 'minValue:0'],
            path: ['string']
          }
        }
      });
    });

    it('should return validation for gauge', () => {
      expect(Metric.getValueModifierSecondValidationRule(
        MetricType.Gauge,
        {
          increase: {},
          decrease: {}
        }
      )).to.be.deep.equal({
        valueModifier: {
          increase: {
            constant: [{
              fullName: 'requiredIf:$1:$2',
              params: [{
                type: 'or',
                mappings: {
                  path: [
                    { '$equal': null },
                    { '$equal': undefined },
                    { '$equal': '' }
                  ]
                }
              }]
            }, 'integer', 'minValue:0'],
            path: ['string']
          },
          decrease: {
            constant: [{
              fullName: 'requiredIf:$1:$2',
              params: [{
                type: 'or',
                mappings: {
                  path: [
                    { '$equal': null },
                    { '$equal': undefined },
                    { '$equal': '' }
                  ]
                }
              }]
            }, 'integer', 'minValue:0'],
            path: ['string']
          }
        }
      });
    });

    it('should throw UnsupportedMetricTypeError', () => {
      expect(Metric.getValueModifierSecondValidationRule.bind(
        Metric,
        [
          'HISTOGRAM',
          {
            increase: {},
            decrease: {}
          }
        ]
      )).to.throw(UnsupportedMetricTypeErrorStub);
    });
  });

  describe('constructor', () => {
    it('should has operation: increment', () => {
      metric = new Metric({
        labelPath: {
          a: 'b',
          c: 'd'
        },
        valueModifier: {
          increase: {
            constant: 1
          },
          decrease: {
            constant: 1
          }
        },
        name: 'counter',
        logger: new LoggerStub(console),
        metricByName: {
          counter: new CounterStub({
            name: 'counter',
            help: 'counter_help',
            labelNames: ['a', 'c']
          })
        }
      });

      expect(metric.operations.length).to.be.equal(1);
      expect(metric.operations[0]).to.be.instanceOf(IncrementStub);
      expect(metric.labelToPath).to.be.deep.equal({
        a: 'b',
        c: 'd'
      });
    });

    it('should has operation: increment, decrement, equal', () => {
      metric = new Metric({
        labelPath: {
          a: 'a'
        },
        valueModifier: {
          increase: {
            constant: 1
          },
          decrease: {
            constant: 1
          },
          set: {
            constant: 1
          }
        },
        name: 'counter',
        logger: new LoggerStub(console),
        metricByName: {
          counter: new GaugeStub({
            name: 'counter',
            help: 'counter_help',
            labelNames: ['a']
          })
        }
      });

      expect(metric.operations.length).to.be.equal(3);
      expect(metric.operations[0]).to.be.instanceOf(IncrementStub);
      expect(metric.operations[1]).to.be.instanceOf(DecrementStub);
      expect(metric.operations[2]).to.be.instanceOf(EqualStub);
    });

    it('should has operation: decrement', () => {
      metric = new Metric({
        labelPath: {
          a: 'a'
        },
        valueModifier: {
          decrease: {
            constant: 1
          }
        },
        name: 'counter',
        logger: new LoggerStub(console),
        metricByName: {
          counter: new GaugeStub({
            name: 'counter',
            help: 'counter_help',
            labelNames: ['a']
          })
        }
      });

      expect(metric.operations.length).to.be.equal(1);
      expect(metric.operations[0]).to.be.instanceOf(DecrementStub);
    });
  });

  describe('modify', () => {
    it('should modify all of the operation', () => {
      const incrementModifyStub = sandbox.stub(IncrementStub.prototype, 'modify');
      const decrementModifyStub = sandbox.stub(DecrementStub.prototype, 'modify');
      const equalModifyStub = sandbox.stub(EqualStub.prototype, 'modify');

      const logger = new LoggerStub(console);

      metric = new Metric({
        valueModifier: {
          increase: {
            constant: 1
          },
          decrease: {
            constant: 1
          },
          set: {
            constant: 1
          }
        },
        metricByName: {
          gauge: new GaugeStub({
            name: 'gauge',
            help: 'gauge_help',
            labelNames: ['a', 'c']
          })
        },
        logger,
        labelPath: {
          a: 'a.b',
          c: 'c.d'
        },
        name: 'gauge'
      });

      const content = {
        a: {
          b: 'label1'
        },
        c: {
          d: 'label2'
        }
      };

      metric.modify(content);

      expect(incrementModifyStub.lastCall.args).to.be.deep.equal([
        content,
        {
          a: 'label1',
          c: 'label2'
        }
      ]);

      expect(decrementModifyStub.lastCall.args).to.be.deep.equal([
        content,
        {
          a: 'label1',
          c: 'label2'
        }
      ]);

      expect(equalModifyStub.lastCall.args).to.be.deep.equal([
        content,
        {
          a: 'label1',
          c: 'label2'
        }
      ]);
    });

    it('should skip if modification fails', () => {
      const incrementModifyStub = sandbox.stub(IncrementStub.prototype, 'modify');
      const decrementModifyStub = sandbox.stub(DecrementStub.prototype, 'modify')
          .throws(() => {
            throw new Error();
          });
      const equalModifyStub = sandbox.stub(EqualStub.prototype, 'modify');
      const warnStub = sandbox.stub(LoggerStub.prototype, 'warn');

      const logger = new LoggerStub(console);

      metric = new Metric({
        valueModifier: {
          increase: {
            constant: 1
          },
          decrease: {
            constant: 1
          },
          set: {
            constant: 1
          }
        },
        name: 'gauge',
        metricByName: {
          gauge: new GaugeStub({
            name: 'gauge',
            help: 'gauge_help',
            labelNames: []
          })
        },
        logger
      });

      const content = {};

      metric.modify(content);

      expect(incrementModifyStub.lastCall.args).to.be.deep.equal([
        content,
        undefined
      ]);

      expect(decrementModifyStub.lastCall.args).to.be.deep.equal([
        content,
        undefined
      ]);

      expect(warnStub.args.length).to.be.equal(1);

      expect(equalModifyStub.lastCall.args).to.be.deep.equal([
        content,
        undefined
      ]);
    });
  });
});
