'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('ServerlessStepFunctions', () => {
  let serverless;
  let provider;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.functions = {
      first: {
        handler: true,
        name: 'first',
      },
    };

    const options = {
      stage: 'dev',
      region: 'us-east-1',
      function: 'first',
      functionObj: {
        name: 'first',
      },
      state: 'hellofunc',
      data: 'inputData',
    };

    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    provider = serverless.getProvider('aws');
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(serverlessStepFunctions.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(serverlessStepFunctions.provider).to.be.instanceof(AwsProvider));

    it('should have access to the serverless instance', () => {
      expect(serverlessStepFunctions.serverless).to.deep.equal(serverless);
    });

    it('should set the region variable', () =>
      expect(serverlessStepFunctions.region).to.be.equal(provider.getRegion()));

    it('should set the stage variable', () =>
      expect(serverlessStepFunctions.stage).to.be.equal(provider.getStage()));

    it('should set the assumeRolePolicyDocument variable', () =>
      expect(serverlessStepFunctions.assumeRolePolicyDocument).to.be
      .equal(`{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "states.us-east-1.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  `
));

    it('should run deploy:stepf:deploy promise chain in order', () => {
      const deployStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineDeploy').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['deploy:stepf:deploy']()
        .then(() => {
          expect(deployStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineDeploy.restore();
        });
    });

    it('should run remove:stepf:remove promise chain in order', () => {
      const removeStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineRemove').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['remove:stepf:remove']()
        .then(() => {
          expect(removeStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineRemove.restore();
        });
    });

    it('should run invoke:stepf:invoke promise chain in order', () => {
      const invokeStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineInvoke').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['invoke:stepf:invoke']()
        .then(() => {
          expect(invokeStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineInvoke.restore();
        });
    });

    it('should set an empty options object if no options are given', () => {
      const serverlessStepFunctionsWithEmptyOptions = new ServerlessStepFunctions(serverless);
      expect(serverlessStepFunctionsWithEmptyOptions.options).to.deep.equal({});
    });
  });

  describe('#stateMachineDeploy()', () => {
    it('should run promise chain in order', () => {
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const getFunctionArnsStub = sinon
        .stub(serverlessStepFunctions, 'getFunctionArns').returns(BbPromise.resolve());
      const compileStub = sinon
        .stub(serverlessStepFunctions, 'compile').returns(BbPromise.resolve());
      const getIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'getIamRole').returns(BbPromise.resolve());
      const deleteStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachine').returns(BbPromise.resolve());
      const createStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'createStateMachine').returns(BbPromise.resolve());

      return serverlessStepFunctions.stateMachineDeploy()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getFunctionArnsStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(compileStub.calledAfter(getFunctionArnsStub)).to.be.equal(true);
          expect(getIamRoleStub.calledAfter(compileStub)).to.be.equal(true);
          expect(deleteStateMachineStub.calledAfter(getIamRoleStub)).to.be.equal(true);
          expect(createStateMachineStub.calledAfter(deleteStateMachineStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.getFunctionArns.restore();
          serverlessStepFunctions.compile.restore();
          serverlessStepFunctions.getIamRole.restore();
          serverlessStepFunctions.deleteStateMachine.restore();
          serverlessStepFunctions.createStateMachine.restore();
        });
    });
  });

  describe('#stateMachineRemove()', () => {
    it('should run promise chain in order', () => {
      const deleteIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'deleteIamRole').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const deleteStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachine').returns(BbPromise.resolve());

      return serverlessStepFunctions.stateMachineRemove()
        .then(() => {
          expect(deleteIamRoleStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(deleteIamRoleStub)).to.be.equal(true);
          expect(deleteStateMachineStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);

          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.deleteStateMachine.restore();
        });
    });
  });

  describe('#stateMachineInvoke()', () => {
    it('should run promise chain in order', () => {
      const parseInputdateStub = sinon
        .stub(serverlessStepFunctions, 'parseInputdate').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const startExecutionStub = sinon
        .stub(serverlessStepFunctions, 'startExecution').returns(BbPromise.resolve());
      const describeExecutionStub = sinon
        .stub(serverlessStepFunctions, 'describeExecution')
        .returns(BbPromise.resolve({ status: 'SUCCEED' }));

      return serverlessStepFunctions.stateMachineInvoke()
        .then(() => {
          expect(parseInputdateStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(parseInputdateStub)).to.be.equal(true);
          expect(startExecutionStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(describeExecutionStub.calledAfter(startExecutionStub)).to.be.equal(true);

          serverlessStepFunctions.parseInputdate.restore();
          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.startExecution.restore();
          serverlessStepFunctions.describeExecution.restore();
        });
    });

    it('should run promise chain in order when invocation error occurs', () => {
      const parseInputdateStub = sinon
        .stub(serverlessStepFunctions, 'parseInputdate').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const startExecutionStub = sinon
        .stub(serverlessStepFunctions, 'startExecution').returns(BbPromise.resolve());
      const describeExecutionStub = sinon
        .stub(serverlessStepFunctions, 'describeExecution')
        .returns(BbPromise.resolve({ status: 'FAILED' }));
      const getExecutionHistoryStub = sinon
        .stub(serverlessStepFunctions, 'getExecutionHistory').returns(BbPromise.resolve({
          events: [{
            executionFailedEventDetails: '',
          }],
        }));

      return serverlessStepFunctions.stateMachineInvoke()
        .then(() => {
          expect(parseInputdateStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(parseInputdateStub)).to.be.equal(true);
          expect(startExecutionStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(describeExecutionStub.calledAfter(startExecutionStub)).to.be.equal(true);
          expect(getExecutionHistoryStub.calledAfter(describeExecutionStub)).to.be.equal(true);

          serverlessStepFunctions.parseInputdate.restore();
          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.startExecution.restore();
          serverlessStepFunctions.describeExecution.restore();
          serverlessStepFunctions.getExecutionHistory.restore();
        });
    });
  });
});

