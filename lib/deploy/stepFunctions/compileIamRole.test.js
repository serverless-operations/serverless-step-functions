'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const sinon = require('sinon');
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
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution.Type).to.equal('AWS::IAM::Role');
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
    const genStateMachine = name => ({
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
    const genStateMachine = name => ({
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

    const genStateMachine = name => ({
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
    const genStateMachine = name => ({
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

    const batchPermissions = statements.filter(s => _.isEqual(s.Action, ['batch:SubmitJob', 'batch:DescribeJobs', 'batch:TerminateJob']));
    expect(batchPermissions).to.have.lengthOf(1);
    expect(batchPermissions[0].Resource).to.equal('*');

    const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
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

  it('should give glue permissions (too permissive, but mirrors console behaviour)', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::glue:startJobRun',
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::glue:startJobRun.sync',
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

    const gluePermissions = statements.filter(s => _.isEqual(s.Action,
      ['glue:StartJobRun', 'glue:GetJobRun', 'glue:GetJobRuns', 'glue:BatchStopJobRun']));
    expect(gluePermissions).to.have.lengthOf(1);
    expect(gluePermissions[0].Resource).to.equal('*');
  });

  it('should give ECS permissions (too permissive, but mirrors console behaviour)', () => {
    const genStateMachine = name => ({
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

    const ecsPermissions = statements.filter(s => _.isEqual(s.Action, ['ecs:RunTask', 'ecs:StopTask', 'ecs:DescribeTasks', 'iam:PassRole']));
    expect(ecsPermissions).to.have.lengthOf(1);
    expect(ecsPermissions[0].Resource).to.equal('*');

    const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
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

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
    expect(lambdaPermissions).to.have.lengthOf(1);
    expect(lambdaPermissions[0].Resource).to.deep.eq([lambda1, lambda2]);

    const snsPermissions = statements.filter(s => _.isEqual(s.Action, ['sns:Publish']));
    expect(snsPermissions).to.have.lengthOf(1);
    expect(snsPermissions[0].Resource).to.deep.eq([sns1, sns2]);

    const sqsPermissions = statements.filter(s => _.isEqual(s.Action, ['sqs:SendMessage']));
    expect(sqsPermissions).to.have.lengthOf(1);
    expect(sqsPermissions[0].Resource).to.deep.eq([sqsArn1, sqsArn2]);

    const dynamodbPermissions = statements.filter(s => _.isEqual(s.Action, ['dynamodb:UpdateItem', 'dynamodb:PutItem']));
    expect(dynamodbPermissions).to.have.lengthOf(1);
    expect(dynamodbPermissions[0].Resource).to.deep.eq([dynamodbArn1, dynamodbArn2]);
  });

  it('should not generate any permissions for Pass states', () => {
    const genStateMachine = name => ({
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
    const genStateMachine = name => ({
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
    const genStateMachine = name => ({
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
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0];

    const statements = policy.PolicyDocument.Statement;

    const lambdaPermissions = statements.find(x => x.Action[0] === 'lambda:InvokeFunction');
    expect(lambdaPermissions.Resource).to.be.deep.equal([
      { Ref: 'MyFunction' }, { Ref: 'MyFunction2' }]);

    const snsPermissions = statements.find(x => x.Action[0] === 'sns:Publish');
    expect(snsPermissions.Resource).to.be.deep.equal([{ Ref: 'MyTopic' }]);

    const sqsPermissions = statements.find(x => x.Action[0] === 'sqs:SendMessage');
    expect(sqsPermissions.Resource).to.be.deep.equal([{
      'Fn::GetAtt': ['MyQueue', 'Arn'],
    }]);

    const dynamodbPermissions = statements.find(x => x.Action[0] === 'dynamodb:PutItem');
    expect(dynamodbPermissions.Resource).to.be.deep.equal([{
      'Fn::GetAtt': ['MyTable', 'Arn'],
    }]);
  });

  it('should support callbacks', () => {
    const getStateMachine = (name, function1, function2, snsTopicArn, sqsQueueUrl) => ({
      name,
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
        myStateMachine1: getStateMachine('sm1', lambda1, lambda2, sns1, sqs1),
        myStateMachine2: getStateMachine('sm2', lambda3, lambda4, sns2, sqs2),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyDocument.Statement;

    const ecsPermissions = statements.filter(s => _.isEqual(s.Action, ['ecs:RunTask', 'ecs:StopTask', 'ecs:DescribeTasks', 'iam:PassRole']));
    expect(ecsPermissions).to.have.lengthOf(1);
    expect(ecsPermissions[0].Resource).to.equal('*');

    const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
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

    const snsPermissions = statements.filter(s => _.isEqual(s.Action, ['sns:Publish']));
    expect(snsPermissions).to.have.lengthOf(1);
    expect(snsPermissions[0].Resource).to.deep.eq([sns1, sns2]);

    const sqsPermissions = statements.filter(s => _.isEqual(s.Action, ['sqs:SendMessage']));
    expect(sqsPermissions).to.have.lengthOf(1);
    expect(sqsPermissions[0].Resource).to.deep.eq([sqsArn1, sqsArn2]);

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      { 'Fn::Sub': 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:a' },
      { 'Fn::Sub': 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:b:v1' },
      'arn:aws:lambda:us-west-2:1234567890:function:c',
      { 'Fn::Sub': 'arn:aws:lambda:${AWS::Region}:1234567890:function:d' },
    ];
    expect(lambdaPermissions[0].Resource).to.deep.eq(lambdaArns);
  });

  it('should support lambda::invoke resource type', () => {
    const getStateMachine = (name, functionName) => ({
      name,
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
        myStateMachine1: getStateMachine('sm1', lambda1),
        myStateMachine2: getStateMachine('sm2', lambda2),
        myStateMachine3: getStateMachine('sm3', lambda3),
        myStateMachine4: getStateMachine('sm4', lambda4),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      { 'Fn::Sub': 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:a' },
      { 'Fn::Sub': 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:b:v1' },
      'arn:aws:lambda:us-west-2:1234567890:function:c',
      { 'Fn::Sub': 'arn:aws:lambda:${AWS::Region}:1234567890:function:d' },
    ];
    expect(lambdaPermissions[0].Resource).to.deep.eq(lambdaArns);
  });

  it('should support intrinsic functions for lambda::invoke resource type', () => {
    const getStateMachine = (name, functionName) => ({
      name,
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
        'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${FunctionName}',
        {
          FunctionName: 'myFunction',
        },
      ],
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('sm1', lambda1),
        myStateMachine2: getStateMachine('sm2', lambda2),
        myStateMachine3: getStateMachine('sm3', lambda3),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      {
        'Fn::Sub': [
          'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${FunctionName}',
          { FunctionName: lambda1 },
        ],
      },
      {
        'Fn::GetAtt': [
          'MyFunction',
          'Arn',
        ],
      },
      {
        'Fn::Sub': [
          'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${FunctionName}',
          {
            FunctionName: 'myFunction',
          },
        ],
      },
    ];
    expect(lambdaPermissions[0].Resource).to.deep.eq(lambdaArns);
  });

  it('should support local function names', () => {
    const getStateMachine = (name, functionName) => ({
      name,
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

    serverless.functions = {
      'hello-world': {
        handler: 'hello-world.handler',
      },
    };

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: getStateMachine('sm1', lambda1),
        myStateMachine2: getStateMachine('sm2', lambda2),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      {
        'Fn::Sub': [
          'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${FunctionName}',
          { FunctionName: { Ref: 'HelloDashworldLambdaFunction' } },
        ],
      },
      {
        'Fn::GetAtt': [
          'HelloDashworldLambdaFunction',
          'Arn',
        ],
      },
    ];
    expect(lambdaPermissions[0].Resource).to.deep.eq(lambdaArns);
  });
});
