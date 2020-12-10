import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class GaugeStub {
  inc(...args: Array<any>) {
    return args;
  }
}

class CounterStub {
  inc(...args: Array<any>) {
    return args;
  }
}

class VariableTypeErrorStub extends TypeError {
  message: string;
  options: object;
  name: string = 'VariableTypeError';

  constructor(message: string, options: object = {}) {
    super(message);

    this.options = options;
  }
}

describe('Increment', () => {
  const OperationConfigStub = proxyquire('../../lib/interface/operation-config.js', {
    'prom-client': {
      Gauge: GaugeStub,
      Counter: CounterStub
    }
  });

  const Increment = proxyquire.noCallThru()('../../lib/metric/increment.js', {
    '../interface/operation-config': OperationConfigStub,
    '../error/variable-type-error': VariableTypeErrorStub
  });

  const sandbox = sinon.createSandbox();

  let increment: typeof Increment;

  afterEach(() => sandbox.restore());

  describe('modify', () => {
    it('should increment with constant and no label', () => {
      const gaugeStub = new GaugeStub();

      increment = new Increment({
        constant: 5,
        promMetric: gaugeStub
      });

      const incStub = sandbox.stub(gaugeStub, 'inc');

      increment.modify({});

      expect(incStub.lastCall.args[0]).to.be.equal(5);
    });

    it('should increment with constant and label', () => {
      const counterStub = new CounterStub();

      increment = new Increment({
        constant: 5,
        promMetric: counterStub
      });

      const incStub = sandbox.stub(counterStub, 'inc');

      increment.modify({}, {
        a: 'a'
      });

      expect(incStub.lastCall.args[0]).to.be.deep.equal({
        a: 'a'
      });
      expect(incStub.lastCall.args[1]).to.be.equal(5);
    });

    it('should increment with value from path and no label', () => {
      const gaugeStub = new GaugeStub();

      increment = new Increment({
        path: 'a.b',
        promMetric: gaugeStub
      });

      const incStub = sandbox.stub(gaugeStub, 'inc');

      increment.modify({
        a: {
          b: 3
        }
      });

      expect(incStub.lastCall.args[0]).to.be.equal(3);
    });

    it('should increment with value from path and label', () => {
      const counterStub = new CounterStub();

      increment = new Increment({
        path: 'a.b',
        promMetric: counterStub
      });

      const incStub = sandbox.stub(counterStub, 'inc');

      increment.modify({
        a: {
          b: 3
        }
      }, {
        a: 'a'
      });

      expect(incStub.lastCall.args[0]).to.be.deep.equal({
        a: 'a'
      });
      expect(incStub.lastCall.args[1]).to.be.equal(3);
    });

    it('should error when value from path not exist', () => {
      const gaugeStub = new GaugeStub();

      increment = new Increment({
        path: 'a.c',
        promMetric: gaugeStub
      });

      expect(increment.modify.bind(increment, {
        a: {
          b: 3
        }
      })).to.throw(VariableTypeErrorStub);
    });

    it('should increment with value from constant and path', () => {
      const counterStub = new CounterStub();

      increment = new Increment({
        path: 'a.b',
        constant: 5,
        promMetric: counterStub
      });

      const incStub = sandbox.stub(counterStub, 'inc');

      increment.modify({
        a: {
          b: 3
        }
      });

      expect(incStub.args[0][0]).to.be.equal(5);
      expect(incStub.args[1][0]).to.be.equal(3);
    });
  });
});
