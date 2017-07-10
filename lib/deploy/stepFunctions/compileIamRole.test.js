'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../index');

describe('#compileIamRole', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.setProvider('aws', new AwsProvider(serverless));
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  it('should do nothing when role property exists in all statmachine properties', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition',
          role: 'role',
        },
        myStateMachine2: {
          definition: 'definition',
          role: 'role',
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
    ).to.deep.equal({});
  });

  it('should replace [region] and [policyname] with corresponding values', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine2: {
          definition: 'definition',
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.AssumeRolePolicyDocument.Statement[0].Principal.Service)
      .to.be.equal('states.us-east-1.amazonaws.com');

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyName)
      .to.be.equal('dev-us-east-1-step-functions-statemachine');
  });

  it('should create corresponding resources when role property are not given', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition',
          role: 'role',
        },
        myStateMachine2: {
          definition: 'definition',
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution.Type
    ).to.equal('AWS::IAM::Role');
  });
});
