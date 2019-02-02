'use strict';

const _ = require('lodash');
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
    serverless.cli = { consoleLog: console.log };
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
    const helloLambda = 'arn:aws:lambda:123:*:function:hello';
    const worldLambda = 'arn:aws:lambda:*:*:function:world';
    const fooLambda = 'arn:aws:lambda:us-west-2::function:foo_';
    const barLambda = 'arn:aws:lambda:#{AWS::Region}:#{AWS::AccountId}:function:bar';

    const genStateMachine = (name, lambda1, lambda2) => ({
      name,
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
        myStateMachine1: genStateMachine('stateMachineBeta1', helloLambda, worldLambda),
        myStateMachine2: genStateMachine('stateMachineBeta2', fooLambda, barLambda),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloLambda, worldLambda, fooLambda, barLambda]);
  });

  it('should give sns:Publish permission for only SNS topics referenced by state machine', () => {
    const helloTopic = 'arn:aws:sns:#{AWS::Region}:#{AWS::AccountId}:hello';
    const worldTopic = 'arn:aws:sns:us-east-1:#{AWS::AccountId}:world';

    const genStateMachine = (name, snsTopic) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sns:publish',
            Parameters: {
              Message: '42',
              TopicArn: snsTopic,
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1', helloTopic),
        myStateMachine2: genStateMachine('stateMachineBeta2', worldTopic),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloTopic, worldTopic]);
  });

  it('should give sns:Publish permission to * whenever TopicArn.$ is seen', () => {
    const helloTopic = 'arn:aws:sns:#{AWS::Region}:#{AWS::AccountId}:hello';
    const worldTopic = 'arn:aws:sns:us-east-1:#{AWS::AccountId}:world';

    const genStateMachine = (name, snsTopic) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sns:publish',
            Parameters: {
              Message: '42',
              TopicArn: snsTopic,
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sns:publish',
            Parameters: {
              Message: '42',
              'TopicArn.$': '$.snsTopic',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1', helloTopic),
        myStateMachine2: genStateMachine('stateMachineBeta2', worldTopic),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];

    // even though some tasks target specific topic ARNs, but because some other states
    // use TopicArn.$ we need to give broad permissions to be able to publish to any
    // topic that the input specifies
    expect(policy.PolicyDocument.Statement[0].Resource).to.equal('*');
  });

  it('should not give sns:Publish permission if TopicArn and TopicArn.$ are missing', () => {
    const genStateMachine = (name) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sns:publish',
            Parameters: {
              MessageBody: '42',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should give sqs:SendMessage permission for only SQS referenced by state machine', () => {
    const helloQueue = 'https://sqs.#{AWS::Region}.amazonaws.com/#{AWS::AccountId}/hello';
    const helloQueueArn = 'arn:aws:sqs:#{AWS::Region}:#{AWS::AccountId}:hello';
    const worldQueue = 'https://sqs.us-east-1.amazonaws.com/#{AWS::AccountId}/world';
    const worldQueueArn = 'arn:aws:sqs:us-east-1:#{AWS::AccountId}:world';

    const genStateMachine = (name, queueUrl) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sqs:sendMessage',
            Parameters: {
              QueueUrl: queueUrl,
              Message: '42',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1', helloQueue),
        myStateMachine2: genStateMachine('stateMachineBeta2', worldQueue),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloQueueArn, worldQueueArn]);
  });

  it('should give sqs:SendMessage permission to * whenever QueueUrl.$ is seen', () => {
    const helloQueue = 'https://sqs.#{AWS::Region}.amazonaws.com/#{AWS::AccountId}/hello';
    const worldQueue = 'https://sqs.us-east-1.amazonaws.com/#{AWS::AccountId}/world';

    const genStateMachine = (name, queueUrl) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sqs:sendMessage',
            Parameters: {
              QueueUrl: queueUrl,
              Message: '42',
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sqs:sendMessage',
            Parameters: {
              'QueueUrl.$': '$.queueUrl',
              Message: '42',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1', helloQueue),
        myStateMachine2: genStateMachine('stateMachineBeta2', worldQueue),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];

    // even if some tasks are targetting specific queues, because QueueUrl.$ is seen
    // we need to give broad permissions allow the queue URL to be specified by input
    expect(policy.PolicyDocument.Statement[0].Resource).to.equal('*');
  });

  it('should not give sqs:SendMessage permission if QueueUrl and QueueUrl.$ are missing', () => {
    const genStateMachine = (name) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sqs:sendMessage',
            Parameters: {
              Message: '42',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should not give sqs:SendMessage permission if QueueUrl is invalid', () => {
    const invalidQueueUrl = 'https://sqs.us-east-1.amazonaws.com/hello';

    const genStateMachine = (name) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sqs:sendMessage',
            Parameters: {
              QueueUrl: invalidQueueUrl,
              Message: '42',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Resource).to.have.lengthOf(0);
  });

  it('should give dynamodb permission for only tables referenced by state machine', () => {
    const helloTable = 'hello';
    const helloTableArn = {
      'Fn::Join': [
        ':', ['arn:aws:dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/hello'],
      ],
    };
    const worldTable = 'world';
    const worldTableArn = {
      'Fn::Join': [
        ':', ['arn:aws:dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/world'],
      ],
    };

    const genStateMachine = (name, tableName) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::dynamodb:updateItem',
            Parameters: {
              TableName: tableName,
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::dynamodb:putItem',
            Parameters: {
              TableName: tableName,
            },
            Next: 'C',
          },
          C: {
            Type: 'Task',
            Resource: 'arn:aws:states:::dynamodb:getItem',
            Parameters: {
              TableName: tableName,
            },
            Next: 'D',
          },
          D: {
            Type: 'Task',
            Resource: 'arn:aws:states:::dynamodb:deleteItem',
            Parameters: {
              TableName: tableName,
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1', helloTable),
        myStateMachine2: genStateMachine('stateMachineBeta2', worldTable),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Action)
      .to.be.deep.equal([
        'dynamodb:UpdateItem',
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:DeleteItem',
      ]);
    expect(policy.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloTableArn, worldTableArn]);
  });

  it('should give dynamodb permission to * whenever TableName.$ is seen', () => {
    const helloTable = 'hello';
    const worldTable = 'world';

    const genStateMachine = (name, tableName) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::dynamodb:updateItem',
            Parameters: {
              TableName: tableName,
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::dynamodb:updateItem',
            Parameters: {
              'TableName.$': '$.tableName',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1', helloTable),
        myStateMachine2: genStateMachine('stateMachineBeta2', worldTable),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Action)
      .to.be.deep.equal(['dynamodb:UpdateItem']);

    // even though some tasks target specific tables, because TableName.$ is used we
    // have to give broad permissions to allow execution to talk to whatever table
    // the input specifies
    expect(policy.PolicyDocument.Statement[0].Resource).to.equal('*');
  });

  it('should give batch permissions (too permissive, but mirrors console behaviour)', () => {
    const genStateMachine = (name) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::batch:submitJob',
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::batch:submitJob.sync',
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyDocument.Statement;

    const batchPermissions = statements.filter(s =>
      _.isEqual(s.Action, ['batch:SubmitJob', 'batch:DescribeJobs', 'batch:TerminateJob'])
    );
    expect(batchPermissions).to.have.lengthOf(1);
    expect(batchPermissions[0].Resource).to.equal('*');

    const eventPermissions = statements.filter(s =>
      _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'])
    );
    expect(eventPermissions).to.has.lengthOf(1);
    expect(eventPermissions[0].Resource).to.deep.eq([{
      'Fn::Join': [
        ':',
        [
          'arn:aws:events',
          { Ref: 'AWS::Region' },
          { Ref: 'AWS::AccountId' },
          'rule/StepFunctionsGetEventsForBatchJobsRule',
        ],
      ],
    }]);
  });

  it('should give ECS permissions (too permissive, but mirrors console behaviour)', () => {
    const genStateMachine = (name) => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::ecs:runTask',
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::ecs:runTask.sync',
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyDocument.Statement;

    const ecsPermissions = statements.filter(s =>
      _.isEqual(s.Action, ['ecs:RunTask', 'ecs:StopTask', 'ecs:DescribeTasks'])
    );
    expect(ecsPermissions).to.have.lengthOf(1);
    expect(ecsPermissions[0].Resource).to.equal('*');

    const eventPermissions = statements.filter(s =>
      _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'])
    );
    expect(eventPermissions).to.has.lengthOf(1);
    expect(eventPermissions[0].Resource).to.deep.eq([{
      'Fn::Join': [
        ':',
        [
          'arn:aws:events',
          { Ref: 'AWS::Region' },
          { Ref: 'AWS::AccountId' },
          'rule/StepFunctionsGetEventsForECSTaskRule',
        ],
      ],
    }]);
  });

  it('should handle nested parallel states', () => {
    const getStateMachine = (name, lambdaArn, snsTopicArn, sqsQueueUrl, dynamodbTable) => ({
      name,
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
        ':', ['arn:aws:dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/foo'],
      ],
    };
    const dynamodbArn2 = {
      'Fn::Join': [
        ':', ['arn:aws:dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/bar'],
      ],
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('sm1', lambda1, sns1, sqs1, dynamodb1),
        myStateMachine2: getStateMachine('sm2', lambda2, sns2, sqs2, dynamodb2),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(s =>
      _.isEqual(s.Action, ['lambda:InvokeFunction']));
    expect(lambdaPermissions).to.have.lengthOf(1);
    expect(lambdaPermissions[0].Resource).to.deep.eq([lambda1, lambda2]);

    const snsPermissions = statements.filter(s => _.isEqual(s.Action, ['sns:Publish']));
    expect(snsPermissions).to.have.lengthOf(1);
    expect(snsPermissions[0].Resource).to.deep.eq([sns1, sns2]);

    const sqsPermissions = statements.filter(s => _.isEqual(s.Action, ['sqs:SendMessage']));
    expect(sqsPermissions).to.have.lengthOf(1);
    expect(sqsPermissions[0].Resource).to.deep.eq([sqsArn1, sqsArn2]);

    const dynamodbPermissions = statements.filter(s =>
      _.isEqual(s.Action, ['dynamodb:UpdateItem', 'dynamodb:PutItem']));
    expect(dynamodbPermissions).to.have.lengthOf(1);
    expect(dynamodbPermissions[0].Resource).to.deep.eq([dynamodbArn1, dynamodbArn2]);
  });

  it('should not generate any permissions for Pass states', () => {
    const genStateMachine = (name) => ({
      name,
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
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should not generate any permissions for Task states not yet supported', () => {
    const genStateMachine = (name) => ({
      name,
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
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should generate a Deny all statement if state machine has no tasks', () => {
    const genStateMachine = (name) => ({
      name,
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
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });
});
