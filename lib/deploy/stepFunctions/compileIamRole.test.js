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
      region: 'ap-northeast-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  it('should do nothing when role property exists in all statmachine properties', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachine1',
          definition: 'definition',
          role: 'role',
        },
        myStateMachine2: {
          name: 'stateMachine2',
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
          name: 'stateMachine2',
          definition: 'definition',
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.AssumeRolePolicyDocument.Statement[0].Principal.Service)
      .to.be.equal('states.ap-northeast-1.amazonaws.com');

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyName)
      .to.be.equal('dev-us-east-1-step-functions-statemachine');
  });

  it('should create corresponding resources when role property are not given', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachine1',
          definition: 'definition',
          role: 'role',
        },
        myStateMachine2: {
          name: 'stateMachin2',
          definition: 'definition',
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution.Type
    ).to.equal('AWS::IAM::Role');
  });

  it('should give invokeFunction permission for only functions referenced by state machine', () => {
    const helloLambda = 'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:hello';
    const worldLambda = 'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:world';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition: {
            StartAt: 'Hello',
            States: {
              Hello: {
                Type: 'Task',
                Resource: helloLambda,
                End: true,
              },
            },
          },
        },
        myStateMachine2: {
          name: 'stateMachineBeta2',
          definition: {
            StartAt: 'World',
            States: {
              World: {
                Type: 'Task',
                Resource: worldLambda,
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloLambda, worldLambda]);
  });
});
