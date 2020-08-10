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
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  describe('#getStateMachineLogicalId()', () => {
    it('should normalize the stateMachine name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineLogicalId('stateMachine')).to
        .equal('StateMachineStepFunctionsStateMachine');
    });
  });

  describe('#getStateMachineOutputLogicalId()', () => {
    it('should normalize the stateMachine output name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineOutputLogicalId('stateMachine')).to
        .equal('StateMachineStepFunctionsStateMachineArn');
    });
  });

  describe('#getStateMachineLogicalId() -- Named', () => {
    it('should normalize the stateMachine name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineLogicalId('stateMachine',
        { name: 'alphaNumeric' }))
        .to.equal('AlphaNumeric');
    });
  });

  describe('#getStateMachineOutputLogicalId() -- Named', () => {
    it('should normalize the stateMachine output name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineOutputLogicalId('stateMachine',
        { name: 'alphaNumeric' }))
        .to.equal('AlphaNumericArn');
    });
  });

  describe('#getStateMachineLogicalId() -- With Id', () => {
    it('should normalize the stateMachine name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineLogicalId('stateMachine',
        { id: 'foo', name: 'alphaNumeric' }))
        .to.equal('Foo');
    });
  });

  describe('#getStateMachineOutputLogicalId() -- With Id', () => {
    it('should normalize the stateMachine output name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineOutputLogicalId('stateMachine',
        { id: 'foo', name: 'alphaNumeric' }))
        .to.equal('FooArn');
    });
  });

  describe('#getStateMachineLogicalId() -- With Only Id', () => {
    it('should normalize the stateMachine name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineLogicalId('stateMachine', { id: 'foo' })).to
        .equal('Foo');
    });
  });

  describe('#getStateMachineOutputLogicalId() -- With Only Id', () => {
    it('should normalize the stateMachine output name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getStateMachineOutputLogicalId('stateMachine', { id: 'foo' }))
        .to.equal('FooArn');
    });
  });

  describe('#getActivityLogicalId()', () => {
    it('should normalize the activity name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getActivityLogicalId('activity')).to
        .equal('ActivityStepFunctionsActivity');
    });
  });

  describe('#getActivityOutputLogicalId()', () => {
    it('should normalize the activity output name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getActivityOutputLogicalId('activity')).to
        .equal('ActivityStepFunctionsActivityArn');
    });
  });

  describe('#getStateMachinePolicyName()', () => {
    it('should use the stage and service name', () => {
      expect(serverlessStepFunctions.getStateMachinePolicyName()).to
        .equal('dev-us-east-1-step-functions-statemachine');
    });
  });

  describe('#getRestApiLogicalId()', () => {
    it('should return restApiLogicalId', () => {
      expect(serverlessStepFunctions.getRestApiLogicalId()).to
        .equal('ApiGatewayRestApiStepFunctions');
    });
  });

  describe('#getApiGatewayName()', () => {
    it('should return apiGatewayName', () => {
      expect(serverlessStepFunctions.getApiGatewayName()).to
        .equal('dev-step-functions-stepfunctions');
    });
  });

  describe('#getScheduleId()', () => {
    it('should normalize the stateMachine output name', () => {
      expect(serverlessStepFunctions.getScheduleId('stateMachine')).to
        .equal('stateMachineStepFunctionsSchedule');
    });
  });

  describe('#getScheduleLogicalId()', () => {
    it('should normalize the stateMachine output name and add the standard suffix', () => {
      expect(serverlessStepFunctions.getScheduleLogicalId('stateMachine', 1)).to
        .equal('StateMachineStepFunctionsEventsRuleSchedule1');
    });
  });

  describe('#getScheduleToStepFunctionsIamRoleLogicalId()', () => {
    it('should normalize the stateMachine output name', () => {
      expect(serverlessStepFunctions.getScheduleToStepFunctionsIamRoleLogicalId('stateMachine')).to
        .equal('StateMachineScheduleToStepFunctionsRole');
    });
  });

  describe('#getSchedulePolicyName()', () => {
    it('should use the stage and service name', () => {
      expect(serverlessStepFunctions.getSchedulePolicyName('stateMachine')).to
        .equal('dev-us-east-1-step-functions-stateMachine-schedule');
    });
  });
});
