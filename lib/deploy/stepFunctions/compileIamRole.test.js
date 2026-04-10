'use strict';

const _ = require('lodash');
const itParam = require('mocha-param');
const expect = require('chai').expect;
const sinon = require('sinon');
const createServerless = require('../../test/createServerless');
const ServerlessStepFunctions = require('../..');

function getParamsOrArgs(queryLanguage, params, args) {
  return queryLanguage === 'JSONPath'
    ? { Parameters: params }
    : { Arguments: args === undefined ? params : args };
}

describe('#compileIamRole', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = createServerless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.cli = { consoleLog: sinon.spy() };
    const options = {
      stage: 'dev',
      region: 'ap-northeast-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  const expectDenyAllPolicy = (policy) => {
    const statements = policy.PolicyDocument.Statement;
    expect(statements).to.have.lengthOf(1);
    expect(statements[0].Effect).to.equal('Deny');
    expect(statements[0].Action).to.equal('*');
    expect(statements[0].Resource).to.equal('*');
  };

  const getAlias = (functionArn) => ({
    'Fn::Sub': [
      '${functionArn}:*',
      {
        functionArn,
      },
    ],
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
      .provider.compiledCloudFormationTemplate.Resources).to.deep.equal({});
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
    const resources = Object.values(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources);
    expect(resources).to.have.length(1);

    const iamRole = resources[0];
    expect(iamRole.Properties.AssumeRolePolicyDocument.Statement[0].Principal.Service)
      .to.deep.eq({ 'Fn::Sub': 'states.${AWS::Region}.amazonaws.com' });
    expect(iamRole.Properties.Policies[0].PolicyName)
      .to.be.equal('dev-step-functions-statemachine');
  });

  it('should create corresponding resources when role property are not given', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          name: 'stateMachine1',
          definition: 'definition',
          role: 'role',
        },
        myStateMachine2: {
          id: 'StateMachine2',
          name: 'stateMachine2',
          definition: 'definition',
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless
      .service.provider.compiledCloudFormationTemplate.Resources;
    expect(Object.values(resources)).to.have.length(1);
    expect(resources).to.haveOwnProperty('StateMachine2Role');
    expect(resources.StateMachine2Role.Type).to.equal('AWS::IAM::Role');
  });

  it('should give invokeFunction permission for only functions referenced by state machine', () => {
    const helloLambda = 'arn:aws:lambda:123:*:function:hello';
    const worldLambda = 'arn:aws:lambda:*:*:function:world';
    const fooLambda = 'arn:aws:lambda:us-west-2::function:foo_';
    const barLambda = 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:bar';

    const genStateMachine = (id, lambda1, lambda2) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: lambda1,
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: lambda2,
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1', helloLambda, worldLambda),
        myStateMachine2: genStateMachine('StateMachine2', fooLambda, barLambda),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless
      .service.provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    expect(policy1.PolicyDocument.Statement[0].Action).to.deep.equal(['lambda:InvokeFunction']);
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    expect(policy2.PolicyDocument.Statement[0].Action).to.deep.equal(['lambda:InvokeFunction']);

    const expectation = (policy, functions) => {
      const policyResources = policy.PolicyDocument.Statement[0].Resource;
      expect(policyResources).to.have.lengthOf(4);
      expect(policyResources).to.include.members(functions);

      const versionResources = policyResources.filter((x) => x['Fn::Sub']);
      versionResources.forEach((x) => {
        const template = x['Fn::Sub'][0];
        expect(template).to.equal('${functionArn}:*');
      });

      const versionedArns = versionResources.map((x) => x['Fn::Sub'][1].functionArn);
      expect(versionedArns).to.deep.equal(functions);
    };

    expectation(policy1, [helloLambda, worldLambda]);
    expectation(policy2, [fooLambda, barLambda]);
  });

  it('should add discrete iam role permissions', () => {
    const iamRoleStatement = {
      Effect: 'Allow',
      Action: ['service:Action'],
      Resource: ['arn:aws:item'],
    };
    const lambdaArn = 'arn:aws:lambda:123:*:function:hello';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          name: 'stateMachine1',
          iamRoleStatements: [iamRoleStatement],
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: lambdaArn,
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const policies = serverlessStepFunctions.serverless
      .service.provider.compiledCloudFormationTemplate.Resources
      .StateMachine1Role.Properties.Policies;
    expect(policies).to.have.length(1);
    const statements = policies[0].PolicyDocument.Statement;
    expect(statements).to.have.length(2);
    const [statement1, statement2] = statements;
    expect(statement1.Action[0]).to.equal('lambda:InvokeFunction');
    expect(statement2).to.be.deep.equal(iamRoleStatement);
  });

  it('should handle nested parallel states', () => {
    const getStateMachine = (id, lambdaArn, snsTopicArn, sqsQueueUrl, dynamodbTable) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sns:publish',
            Parameters: {
              Message: '42',
              TopicArn: snsTopicArn,
            },
            Next: 'Pass',
          },
          Parallel: {
            Type: 'Parallel',
            Branches: [{
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            }, {
              StartAt: 'C',
              States: {
                C: {
                  Type: 'Task',
                  Resource: 'arn:aws:states:::sqs:sendMessage',
                  Parameters: {
                    QueueUrl: sqsQueueUrl,
                  },
                },
              },
            }, {
              StartAt: 'NestedParallel',
              States: {
                NestedParallel: {
                  Type: 'Parallel',
                  Branches: [{
                    StartAt: 'D',
                    States: {
                      D: {
                        Type: 'Task',
                        Resource: 'arn:aws:states:::dynamodb:updateItem',
                        Parameters: {
                          TableName: dynamodbTable,
                        },
                      },
                    },
                  }, {
                    StartAt: 'E',
                    States: {
                      E: {
                        Type: 'Task',
                        Resource: 'arn:aws:states:::dynamodb:putItem',
                        Parameters: {
                          TableName: dynamodbTable,
                        },
                      },
                    },
                  }],
                },
              },
            }],
          },
        },
      },
    });

    const lambda1 = 'arn:aws:lambda:us-west-2:1234567890:function:foo';
    const lambda2 = 'arn:aws:lambda:us-west-1:#{AWS::AccountId}:function:bar';

    const sns1 = 'arn:aws:sns:us-east-1:1234567890:foo';
    const sns2 = 'arn:aws:sns:us-east-2:#{AWS::AccountId}:bar';

    const sqs1 = 'https://sqs.us-east-1.amazonaws.com/1234567890/foo';
    const sqs2 = 'https://sqs.us-east-2.amazonaws.com/#{AWS::AccountId}/bar';

    const sqsArn1 = 'arn:aws:sqs:us-east-1:1234567890:foo';
    const sqsArn2 = 'arn:aws:sqs:us-east-2:#{AWS::AccountId}:bar';

    const dynamodb1 = 'foo';
    const dynamodb2 = 'bar';

    const dynamodbArn1 = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb',
          { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/foo'],
      ],
    };
    const dynamodbArn2 = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb',
          { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/bar'],
      ],
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('StateMachine1', lambda1, sns1, sqs1, dynamodb1),
        myStateMachine2: getStateMachine('StateMachine2', lambda2, sns2, sqs2, dynamodb2),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];

    const expectation = (policy, lambda, sns, sqsArn, dynamodbArn) => {
      const statements = policy.PolicyDocument.Statement;

      const lambdaPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
      );
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0].Resource).to.include.members([lambda]);

      const snsPermissions = statements.filter((s) => _.isEqual(s.Action, ['sns:Publish']));
      expect(snsPermissions).to.have.lengthOf(1);
      expect(snsPermissions[0].Resource).to.deep.eq([sns]);

      const sqsPermissions = statements.filter((s) => _.isEqual(s.Action, ['sqs:SendMessage']));
      expect(sqsPermissions).to.have.lengthOf(1);
      expect(sqsPermissions[0].Resource).to.deep.eq([sqsArn]);

      const dynamodbPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['dynamodb:UpdateItem', 'dynamodb:PutItem']),
      );
      expect(dynamodbPermissions).to.have.lengthOf(1);
      expect(dynamodbPermissions[0].Resource).to.deep.eq([dynamodbArn]);
    };

    expectation(policy1, lambda1, sns1, sqsArn1, dynamodbArn1);
    expectation(policy2, lambda2, sns2, sqsArn2, dynamodbArn2);
  });

  it('should not generate any permissions for Pass states', () => {
    const genStateMachine = (id) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            Result: 42,
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should not generate any permissions for Task states not yet supported', () => {
    const genStateMachine = (id) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::foo:bar',
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should generate a Deny all statement if state machine has no tasks', () => {
    const genStateMachine = (id) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should respect CloudFormation intrinsic functions for Resource', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
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
                Next: 'DynamoDB',
              },
              DynamoDB: {
                Type: 'Task',
                Resource: 'arn:aws:states:::dynamodb:putItem',
                Parameters: {
                  TableName: {
                    Ref: 'MyTable',
                  },
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

    serverlessStepFunctions.compileIamRole();
    serverlessStepFunctions.compileStateMachines();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];

    const statements = policy.PolicyDocument.Statement;

    const lambdaPermissions = statements.find((x) => x.Action[0] === 'lambda:InvokeFunction');
    expect(lambdaPermissions.Resource).to.deep.include.members([
      { Ref: 'MyFunction' }, { Ref: 'MyFunction2' }]);

    const snsPermissions = statements.find((x) => x.Action[0] === 'sns:Publish');
    expect(snsPermissions.Resource).to.be.deep.equal([{ Ref: 'MyTopic' }]);

    const sqsPermissions = statements.find((x) => x.Action[0] === 'sqs:SendMessage');
    expect(sqsPermissions.Resource).to.be.deep.equal([{
      'Fn::GetAtt': ['MyQueue', 'Arn'],
    }]);

    const dynamodbPermissions = statements.find((x) => x.Action[0] === 'dynamodb:PutItem');
    expect(dynamodbPermissions.Resource).to.be.deep.equal([{
      'Fn::GetAtt': ['MyTable', 'Arn'],
    }]);
  });

  it('should support callbacks', () => {
    const getStateMachine = (id, function1, function2, snsTopicArn, sqsQueueUrl) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sns:publish.waitForTaskToken',
            Parameters: {
              Message: {
                'Input.$': '$',
                'TaskToken.$': '$$.Task.Token',
              },
              MessageStructure: 'json',
              TopicArn: snsTopicArn,
            },
            Next: 'B1',
          },
          B1: {
            Type: 'Task',
            Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
            Parameters: {
              FunctionName: function1,
              Payload: {
                'model.$': '$',
                'token.$': '$$.Task.Token',
              },
            },
            Next: 'B2',
          },
          B2: {
            Type: 'Task',
            Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
            Parameters: {
              FunctionName: function2,
              Payload: {
                'model.$': '$',
                'token.$': '$$.Task.Token',
              },
            },
            Next: 'C',
          },
          C: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sqs:sendMessage.waitForTaskToken',
            Parameters: {
              QueueUrl: sqsQueueUrl,
              MessageBody: {
                'Input.$': '$',
                'TaskToken.$': '$$.Task.Token',
              },
            },
            Next: 'D',
          },
          D: {
            Type: 'Task',
            Resource: 'arn:aws:states:::ecs:runTask.waitForTaskToken',
            Parameters: {
              LaunchType: 'FARGATE',
              Cluster: 'cluster-arn',
              TaskDefinition: 'job-id',
              Overrides: {
                ContainerOverrides: [
                  {
                    Name: 'cluster-name',
                    Environment: [
                      {
                        Name: 'TASK_TOKEN_ENV_VARIABLE',
                        'Value.$': '$$.Task.Token',
                      },
                    ],
                  },
                ],
              },
            },
            End: true,
          },
        },
      },
    });

    // function name can be...
    const lambda1 = 'a'; // name-only
    const lambda2 = 'b:v1'; // name-only with alias
    const lambda3 = 'arn:aws:lambda:us-west-2:1234567890:function:c'; // full arn
    const lambda4 = '1234567890:function:d'; // partial arn

    const sns1 = 'arn:aws:sns:us-east-1:1234567890:foo';
    const sns2 = 'arn:aws:sns:us-east-2:#{AWS::AccountId}:bar';

    const sqs1 = 'https://sqs.us-east-1.amazonaws.com/1234567890/foo';
    const sqs2 = 'https://sqs.us-east-2.amazonaws.com/#{AWS::AccountId}/bar';

    const sqsArn1 = 'arn:aws:sqs:us-east-1:1234567890:foo';
    const sqsArn2 = 'arn:aws:sqs:us-east-2:#{AWS::AccountId}:bar';

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('StateMachine1', lambda1, lambda2, sns1, sqs1),
        myStateMachine2: getStateMachine('StateMachine2', lambda3, lambda4, sns2, sqs2),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];

    const expectation = (policy, lambdaArns, sns, sqsArn) => {
      const statements = policy.PolicyDocument.Statement;

      const ecsPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['ecs:RunTask', 'ecs:StopTask', 'ecs:DescribeTasks',
          'ecs:TagResource', 'iam:PassRole']),
      );
      expect(ecsPermissions).to.have.lengthOf(1);
      expect(ecsPermissions[0].Resource).to.equal('*');

      const eventPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']),
      );
      expect(eventPermissions).to.has.lengthOf(1);
      expect(eventPermissions[0].Resource).to.deep.eq([{
        'Fn::Join': [
          ':',
          [
            'arn',
            { Ref: 'AWS::Partition' },
            'events',
            { Ref: 'AWS::Region' },
            { Ref: 'AWS::AccountId' },
            'rule/StepFunctionsGetEventsForECSTaskRule',
          ],
        ],
      }]);

      const snsPermissions = statements.filter((s) => _.isEqual(s.Action, ['sns:Publish']));
      expect(snsPermissions).to.have.lengthOf(1);
      expect(snsPermissions[0].Resource).to.deep.eq([sns]);

      const sqsPermissions = statements.filter((s) => _.isEqual(s.Action, ['sqs:SendMessage']));
      expect(sqsPermissions).to.have.lengthOf(1);
      expect(sqsPermissions[0].Resource).to.deep.eq([sqsArn]);

      const lambdaPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
      );
      expect(lambdaPermissions).to.have.lengthOf(1);

      expect(lambdaPermissions[0].Resource).to.deep.include.members(lambdaArns);
    };

    const lambdaArns1 = [
      { 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:a' },
      { 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:b:v1' },
    ];
    expectation(policy1, lambdaArns1, sns1, sqsArn1);

    const lambdaArns2 = [
      'arn:aws:lambda:us-west-2:1234567890:function:c',
      { 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:1234567890:function:d' },
    ];
    expectation(policy2, lambdaArns2, sns2, sqsArn2);
  });

  it('should support lambda::invoke resource type', () => {
    const getStateMachine = (id, functionName) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::lambda:invoke',
            Parameters: {
              FunctionName: functionName,
              Payload: {
                'ExecutionName.$': '$$.Execution.Name',
              },
            },
            End: true,
          },
        },
      },
    });

    // function name can be...
    const lambda1 = 'a'; // name-only
    const lambda2 = 'b:v1'; // name-only with alias
    const lambda3 = 'arn:aws:lambda:us-west-2:1234567890:function:c'; // full arn
    const lambda4 = '1234567890:function:d'; // partial arn

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('StateMachine1', lambda1),
        myStateMachine2: getStateMachine('StateMachine2', lambda2),
        myStateMachine3: getStateMachine('StateMachine3', lambda3),
        myStateMachine4: getStateMachine('StateMachine4', lambda4),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    const policy3 = resources.StateMachine3Role.Properties.Policies[0];
    const policy4 = resources.StateMachine4Role.Properties.Policies[0];

    const expectation = (policy, lambdaArn) => {
      const statements = policy.PolicyDocument.Statement;

      const lambdaPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
      );
      expect(lambdaPermissions).to.have.lengthOf(1);

      expect(lambdaPermissions[0].Resource).to.deep.include(lambdaArn);
    };

    expectation(policy1, {
      'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:a',
    });
    expectation(policy2, {
      'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:b:v1',
    });
    expectation(policy3, 'arn:aws:lambda:us-west-2:1234567890:function:c');
    expectation(policy4, {
      'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:1234567890:function:d',
    });
  });

  it('should support intrinsic functions for lambda::invoke resource type', () => {
    const getStateMachine = (id, functionName) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::lambda:invoke',
            Parameters: {
              FunctionName: functionName,
              Payload: {
                'ExecutionName.$': '$$.Execution.Name',
              },
            },
            End: true,
          },
        },
      },
    });

    // function name can be...
    const lambda1 = { Ref: 'MyFunction' }; // name
    const lambda2 = { 'Fn::GetAtt': ['MyFunction', 'Arn'] }; // Arn
    const lambda3 = { // or, something we don't need special handling for
      'Fn::Sub': [
        'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${FunctionName}',
        {
          FunctionName: 'myFunction',
        },
      ],
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('StateMachine1', lambda1),
        myStateMachine2: getStateMachine('StateMachine2', lambda2),
        myStateMachine3: getStateMachine('StateMachine3', lambda3),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    const policy3 = resources.StateMachine3Role.Properties.Policies[0];

    const expectation = (policy, lambdaArn) => {
      const statements = policy.PolicyDocument.Statement;

      const lambdaPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
      );
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0].Resource).to.deep.include(lambdaArn);
    };

    const lambdaArn1 = {
      'Fn::Sub': [
        'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${functionArn}',
        { functionArn: lambda1 },
      ],
    };
    expectation(policy1, lambdaArn1);

    const lambdaArn2 = {
      'Fn::GetAtt': [
        'MyFunction',
        'Arn',
      ],
    };
    expectation(policy2, lambdaArn2);

    const lambdaArn3 = {
      'Fn::Sub': [
        'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${FunctionName}',
        {
          FunctionName: 'myFunction',
        },
      ],
    };
    expectation(policy3, lambdaArn3);
  });

  it('should support local function names', () => {
    const getStateMachine = (id) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: {
              'Fn::GetAtt': ['hello-world', 'Arn'],
            },
            End: true,
          },
        },
      },
    });

    serverless.service.functions = {
      'hello-world': {
        handler: 'hello-world.handler',
      },
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(
      (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
    );
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      {
        'Fn::GetAtt': [
          'HelloDashworldLambdaFunction',
          'Arn',
        ],
      },
    ];
    expect(lambdaPermissions[0].Resource).to.deep.include.members(lambdaArns);
  });

  it('should support local function names for lambda::invoke resource type', () => {
    const getStateMachine = (id, functionName) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::lambda:invoke',
            Parameters: {
              FunctionName: functionName,
              Payload: {
                'ExecutionName.$': '$$.Execution.Name',
              },
            },
            End: true,
          },
        },
      },
    });

    const lambda1 = { Ref: 'hello-world' };
    const lambda2 = { 'Fn::GetAtt': ['hello-world', 'Arn'] };

    serverless.service.functions = {
      'hello-world': {
        handler: 'hello-world.handler',
      },
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('StateMachine1', lambda1),
        myStateMachine2: getStateMachine('StateMachine2', lambda2),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];

    const expectation = (policy, lambdaArn) => {
      const statements = policy.PolicyDocument.Statement;

      const lambdaPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
      );
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0].Resource).to.deep.include(lambdaArn);
    };

    const lambdaArns = [
      {
        'Fn::Sub': [
          'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${functionArn}',
          { functionArn: { Ref: 'HelloDashworldLambdaFunction' } },
        ],
      },
      {
        'Fn::GetAtt': [
          'HelloDashworldLambdaFunction',
          'Arn',
        ],
      },
    ];

    expectation(policy1, lambdaArns[0]);
    expectation(policy2, lambdaArns[1]);
  });

  it('should support lambda ARNs as task resource with and without aliases', () => {
    const getStateMachine = (id) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:region:accountId:function:with-alias:some-alias',
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:region:accountId:function:no-alias',
            End: true,
          },
        },
      },
    });

    serverless.service.functions = {
      'with-alias': {
        handler: 'with-alias.handler',
      },
      'no-alias': {
        handler: 'with-alias.handler',
      },
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('StateMachine1'),
        myStateMachine2: getStateMachine('StateMachine2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];

    const expectation = (policy, ...lambdaArns) => {
      const statements = policy.PolicyDocument.Statement;

      const lambdaPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
      );
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0].Resource).to.deep.include.members(lambdaArns);
    };

    const lambdaArns = [
      'arn:aws:lambda:region:accountId:function:with-alias',
      getAlias('arn:aws:lambda:region:accountId:function:with-alias'),
      'arn:aws:lambda:region:accountId:function:no-alias',
      getAlias('arn:aws:lambda:region:accountId:function:no-alias'),
    ];

    expectation(policy1, lambdaArns[0], lambdaArns[1]);
    expectation(policy2, lambdaArns[2], lambdaArns[3]);
  });

  it('should support Map state type', () => {
    const getStateMachine = (id, lambdaArn) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Map',
            Iterator: {
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: getStateMachine(
          'StateMachine1',
          'arn:aws:lambda:us-west-2:1234567890:function:foo',
        ),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(
      (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
    );
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      'arn:aws:lambda:us-west-2:1234567890:function:foo',
      getAlias('arn:aws:lambda:us-west-2:1234567890:function:foo'),
    ];
    expect(lambdaPermissions[0].Resource).to.deep.equal(lambdaArns);
  });

  it('should support Distributed Map state type', () => {
    const getStateMachine = (id, lambdaArn) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Map',
            ItemProcessor: {
              ProcessorConfig: {
                Mode: 'DISTRIBUTED',
              },
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: getStateMachine(
          'StateMachine1',
          'arn:aws:lambda:us-west-2:1234567890:function:foo',
        ),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(
      (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
    );
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      'arn:aws:lambda:us-west-2:1234567890:function:foo',
      getAlias('arn:aws:lambda:us-west-2:1234567890:function:foo'),
    ];
    expect(lambdaPermissions[0].Resource).to.deep.equal(lambdaArns);

    const stepFunctionPermission = statements.filter(
      (s) => _.isEqual(s.Action, ['states:StartExecution']),
    );
    expect(stepFunctionPermission).to.have.lengthOf(1);
    expect(stepFunctionPermission[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        'arn:${AWS::Partition}:states:${AWS::Region}:${AWS::AccountId}:stateMachine:myStateMachine',
        {},
      ],
    },
    ]);
  });

  it('should support custom state machine names in a Distributed Map', () => {
    const getStateMachine = (id, lambdaArn) => ({
      id,
      name: 'DistributedMapper',
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Map',
            ItemProcessor: {
              ProcessorConfig: {
                Mode: 'DISTRIBUTED',
              },
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: getStateMachine(
          'StateMachine1',
          'arn:aws:lambda:us-west-2:1234567890:function:foo',
        ),
      },
    };

    serverlessStepFunctions.compileIamRole();

    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const stepFunctionPermission = statements.filter(
      (s) => _.isEqual(s.Action, ['states:StartExecution']),
    );
    expect(stepFunctionPermission).to.have.lengthOf(1);
    expect(stepFunctionPermission[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        'arn:${AWS::Partition}:states:${AWS::Region}:${AWS::AccountId}'
        + ':stateMachine:DistributedMapper',
        {},
      ],
    },
    ]);
  });

  it('should support nested Map state type', () => {
    const getStateMachine = (id, lambdaArn1, lambdaArn2) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Map',
            Iterator: {
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn1,
                  Next: 'C',
                },
                C: {
                  Type: 'Map',
                  Iterator: {
                    StartAt: 'D',
                    States: {
                      D: {
                        Type: 'Task',
                        Resource: lambdaArn2,
                        End: true,
                      },
                    },
                  },
                  End: true,
                },
              },
            },
            End: true,
          },
        },
      },
    });

    const lambdaArn1 = 'arn:aws:lambda:us-west-2:1234567890:function:foo';
    const lambdaArn2 = 'arn:aws:lambda:us-west-2:1234567890:function:bar';

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: getStateMachine('StateMachine1', lambdaArn1, lambdaArn2),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(
      (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
    );
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      lambdaArn1,
      getAlias(lambdaArn1),
      lambdaArn2,
      getAlias(lambdaArn2),
    ];
    expect(lambdaPermissions[0].Resource).to.deep.equal(lambdaArns);
  });

  it('should give CloudWatch Logs permissions', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          loggingConfig: {
            destinations: [
              {
                'Fn::GetAtt': ['MyLogGroup', 'Arn'],
              },
            ],
          },
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:hello',
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const logsPermissions = statements.filter((s) => s.Action.includes('logs:CreateLogDelivery'));
    expect(logsPermissions).to.have.lengthOf(1);
    expect(logsPermissions[0].Resource).to.equal('*');
    expect(logsPermissions[0].Action).to.deep.equal([
      'logs:CreateLogDelivery',
      'logs:GetLogDelivery',
      'logs:UpdateLogDelivery',
      'logs:DeleteLogDelivery',
      'logs:ListLogDeliveries',
      'logs:PutResourcePolicy',
      'logs:DescribeResourcePolicies',
      'logs:DescribeLogGroups',
    ]);
  });

  it('should give X-Ray permissions', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          tracingConfig: {
            enabled: true,
          },
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:hello',
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const tracingPermissions = statements.filter((s) => s.Action.includes('xray:PutTraceSegments'));
    expect(tracingPermissions).to.have.lengthOf(1);
    expect(tracingPermissions[0].Resource).to.equal('*');
    expect(tracingPermissions[0].Action).to.deep.equal([
      'xray:PutTraceSegments',
      'xray:PutTelemetryRecords',
      'xray:GetSamplingRules',
      'xray:GetSamplingTargets',
    ]);
  });

  itParam('should resolve FunctionName: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::lambda:invoke',
                ...getParamsOrArgs(
                  queryLanguage,
                  {
                    FunctionName: 'arn:aws:lambda:us-west-2:1234567890:function:foo',
                    'Payload.$': '$.Payload',
                  },
                  {
                    FunctionName: 'arn:aws:lambda:us-west-2:1234567890:function:foo',
                    Payload: '{% $states.input.Payload %}',
                  },
                ),
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;
    const lambdaPermissions = statements.filter(
      (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
    );
    expect(lambdaPermissions).to.have.lengthOf(1);
    expect(lambdaPermissions[0].Resource).to.deep.equal([
      'arn:aws:lambda:us-west-2:1234567890:function:foo',
      'arn:aws:lambda:us-west-2:1234567890:function:foo:*',
    ]);
  });

  itParam(
    'should support variable FunctionName: ${value}',
    ['JSONPath', 'JSONata'],
    (queryLanguage) => {
      serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine1: {
            id: 'StateMachine1',
            definition: {
              StartAt: 'A',
              States: {
                A: {
                  Type: 'Task',
                  Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                  ...getParamsOrArgs(
                    queryLanguage,
                    {
                      'FunctionName.$': '$.functionName',
                      Payload: {
                        'model.$': '$.new_model',
                        'token.$': '$$.Task.Token',
                      },
                    },
                    {
                      FunctionName: '{% $states.input.functionName %}',
                      Payload: {
                        model: '{% $states.input.new_model %}',
                        token: '{% $states.context.Task.Token %}',
                      },
                    },
                  ),
                  Next: 'B',
                },
                B: {
                  Type: 'Task',
                  Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                  ...getParamsOrArgs(
                    queryLanguage,
                    {
                      'FunctionName.$': '$.functionName',
                      AllowedFunctions: '*limited*',
                      Payload: {
                        'model.$': '$.new_model',
                        'token.$': '$$.Task.Token',
                      },
                    },
                    {
                      FunctionName: '{% $states.input.functionName %}',
                      AllowedFunctions: '*limited*',
                      Payload: {
                        model: '{% $states.input.new_model %}',
                        token: '{% $states.context.Task.Token %}',
                      },
                    },
                  ),
                  End: true,
                },
              },
            },
          },
        },
      };
      serverlessStepFunctions.compileIamRole();
      const statements = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;
      const lambdaPermissions = statements.filter(
        (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
      );
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0].Resource).to.deep.equal('*');
      // Run the test again with limitations added
      serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine1: {
            id: 'StateMachine1',
            definition: {
              StartAt: 'A',
              States: {
                A: {
                  Type: 'Task',
                  Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                  ...getParamsOrArgs(
                    queryLanguage,
                    {
                      'FunctionName.$': '$.functionName',
                      AllowedFunctions: 'arn:aws:lambda:us-west-2:1234567890:function:foo',
                      Payload: {
                        'model.$': '$.new_model',
                        'token.$': '$$.Task.Token',
                      },
                    },
                    {
                      FunctionName: '{% $states.input.functionName %}',
                      AllowedFunctions: 'arn:aws:lambda:us-west-2:1234567890:function:foo',
                      Payload: {
                        model: '{% $states.input.new_model %}',
                        token: '{% $states.context.Task.Token %}',
                      },
                    },
                  ),
                  Next: 'B',
                },
                B: {
                  Type: 'Task',
                  Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                  ...getParamsOrArgs(
                    queryLanguage,
                    {
                      'FunctionName.$': '$.functionName',
                      AllowedFunctions: '*limited*',
                      Payload: {
                        'model.$': '$.new_model',
                        'token.$': '$$.Task.Token',
                      },
                    },
                    {
                      FunctionName: '{% $states.input.functionName %}',
                      AllowedFunctions: '*limited*',
                      Payload: {
                        model: '{% $states.input.new_model %}',
                        token: '{% $states.context.Task.Token %}',
                      },
                    },
                  ),
                  End: true,
                },
              },
            },
          },
        },
      };
      serverlessStepFunctions.compileIamRole();
      const statements2 = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;
      const lambdaPermissions2 = statements2.filter(
        (s) => _.isEqual(s.Action, ['lambda:InvokeFunction']),
      );
      expect(lambdaPermissions2).to.have.lengthOf(1);
      expect(lambdaPermissions2[0].Resource).to.deep.equal([
        'arn:aws:lambda:us-west-2:1234567890:function:foo',
        '*limited*',
      ]);
    },
  );

  it('should handle permissionsBoundary', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource:
                  'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:hello',
                End: true,
              },
            },
          },
        },
      },
    };
    const permBoundaryArn = 'arn:aws:iam::myAccount:policy/permission_boundary';
    serverless.service.provider.rolePermissionsBoundary = permBoundaryArn;
    serverlessStepFunctions.compileIamRole();
    const boundary = serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.StateMachine1Role.Properties
      .PermissionsBoundary;
    expect(boundary).to.equal(permBoundaryArn);
  });

  it('should handle provider.iam.role.path', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource:
                  'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:hello',
                End: true,
              },
            },
          },
        },
      },
    };
    serverless.service.provider.iam = { role: { path: '/teamA/' } };
    serverlessStepFunctions.compileIamRole();
    const rolePath = serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.StateMachine1Role.Properties
      .Path;
    expect(rolePath).to.equal('/teamA/');
  });

  it('should handle permissions listObjectsV2', () => {
    const myBucket = 'myBucket';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Map',
                ItemProcessor: {
                  ProcessorConfig: {
                    Mode: 'DISTRIBUTED',
                  },
                },
                StartAt: 'B',
                States: {
                  B: {
                    Type: 'Task',
                    Resource: 'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:hello',
                    End: true,
                  },
                },
                ItemReader: {
                  Resource: 'arn:aws:states:::s3:listObjectsV2',
                  Parameters: {
                    Bucket: myBucket,
                    Prefix: 'hello',
                  },
                },
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.StateMachine1Role.Properties.Policies[0]
      .PolicyDocument.Statement;

    expect(statements).to.have.lengthOf(4);
    expect(statements[3].Effect).to.equal('Allow');
    expect(statements[3].Action[0]).to.equal('s3:Get*');
    expect(statements[3].Action[1]).to.equal('s3:List*');
    expect(statements[3].Resource[0])
      .to.deep.equal({ 'Fn::Sub': `arn:\${AWS::Partition}:s3:::${myBucket}` });
    expect(statements[3].Resource[1])
      .to.deep.equal({ 'Fn::Sub': `arn:\${AWS::Partition}:s3:::${myBucket}/*` });
  });

  it('should add permissions for KMS key if present', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          encryptionConfig: {
            KmsKeyId: 'arn:kms:....',
          },
          definition: {},
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.StateMachine1Role.Properties.Policies[0]
      .PolicyDocument.Statement;

    expect(statements).to.have.lengthOf(1);
    expect(statements[0].Effect).to.equal('Allow');
    expect(statements[0].Action[0]).to.equal('kms:Decrypt');
    expect(statements[0].Action[1]).to.equal('kms:Encrypt');
    expect(statements[0].Resource[0]['Fn::Sub']).to.equal('arn:kms:....');
  });

  it('should add KMS data-key permissions for each kmsKeyArn', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          kmsKeyArns: [
            'arn:aws:kms:us-east-1:123456789012:key/key-1',
            { Ref: 'MyKMSKey' },
          ],
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::dynamodb:getItem',
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.StateMachine1Role.Properties.Policies[0]
      .PolicyDocument.Statement;

    const kmsStatements = statements.filter((s) => s.Action.includes('kms:Decrypt'));
    expect(kmsStatements).to.have.lengthOf(1);
    expect(kmsStatements[0].Effect).to.equal('Allow');
    expect(kmsStatements[0].Action).to.deep.equal([
      'kms:Decrypt',
      'kms:Encrypt',
      'kms:ReEncrypt*',
      'kms:GenerateDataKey*',
      'kms:DescribeKey',
    ]);
    expect(kmsStatements[0].Resource).to.deep.equal([
      'arn:aws:kms:us-east-1:123456789012:key/key-1',
      { Ref: 'MyKMSKey' },
    ]);
  });

  it('should not add kms permissions when kmsKeyArns is absent', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::dynamodb:getItem',
                End: true,
              },
            },
          },
        },
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.StateMachine1Role.Properties.Policies[0]
      .PolicyDocument.Statement;

    const kmsStatements = statements.filter((s) => s.Action.includes('kms:Decrypt'));
    expect(kmsStatements).to.have.lengthOf(0);
  });
});
