import _ from 'lodash';
import chai from 'chai';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('Logger', () => {
  const loggerStub = {
    info: _.identity,
    error: _.identity,
    debug: _.identity,
    warn: _.identity
  };

  const Logger = proxyquire.noCallThru()('../../lib/common/logger.js', {});

  const sandbox = sinon.createSandbox();

  let logger: typeof Logger;

  beforeEach(() => {
    logger = new Logger(loggerStub);
  });

  afterEach(() => sandbox.restore());

  describe('info', () => {
    it('should call logger.info with the right parameter', () => {
      const message = 'INFO';

      const infoStub = sandbox.stub(loggerStub, 'info');

      logger.info(message);

      expect(infoStub.lastCall.args[0]).to.be.equal(message);
    });
  });

  describe('error', () => {
    it('should call logger.error with the right parameter', () => {
      const message = 'ERROR';

      const errorStub = sandbox.stub(loggerStub, 'error');

      logger.error(message);

      expect(errorStub.lastCall.args[0]).to.be.equal(message);
    });
  });

  describe('debug', () => {
    it('should call logger.debug with the right parameter', () => {
      const message = 'DEBUG';

      const debugStub = sandbox.stub(loggerStub, 'debug');

      logger.debug(message);

      expect(debugStub.lastCall.args[0]).to.be.equal(message);
    });
  });

  describe('warn', () => {
    it('should call logger.warn with the right parameter', () => {
      const message = 'WARN';

      const warnStub = sandbox.stub(loggerStub, 'warn');

      logger.warn(message);

      expect(warnStub.lastCall.args[0]).to.be.equal(message);
    });
  });
});
