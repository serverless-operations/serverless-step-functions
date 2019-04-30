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
    ).to.deep.eq(['IamRoleStateMachineExecution']);
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.DependsOn
    ).to.deep.eq(['IamRoleStateMachineExecution']);
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
    ).to.deep.eq(['IamRoleStateMachineExecution']);
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .MyStateMachine2StepFunctionsStateMachine.DependsOn
    ).to.deep.eq(['IamRoleStateMachineExecution']);
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
    ).to.deep.eq(['IamRoleStateMachineExecution']);
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.DependsOn
    ).to.deep.eq(['IamRoleStateMachineExecution']);
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

  it('should respect CloudFormation intrinsic functions for role property', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineWithIntrinsicRole1',
          definition: 'definition1\n',
          role: { 'Fn::Attr': ['RoleID', 'Arn'] },
        },
        myStateMachine2: {
          name: 'stateMachineWithIntrinsicRole2',
          definition: 'definition1\n',
          role: { Ref: 'CloudformationId' },
        },
      },
    };
    serverlessStepFunctions.compileStateMachines();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineWithIntrinsicRole1.Properties.RoleArn
    ).to.deep.equal({ 'Fn::Attr': ['RoleID', 'Arn'] });
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineWithIntrinsicRole2.Properties.RoleArn
    ).to.deep.equal({ Ref: 'CloudformationId' });
  });

  it('should throw error if role property is neither string nor intrinsic functions', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineWithIntrinsicRole',
          definition: 'definition1\n',
          role: { XXX: ['RoleID', 'Arn'] },
        },
      },
    };
    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);
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

  it('should print pretty JSON for the state machine definition', () => {
    const definition = {
      Comment: 'Hello World',
      StartAt: 'HelloWorld',
      States: {
        HelloWorld: {
          Type: 'Task',
          Resource: 'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:hello',
          End: true,
        },
      },
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          name: 'stateMachineBeta1',
          definition,
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();
    const actual = serverlessStepFunctions
      .serverless
      .service
      .provider
      .compiledCloudFormationTemplate
      .Resources
      .StateMachineBeta1
      .Properties
      .DefinitionString;

    expect(actual).to.equal(JSON.stringify(definition, undefined, 2));
  });

  it('should add dependsOn resources', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
          name: 'stateMachineBeta1',
          dependsOn: 'DynamoDBTable',
        },
        myStateMachine2: {
          definition: 'definition2',
          name: 'stateMachineBeta2',
          dependsOn: [
            'DynamoDBTable',
            'KinesisStream',
          ],
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
    ).to.deep.eq(['IamRoleStateMachineExecution', 'DynamoDBTable']);
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2.DependsOn
    ).to.deep.eq(['IamRoleStateMachineExecution', 'DynamoDBTable', 'KinesisStream']);
  });

  it('should throw error when dependsOn property is neither string nor [string]', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
          name: 'stateMachineBeta1',
          dependsOn: { Ref: 'ss' },
        },
      },
    };
    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
          name: 'stateMachineBeta1',
          dependsOn: [{ Ref: 'ss' }],
        },
      },
    };
    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);
  });

  it('should add tags', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
          name: 'stateMachineBeta1',
          tags: {
            team: 'core',
            score: 42,
          },
        },
        myStateMachine2: {
          definition: 'definition2',
          name: 'stateMachineBeta2',
          tags: {
            team: 'core',
            score: 42,
          },
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();
    const stateMachineBeta1 = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1;
    const stateMachineBeta2 = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2;
    expect(stateMachineBeta1.Properties.Tags).to.have.lengthOf(2);
    expect(stateMachineBeta2.Properties.Tags).to.have.lengthOf(2);
    expect(stateMachineBeta1.Properties.Tags)
      .to.deep.eq([{ Key: 'team', Value: 'core' }, { Key: 'score', Value: '42' }]);
    expect(stateMachineBeta2.Properties.Tags)
      .to.deep.eq([{ Key: 'team', Value: 'core' }, { Key: 'score', Value: '42' }]);
  });

  it('should add global tags', () => {
    serverless.service.provider.tags = {
      team: 'core',
      score: 42,
    };

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
    const stateMachineBeta1 = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1;
    const stateMachineBeta2 = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2;
    expect(stateMachineBeta1.Properties.Tags).to.have.lengthOf(2);
    expect(stateMachineBeta2.Properties.Tags).to.have.lengthOf(2);
    expect(stateMachineBeta1.Properties.Tags)
      .to.deep.eq([{ Key: 'team', Value: 'core' }, { Key: 'score', Value: '42' }]);
    expect(stateMachineBeta2.Properties.Tags)
      .to.deep.eq([{ Key: 'team', Value: 'core' }, { Key: 'score', Value: '42' }]);
  });

  it('should merge global and state machine tags', () => {
    serverless.service.provider.tags = {
      team: 'core',
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
          name: 'stateMachineBeta1',
          tags: {
            score: 42,
          },
        },
        myStateMachine2: {
          definition: 'definition2',
          name: 'stateMachineBeta2',
          tags: {
            score: 42,
          },
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();
    const stateMachineBeta1 = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta1;
    const stateMachineBeta2 = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachineBeta2;
    expect(stateMachineBeta1.Properties.Tags).to.have.lengthOf(2);
    expect(stateMachineBeta2.Properties.Tags).to.have.lengthOf(2);
    expect(stateMachineBeta1.Properties.Tags)
      .to.deep.eq([{ Key: 'team', Value: 'core' }, { Key: 'score', Value: '42' }]);
    expect(stateMachineBeta2.Properties.Tags)
      .to.deep.eq([{ Key: 'team', Value: 'core' }, { Key: 'score', Value: '42' }]);
  });

  it('should throw error when tags property contains malformed tags', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          definition: 'definition1',
          name: 'stateMachineBeta1',
          tags: ['team:core'],
        },
      },
    };

    expect(() => serverlessStepFunctions.compileStateMachines()).to.throw(Error);
  });

  it('should respect CloudFormation intrinsic functions for Resource', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          name: 'stateMachine',
          definition: {
            StartAt: 'Lambda',
            States: {
              Lambda: {
                Type: 'Task',
                Resource: {
                  Ref: 'MyFunction',
                },
                Next: 'Sns',
              },
              Sns: {
                Type: 'Task',
                Resource: 'arn:aws:states:::sns:publish',
                Parameters: {
                  Message: {
                    'Fn::GetAtt': ['MyTopic', 'TopicName'],
                  },
                  TopicArn: {
                    Ref: 'MyTopic',
                  },
                },
                Next: 'Sqs',
              },
              Sqs: {
                Type: 'Task',
                Resource: 'arn:aws:states:::sqs:sendMessage',
                Parameters: {
                  QueueUrl: {
                    Ref: 'MyQueue',
                  },
                  MessageBody: 'This is a static message',
                },
                Next: 'Parallel',
              },
              Parallel: {
                Type: 'Parallel',
                End: true,
                Branches: [
                  {
                    StartAt: 'Lambda2',
                    States: {
                      Lambda2: {
                        Type: 'Task',
                        Resource: {
                          Ref: 'MyFunction2',
                        },
                        End: true,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileStateMachines();
    const stateMachine = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .StateMachine;

    expect(stateMachine.Properties.DefinitionString).to.haveOwnProperty('Fn::Sub');
    expect(stateMachine.Properties.DefinitionString['Fn::Sub']).to.have.lengthOf(2);

    const [json, params] = stateMachine.Properties.DefinitionString['Fn::Sub'];
    const modifiedDefinition = JSON.parse(json);

    const lambda = modifiedDefinition.States.Lambda;
    expect(lambda.Resource.startsWith('${')).to.eq(true);
    const functionParam = lambda.Resource.replace(/[${}]/g, '');
    expect(params).to.haveOwnProperty(functionParam);
    expect(params[functionParam]).to.eql({ Ref: 'MyFunction' });

    const sns = modifiedDefinition.States.Sns;
    expect(sns.Parameters.Message.startsWith('${')).to.eq(true);
    const topicNameParam = sns.Parameters.Message.replace(/[${}]/g, '');
    expect(params).to.haveOwnProperty(topicNameParam);
    expect(params[topicNameParam]).to.eql({ 'Fn::GetAtt': ['MyTopic', 'TopicName'] });
    expect(sns.Parameters.TopicArn.startsWith('${')).to.eq(true);
    const topicArnParam = sns.Parameters.TopicArn.replace(/[${}]/g, '');
    expect(params).to.haveOwnProperty(topicArnParam);
    expect(params[topicArnParam]).to.eql({ Ref: 'MyTopic' });

    const sqs = modifiedDefinition.States.Sqs;
    expect(sqs.Parameters.QueueUrl.startsWith('${')).to.eq(true);
    const queueUrlParam = sqs.Parameters.QueueUrl.replace(/[${}]/g, '');
    expect(params[queueUrlParam]).to.eql({ Ref: 'MyQueue' });

    const parallel = modifiedDefinition.States.Parallel;
    expect(parallel.Branches).to.have.lengthOf(1);
    const lambda2 = parallel.Branches[0].States.Lambda2;
    expect(lambda2.Resource.startsWith('${')).to.eq(true);
    const functionParam2 = lambda2.Resource.replace(/[${}]/g, '');
    expect(params).to.haveOwnProperty(functionParam2);
    expect(params[functionParam2]).to.eql({ Ref: 'MyFunction2' });
  });
});
