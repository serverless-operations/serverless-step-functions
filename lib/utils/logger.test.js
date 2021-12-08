'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const logger = require('../utils/logger');

describe('logger', () => {
  let serverless;
  let v3LogSpy;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.cli = { consoleLog: sinon.spy() };

    v3LogSpy = sinon.spy();
  });

  afterEach(() => {
    serverless.cli = null;
    v3LogSpy = null;
  });

  it('should be assigned legacy logger (serverless.cli.consoleLog) if v3 log api is not supplied', () => {
    const { log } = logger.config(serverless);
    log('Testing purpose');

    expect(serverless.cli.consoleLog.callCount).to.equal(1);
    expect(v3LogSpy.callCount).to.equal(0);
  });

  it('should be assigned new log API if new log api is supplied', () => {
    const { log } = logger.config(serverless, { log: v3LogSpy });
    log('Testing purpose');

    expect(serverless.cli.consoleLog.callCount).to.equal(0);
    expect(v3LogSpy.callCount).to.equal(1);
  });
});
