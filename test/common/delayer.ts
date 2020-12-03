import _ from 'lodash';
import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('Delayer', () => {
  const BluebirdStub = {
    delay: _.noop
  };

  const Delayer = proxyquire.noCallThru()('../../lib/common/delayer.js', {
    'bluebird': BluebirdStub
  });

  const sandbox = sinon.createSandbox();

  let delayer: typeof Delayer;

  const startingDelay = 1000;
  const maximumDelay = 5000;

  afterEach(() => sandbox.restore());

  describe('delay', () => {
    it('should update currentDelay and call Bluebird delay', () => {
      delayer = new Delayer(startingDelay, (currentDelay) => currentDelay + 1000, maximumDelay);

      sandbox.stub(delayer, 'nextDelay')
        .returns(3000);

      const delayStub = sandbox.stub(BluebirdStub, 'delay');

      delayer.delay();

      expect(delayer.currentDelay).to.be.equal(3000);
      expect(delayStub.lastCall.args[0]).to.be.equal(startingDelay);
    });
  });

  describe('nextDelay', () => {
    it('should return next delay', () => {
      delayer = new Delayer(startingDelay, (currentDelay) => currentDelay + 1000, maximumDelay);

      expect(delayer.nextDelay()).to.be.equal(2000);
    });

    it('should return maximum delay', () => {
      delayer = new Delayer(startingDelay, _.constant(10000), maximumDelay);

      expect(delayer.nextDelay()).to.be.equal(maximumDelay);
    });
  });

  describe('reset', () => {
    it('should reset the current delay', () => {
      delayer = new Delayer(startingDelay, _.constant(10000), maximumDelay);

      delayer.currentDelay = maximumDelay;

      delayer.reset();

      expect(delayer.currentDelay).to.be.equal(startingDelay);
    });
  });
});
