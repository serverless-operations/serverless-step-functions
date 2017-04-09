'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const BbPromise = require('bluebird');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('#yamlParse', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  describe('#yamlParse()', () => {
    let yamlParserStub;
    let populateServiceStub;
    beforeEach(() => {
      populateServiceStub = sinon.stub(serverlessStepFunctions.serverless.variables,
      'populateService').returns(BbPromise.resolve());
      yamlParserStub = sinon.stub(serverlessStepFunctions.serverless.yamlParser, 'parse')
      .returns(BbPromise.resolve({
        stepFunctions: {
          stateMachines: 'stepFunctions',
          activities: 'my-activity',
        },
      }));
      serverlessStepFunctions.serverless.config.servicePath = 'servicePath';
    });

    it('should throw error if servicePath is not given', () => {
      serverlessStepFunctions.serverless.config.servicePath = null;
      serverlessStepFunctions.yamlParse()
      .then(() => {
        expect(yamlParserStub.calledOnce).to.be.equal(false);
        expect(populateServiceStub.calledOnce).to.be.equal(false);
        expect(serverless.service.stepFunctions).to.be.undefined; // eslint-disable-line
        serverlessStepFunctions.serverless.yamlParser.parse.restore();
        serverlessStepFunctions.serverless.variables.populateService.restore();
      });
    });

    it('should create corresponding when stepfunctions param are given', () => {
      serverlessStepFunctions.yamlParse()
      .then(() => {
        expect(yamlParserStub.calledOnce).to.be.equal(true);
        expect(populateServiceStub.calledOnce).to.be.equal(true);
        expect(serverless.service.stepFunctions.stateMachines).to.be.equal('stepFunctions');
        expect(serverless.service.stepFunctions.activities).to.be.equal('my-activity');
        serverlessStepFunctions.serverless.yamlParser.parse.restore();
        serverlessStepFunctions.serverless.variables.populateService.restore();
      });
    });

    it('should create empty object when stepfunctions param are not given', () => {
      serverlessStepFunctions.serverless.yamlParser.parse.restore();
      yamlParserStub = sinon.stub(serverlessStepFunctions.serverless.yamlParser, 'parse')
      .returns(BbPromise.resolve({
        stepFunctions: {},
      }));
      serverlessStepFunctions.yamlParse()
      .then(() => {
        expect(yamlParserStub.calledOnce).to.be.equal(true);
        expect(populateServiceStub.calledOnce).to.be.equal(true);
        expect(serverless.service.stepFunctions.stateMachines).to.be.deep.equal({});
        expect(serverless.service.stepFunctions.activities).to.be.deep.equal({});
        serverlessStepFunctions.serverless.yamlParser.parse.restore();
        serverlessStepFunctions.serverless.variables.populateService.restore();
      });
    });
  });

  describe('#getAllStateMachines()', () => {
    it('should return statemachine names as array', () => {
      serverless.service.stepFunctions = {
        stateMachines: {
          aaa: {},
          bbb: {},
        },
      };
      expect(serverlessStepFunctions.getAllStateMachines()[0]).to.be.equal('aaa');
      expect(serverlessStepFunctions.getAllStateMachines()[1]).to.be.equal('bbb');
    });
  });

  describe('#getStateMachine()', () => {
    beforeEach(() => {
      serverless.service.stepFunctions = {
        stateMachines: {
          aaa: {
            definition: 'definition1',
          },
        },
      };
    });

    it('should return statemachine object', () => {
      expect(serverlessStepFunctions.getStateMachine('aaa').definition).to.be.equal('definition1');
    });

    it('should throw error if the statemachine does not exists', () => {
      expect(() => serverlessStepFunctions.getStateMachine('bbb').definition).to.throw(Error);
    });
  });

  describe('#isStateMachines()', () => {
    it('should return true if the statemachines exists', () => {
      serverless.service.stepFunctions = {
        stateMachines: {
          aaa: {
            definition: 'definition1',
          },
        },
      };
      expect(serverlessStepFunctions.isStateMachines()).to.be.equal(true);
    });

    it('should return false if the stepfunctions does not exists', () => {
      expect(serverlessStepFunctions.isStateMachines()).to.be.equal(false);
    });

    it('should return false if the stameMachines does not exists', () => {
      serverless.service.stepFunctions = {};
      expect(serverlessStepFunctions.isStateMachines()).to.be.equal(false);
    });
  });
});
