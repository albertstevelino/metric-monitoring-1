import Bluebird from 'bluebird';
import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('PromiseRunner', () => {
  const PromiseRunner = proxyquire.noCallThru()('../../lib/common/promise-runner.js', {});

  const sandbox = sinon.createSandbox();

  let promiseRunner: typeof PromiseRunner;

  afterEach(() => sandbox.restore());

  describe('until', async () => {
    it('should do the task until predicate condition is met', () => {
      const predicateArray: Array<number> = [1, 2, 3];

      promiseRunner = new PromiseRunner(Bluebird.method(() => predicateArray.pop()));

      return expect(promiseRunner.until(() => predicateArray.length === 0)).to.be.eventually.deep.equal({
        result: 1,
        runCount: 3
      });
    });

    it('should complete in the first run', () => {
      const predicateArray: Array<number> = [];

      promiseRunner = new PromiseRunner(Bluebird.method(() => predicateArray.pop()));

      return expect(promiseRunner.until(() => predicateArray.length === 0)).to.be.eventually.deep.equal({
        result: undefined,
        runCount: 0
      });
    });

    it('should throw error', () => {
      const predicateArray: Array<number> = [1, 2, 3];

      promiseRunner = new PromiseRunner(Bluebird.method(() => {
        throw new Error();
      }));

      return expect(promiseRunner.until(() => predicateArray.length === 0)).to.be.eventually.rejectedWith(Error);
    });
  });

  describe('while', async () => {
    it('should call function with right parameter', async () => {
      promiseRunner = new PromiseRunner(Bluebird.method(() => true));

      const untilStub = sandbox.stub(promiseRunner, 'until');

      await promiseRunner.while(() => true);

      return expect(untilStub.lastCall.args[0]()).to.be.equal(false);
    });
  });
});
