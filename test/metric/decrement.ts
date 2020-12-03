import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class GaugeStub {
  dec(...args: Array<any>) {
    return args;
  }
}

class CounterStub {
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

describe('Decrement', () => {
  const OperationConfigStub = proxyquire('../../lib/interface/operation-config.js', {
    'prom-client': {
      Gauge: GaugeStub,
      Counter: CounterStub
    }
  });

  const Decrement = proxyquire.noCallThru()('../../lib/metric/decrement.js', {
    '../interface/operation-config': OperationConfigStub,
    '../error/variable-type-error': VariableTypeErrorStub
  });

  const sandbox = sinon.createSandbox();

  let decrement: typeof Decrement;

  afterEach(() => sandbox.restore());

  describe('modify', () => {
    it('should decrement with constant and no label', () => {
      const gaugeStub = new GaugeStub();

      decrement = new Decrement({
        constant: 5,
        promMetric: gaugeStub
      });

      const decStub = sandbox.stub(gaugeStub, 'dec');

      decrement.modify({});

      expect(decStub.lastCall.args[0]).to.be.equal(5);
    });

    it('should decrement with constant and label', () => {
      const gaugeStub = new GaugeStub();

      decrement = new Decrement({
        constant: 5,
        promMetric: gaugeStub
      });

      const decStub = sandbox.stub(gaugeStub, 'dec');

      decrement.modify({}, {
        a: 'a'
      });

      expect(decStub.lastCall.args[0]).to.be.deep.equal({
        a: 'a'
      });
      expect(decStub.lastCall.args[1]).to.be.equal(5);
    });

    it('should decrement with value from path and no label', () => {
      const gaugeStub = new GaugeStub();

      decrement = new Decrement({
        path: 'a.b',
        promMetric: gaugeStub
      });

      const decStub = sandbox.stub(gaugeStub, 'dec');

      decrement.modify({
        a: {
          b: 3
        }
      });

      expect(decStub.lastCall.args[0]).to.be.equal(3);
    });

    it('should decrement with value from path and label', () => {
      const gaugeStub = new GaugeStub();

      decrement = new Decrement({
        path: 'a.b',
        promMetric: gaugeStub
      });

      const decStub = sandbox.stub(gaugeStub, 'dec');

      decrement.modify({
        a: {
          b: 3
        }
      }, {
        a: 'a'
      });

      expect(decStub.lastCall.args[0]).to.be.deep.equal({
        a: 'a'
      });
      expect(decStub.lastCall.args[1]).to.be.equal(3);
    });

    it('should error when value from path not exist', () => {
      const gaugeStub = new GaugeStub();

      decrement = new Decrement({
        path: 'a.c',
        promMetric: gaugeStub
      });

      expect(decrement.modify.bind(decrement, {
        a: {
          b: 3
        }
      })).to.throw(VariableTypeErrorStub);
    });

    it('should decrement with value from constant and path', () => {
      const gaugeStub = new GaugeStub();

      decrement = new Decrement({
        path: 'a.b',
        constant: 5,
        promMetric: gaugeStub
      });

      const decStub = sandbox.stub(gaugeStub, 'dec');

      decrement.modify({
        a: {
          b: 3
        }
      });

      expect(decStub.args[0][0]).to.be.equal(5);
      expect(decStub.args[1][0]).to.be.equal(3);
    });
  });
});
