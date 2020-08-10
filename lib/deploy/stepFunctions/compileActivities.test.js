'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../index');

describe('#compileStateMachines', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  it('should create corresponding resources when definition property is given', () => {
    serverless.service.stepFunctions = {
      activities: ['activity1', 'activity2'],
    };

    serverlessStepFunctions.compileActivities();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .Activity1StepFunctionsActivity.Type).to.equal('AWS::StepFunctions::Activity');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .Activity2StepFunctionsActivity.Type).to.equal('AWS::StepFunctions::Activity');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .Activity1StepFunctionsActivity.Properties.Name).to.equal('activity1');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .Activity2StepFunctionsActivity.Properties.Name).to.equal('activity2');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Outputs
      .Activity1StepFunctionsActivityArn.Value.Ref).to.equal('Activity1StepFunctionsActivity');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Outputs
      .Activity2StepFunctionsActivityArn.Value.Ref).to.equal('Activity2StepFunctionsActivity');
  });

  it('should not create corresponding resources when stepfunctions are not given', () => {
    serverlessStepFunctions.compileActivities();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources).to.deep.equal({});
  });

  it('should not create corresponding resources when activities are not given', () => {
    serverless.service.stepFunctions = {};
    serverlessStepFunctions.compileActivities();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources).to.deep.equal({});
  });
});
