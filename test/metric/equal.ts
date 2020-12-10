import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

class GaugeStub {
  set(...args: Array<any>) {
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

describe('Equal', () => {
  const OperationConfigStub = proxyquire('../../lib/interface/operation-config.js', {
    'prom-client': {
      Gauge: GaugeStub,
      Counter: CounterStub
    }
  });

  const Equal = proxyquire.noCallThru()('../../lib/metric/equal.js', {
    '../interface/operation-config': OperationConfigStub,
    '../error/variable-type-error': VariableTypeErrorStub
  });

  const sandbox = sinon.createSandbox();

  let equal: typeof Equal;

  afterEach(() => sandbox.restore());

  describe('modify', () => {
    it('should set with value from constant and no label', () => {
      const gaugeStub = new GaugeStub();

      equal = new Equal({
        constant: 5,
        promMetric: gaugeStub
      });

      const setStub = sandbox.stub(gaugeStub, 'set');

      equal.modify({});

      expect(setStub.lastCall.args[0]).to.be.equal(5);
    });

    it('should set with value from constant and label', () => {
      const gaugeStub = new GaugeStub();

      equal = new Equal({
        constant: 5,
        promMetric: gaugeStub
      });

      const setStub = sandbox.stub(gaugeStub, 'set');

      equal.modify({}, {
        a: 'a'
      });

      expect(setStub.lastCall.args[0]).to.be.deep.equal({
        a: 'a'
      });
      expect(setStub.lastCall.args[1]).to.be.equal(5);
    });

    it('should set with value from path and no label', () => {
      const gaugeStub = new GaugeStub();

      equal = new Equal({
        path: 'a.b',
        promMetric: gaugeStub
      });

      const setStub = sandbox.stub(gaugeStub, 'set');

      equal.modify({
        a: {
          b: 3
        }
      });

      expect(setStub.lastCall.args[0]).to.be.equal(3);
    });

    it('should set with value from path and label', () => {
      const gaugeStub = new GaugeStub();

      equal = new Equal({
        path: 'a.b',
        promMetric: gaugeStub
      });

      const setStub = sandbox.stub(gaugeStub, 'set');

      equal.modify({
        a: {
          b: 3
        }
      }, {
        a: 'a'
      });

      expect(setStub.lastCall.args[0]).to.be.deep.equal({
        a: 'a'
      });
      expect(setStub.lastCall.args[1]).to.be.equal(3);
    });

    it('should error when value from path not exist', () => {
      const gaugeStub = new GaugeStub();

      equal = new Equal({
        path: 'a.c',
        promMetric: gaugeStub
      });

      expect(equal.modify.bind(equal, {
        a: {
          b: 3
        }
      })).to.throw(VariableTypeErrorStub);
    });

    it('should set with value from constant and path', () => {
      const gaugeStub = new GaugeStub();

      equal = new Equal({
        path: 'a.b',
        constant: 5,
        promMetric: gaugeStub
      });

      const setStub = sandbox.stub(gaugeStub, 'set');

      equal.modify({
        a: {
          b: 3
        }
      });

      expect(setStub.args[0][0]).to.be.equal(5);
      expect(setStub.args[1][0]).to.be.equal(3);
    });
  });
});
