'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('#naming', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  describe('#getStateMachineLogicalId()', () => {
    it('should normalize the stateMachine name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineLogicalId('stateMachine')).to
      .equal('StateMachineStepFunctionsStateMachine');
    });
  });

  describe('#getStateMachinePolicyName()', () => {
    it('should use the stage and service name', () => {
      expect(serverlessStepFunctions.getStateMachinePolicyName()).to
      .equal('dev-us-east-1-step-functions-statemachine');
    });
  });

  describe('#getiamRoleStateMachineLogicalId()', () => {
    it('should return IamRoleStateMachineExecution', () => {
      expect(serverlessStepFunctions.getiamRoleStateMachineLogicalId()).to
      .equal('IamRoleStateMachineExecution');
    });
  });
});
