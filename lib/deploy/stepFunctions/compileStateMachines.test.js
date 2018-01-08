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
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  it('should create corresponding resources when definition and name property is given', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition: 'definition1',
        },
        myStateMachine2: {
          name: 'stateMachineBeta2',
          definition: 'definition2',
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.DefinitionString
    ).to.equal('"definition1"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Properties.DefinitionString
    ).to.equal('"definition2"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.RoleArn['Fn::GetAtt'][0]
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Properties.RoleArn['Fn::GetAtt'][0]
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.DependsOn
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.DependsOn
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Outputs
      .StateMachineBeta1Arn.Value.Ref
    ).to.equal('StateMachineBeta1');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Outputs
      .StateMachineBeta2Arn.Value.Ref
    ).to.equal('StateMachineBeta2');
  });

  it('should create corresponding resources when definition property is given and no name', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
        },
        myStateMachine2: {
          definition: 'definition2',
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine1StepFunctionsStateMachine.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine2StepFunctionsStateMachine.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine1StepFunctionsStateMachine.Properties.DefinitionString
    ).to.equal('"definition1"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine2StepFunctionsStateMachine.Properties.DefinitionString
    ).to.equal('"definition2"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine1StepFunctionsStateMachine.Properties.RoleArn['Fn::GetAtt'][0]
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine2StepFunctionsStateMachine.Properties.RoleArn['Fn::GetAtt'][0]
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine1StepFunctionsStateMachine.DependsOn
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine2StepFunctionsStateMachine.DependsOn
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Outputs
      .MyStateMachine1StepFunctionsStateMachineArn.Value.Ref
    ).to.equal('MyStateMachine1StepFunctionsStateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Outputs
      .MyStateMachine2StepFunctionsStateMachineArn.Value.Ref
    ).to.equal('MyStateMachine2StepFunctionsStateMachine');
  });

  it('should create named resources when Name is provided', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
          name: 'stateMachineBeta1',
        },
        myStateMachine2: {
          definition: 'definition2',
          name: 'stateMachineBeta2',
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.DefinitionString
    ).to.equal('"definition1"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Properties.DefinitionString
    ).to.equal('"definition2"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.RoleArn['Fn::GetAtt'][0]
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Properties.RoleArn['Fn::GetAtt'][0]
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.DependsOn
    ).to.equal('IamRoleStateMachineExecution');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.DependsOn
    ).to.equal('IamRoleStateMachineExecution');
  });

  it('should create corresponding resources when definition and role property are given', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition: 'definition1',
          role: 'arn:aws:role1',
        },
        myStateMachine2: {
          name: 'stateMachineBeta2',
          definition: 'definition2',
          role: 'arn:aws:role2',
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.DefinitionString
    ).to.equal('"definition1"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Properties.DefinitionString
    ).to.equal('"definition2"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.RoleArn
    ).to.equal('arn:aws:role1');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Properties.RoleArn
    ).to.equal('arn:aws:role2');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Outputs
      .StateMachineBeta1Arn.Value.Ref
    ).to.equal('StateMachineBeta1');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Outputs
      .StateMachineBeta2Arn.Value.Ref
    ).to.equal('StateMachineBeta2');
  });

  it('should throw error when definition property is not given', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
        },
      },
    };
    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);
  });

  it('should respect variables if multi-line variables is given', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition: 'definition1\n',
        },
        myStateMachine2: {
          name: 'stateMachineBeta2',
          definition: 'definition2\n',
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Type
    ).to.equal('AWS::StepFunctions::StateMachine');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.DefinitionString
    ).to.equal('"definition1"');
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.Properties.DefinitionString
    ).to.equal('"definition2"');
  });

  it('should replace only the function name in resource with the arn', () => {
    const functionName = 'test-task';

    const expected = {
      Comment: 'Test',
      StartAt: 'Test',
      States: {
        Test: {
          Type: 'Task',
          Resource: {
            'Fn::Join': [
              '-',
              [
                serverlessStepFunctions.service,
                serverlessStepFunctions.stage,
                serverlessStepFunctions.region,
                functionName,
              ],
            ],
          },
          End: true,
        },
      },
    };

    serverless.service.functions[functionName] = {};

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition: {
            Comment: 'Test',
            StartAt: 'Test',
            States: {
              Test: {
                Type: 'Task',
                Resource: functionName,
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.DefinitionString
    ).to.deep.equal(JSON.stringify(expected));
  });

  it('should throw an error if the function is referred to and doesnt exist', () => {
    const functionName = 'test-task';

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition: {
            Comment: 'Test',
            StartAt: 'Test',
            States: {
              Test: {
                Type: 'Task',
                Resource: functionName,
                End: true,
              },
            },
          },
        },
      },
    };

    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);
  });

  it('should should not modify resources that start with arn:', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition: {
            Comment: 'Test',
            StartAt: 'Test',
            States: {
              Test: {
                Type: 'Task',
                Resource: 'arn:aws:lambda',
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1.Properties.DefinitionString
    ).to.deep.equal(JSON.stringify(serverless.service.stepFunctions
      .stateMachines.myStateMachine1.definition));
  });

  it('should throw error when role property is not given as ARN format', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
          role: 'srn:aws:role1',
          name: 'stateMachineBeta1',
        },
      },
    };
    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);
  });

  it('should throw error when role property is not given as string', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition: 'definition1',
          role: { 'arn:aws:role1': 'ss' },
        },
      },
    };
    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta2',
          definition: 'definition1',
          role: ['arn:aws:role1'],
        },
      },
    };
    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);
  });

  it('should not create corresponding resources when stepfunctions are not given', () => {
    serverlessStepFunctions.compileStateMachines();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
    ).to.deep.equal({});
  });

  it('should not create corresponding resources when stateMachines are not given', () => {
    serverless.service.stepFunctions = {};
    serverlessStepFunctions.compileStateMachines();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
    ).to.deep.equal({});
  });
});
