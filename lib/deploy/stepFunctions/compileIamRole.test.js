'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider');
const ServerlessStepFunctions = require('./../../index');

describe('#compileIamRole', () => {
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

  const getAlias = functionArn => ({
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

      const versionResources = policyResources.filter(x => x['Fn::Sub']);
      versionResources.forEach((x) => {
        const template = x['Fn::Sub'][0];
        expect(template).to.equal('${functionArn}:*');
      });

      const versionedArns = versionResources.map(x => x['Fn::Sub'][1].functionArn);
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

  it('should give sns:Publish permission for only SNS topics referenced by state machine', () => {
    const helloTopic = 'arn:aws:sns:#{AWS::Region}:#{AWS::AccountId}:hello';
    const worldTopic = 'arn:aws:sns:us-east-1:#{AWS::AccountId}:world';

    const genStateMachine = (id, snsTopic) => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1', helloTopic),
        myStateMachine2: genStateMachine('StateMachine2', worldTopic),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    expect(policy1.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloTopic]);
    expect(policy2.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([worldTopic]);
  });

  it('should give sns:Publish permission to * whenever TopicArn.$ is seen', () => {
    const helloTopic = 'arn:aws:sns:#{AWS::Region}:#{AWS::AccountId}:hello';

    const genStateMachine = (id, snsTopic) => ({
      id,
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
        myStateMachine: genStateMachine('StateMachine1', helloTopic),
      },
    };

    serverlessStepFunctions.compileIamRole();

    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];

    // even though some tasks target specific topic ARNs, but because some other states
    // use TopicArn.$ we need to give broad permissions to be able to publish to any
    // topic that the input specifies
    expect(policy.PolicyDocument.Statement[0].Resource).to.equal('*');
  });

  it('should not give sns:Publish permission if TopicArn and TopicArn.$ are missing', () => {
    const genStateMachine = id => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should give sqs:SendMessage permission for only SQS referenced by state machine', () => {
    const helloQueue = 'https://sqs.#{AWS::Region}.amazonaws.com/#{AWS::AccountId}/hello';
    const helloQueueArn = 'arn:aws:sqs:#{AWS::Region}:#{AWS::AccountId}:hello';
    const worldQueue = 'https://sqs.us-east-1.amazonaws.com/#{AWS::AccountId}/world';
    const worldQueueArn = 'arn:aws:sqs:us-east-1:#{AWS::AccountId}:world';
    const govQueue = 'https://sqs.us-gov-east-1.amazonaws.com/#{AWS::AccountId}/cloudGov';
    const govQueueArn = 'arn:aws-us-gov:sqs:us-gov-east-1:#{AWS::AccountId}:cloudGov';

    const genStateMachine = (id, queueUrl) => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1', helloQueue),
        myStateMachine2: genStateMachine('StateMachine2', worldQueue),
        myStateMachine3: genStateMachine('StateMachine3', govQueue),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    const policy3 = resources.StateMachine3Role.Properties.Policies[0];
    expect(policy1.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloQueueArn]);
    expect(policy2.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([worldQueueArn]);
    expect(policy3.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([govQueueArn]);
  });

  it('should give sqs:SendMessage permission to * whenever QueueUrl.$ is seen', () => {
    const helloQueue = 'https://sqs.#{AWS::Region}.amazonaws.com/#{AWS::AccountId}/hello';

    const genStateMachine = (id, queueUrl) => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1', helloQueue),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];

    // even if some tasks are targetting specific queues, because QueueUrl.$ is seen
    // we need to give broad permissions allow the queue URL to be specified by input
    expect(policy.PolicyDocument.Statement[0].Resource).to.equal('*');
  });

  it('should give sqs:SendMessage permission to * whenever QueueUrl is some intrinsic function except Ref', () => {
    const helloQueue = 'https://sqs.#{AWS::Region}.amazonaws.com/#{AWS::AccountId}/hello';

    const genStateMachine = (id, queueUrl) => ({
      id,
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
              QueueUrl: {
                'Fn::ImportValue': 'some-shared-value-here',
              },
              Message: '42',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1', helloQueue),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];

    // when using instrinct functions other than Ref to define QueueUrl
    // we can't recontruct ARN from it, so we need to give broad permissions
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
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];
    expectDenyAllPolicy(policy);
  });

  it('should not give sqs:SendMessage permission if QueueUrl is invalid', () => {
    const invalidQueueUrl = 'https://sqs.us-east-1.amazonaws.com/hello';

    const genStateMachine = id => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Resource).to.have.lengthOf(0);
  });

  it('should give dynamodb permission for only tables referenced by state machine', () => {
    const helloTable = 'hello';
    const helloTableArn = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/hello'],
      ],
    };
    const worldTable = 'world';
    const worldTableArn = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/world'],
      ],
    };

    const genStateMachine = (id, tableName, resources) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: resources[0],
            Parameters: {
              TableName: tableName,
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: resources[1],
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
          E: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:updateTable',
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
        myStateMachine1: genStateMachine('StateMachine1', helloTable, ['arn:aws:states:::dynamodb:updateItem', 'arn:aws:states:::dynamodb:putItem']),
        myStateMachine2: genStateMachine('StateMachine2', worldTable, ['arn:aws:states:::dynamodb:updateItem', 'arn:aws:states:::dynamodb:putItem']),
        myStateMachine3: genStateMachine('StateMachine3', helloTable, ['arn:aws:states:::aws-sdk:dynamodb:updateItem', 'arn:aws:states:::aws-sdk:dynamodb:putItem']),
        myStateMachine4: genStateMachine('StateMachine4', worldTable, ['arn:aws:states:::aws-sdk:dynamodb:updateItem.waitForTaskToken', 'arn:aws:states:::aws-sdk:dynamodb:putItem.waitForTaskToken']),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    const policy3 = resources.StateMachine3Role.Properties.Policies[0];
    const policy4 = resources.StateMachine4Role.Properties.Policies[0];

    [policy1, policy2, policy3, policy4].forEach((policy) => {
      expect(policy.PolicyDocument.Statement[0].Action)
        .to.be.deep.equal([
          'dynamodb:UpdateItem',
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:DeleteItem',
          'dynamodb:UpdateTable',
        ]);
    });

    expect(policy1.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloTableArn]);
    expect(policy2.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([worldTableArn]);
    expect(policy3.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloTableArn]);
    expect(policy4.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([worldTableArn]);
  });

  it('should give dynamodb permission for table name imported from external stack', () => {
    // Necessary to convince the region is in the gov cloud infrastructure.
    const externalHelloTable = { 'Fn::ImportValue': 'HelloStack:Table:Name' };
    const helloTableArn = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, { 'Fn::Join': ['/', ['table', externalHelloTable]] }],
      ],
    };

    const externalWorldTable = { 'Fn::ImportValue': 'WorldStack:Table:Name' };
    const worldTableArn = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, { 'Fn::Join': ['/', ['table', externalWorldTable]] }],
      ],
    };

    const genStateMachine = (id, tableName, resources) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: resources[0],
            Parameters: {
              TableName: tableName,
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: resources[1],
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
        myStateMachine1: genStateMachine('StateMachine1', externalHelloTable, ['arn:aws:states:::dynamodb:updateItem', 'arn:aws:states:::dynamodb:putItem']),
        myStateMachine2: genStateMachine('StateMachine2', externalWorldTable, ['arn:aws:states:::dynamodb:updateItem', 'arn:aws:states:::dynamodb:putItem']),
        myStateMachine3: genStateMachine('StateMachine3', externalHelloTable, ['arn:aws:states:::aws-sdk:dynamodb:updateItem', 'arn:aws:states:::aws-sdk:dynamodb:putItem']),
        myStateMachine4: genStateMachine('StateMachine4', externalWorldTable, ['arn:aws:states:::aws-sdk:dynamodb:updateItem.waitForTaskToken', 'arn:aws:states:::aws-sdk:dynamodb:putItem.waitForTaskToken']),
      },
    };

    serverlessStepFunctions.compileIamRole();

    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    const policy3 = resources.StateMachine3Role.Properties.Policies[0];
    const policy4 = resources.StateMachine4Role.Properties.Policies[0];

    [policy1, policy2, policy3, policy4].forEach((policy) => {
      expect(policy.PolicyDocument.Statement[0].Action)
        .to.be.deep.equal([
          'dynamodb:UpdateItem',
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:DeleteItem',
        ]);
    });

    expect(policy1.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloTableArn]);
    expect(policy2.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([worldTableArn]);
    expect(policy3.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloTableArn]);
    expect(policy4.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([worldTableArn]);
  });

  it('should give dynamodb permission to index table whenever IndexName is provided', () => {
    const helloTable = 'hello';

    const genStateMachine = (id, tableName) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:query',
            Parameters: {
              TableName: tableName,
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:query',
            Parameters: {
              TableName: tableName,
              IndexName: 'GSI1',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1', helloTable),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];

    expect(policy.PolicyDocument.Statement[0].Action)
      .to.be.deep.equal(['dynamodb:Query']);

    expect(policy.PolicyDocument.Statement[0].Resource[0]).to.be.deep.equal({
      'Fn::Join': [':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/hello']],
    });

    expect(policy.PolicyDocument.Statement[0].Resource[1]).to.be.deep.equal({
      'Fn::Join': [':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/hello/index/GSI1']],
    });
  });

  it('should give dynamodb permission to * whenever TableName.$ is seen', () => {
    const helloTable = 'hello';

    const genStateMachine = (id, tableName) => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1', helloTable),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Action)
      .to.be.deep.equal(['dynamodb:UpdateItem']);

    // even though some tasks target specific tables, because TableName.$ is used we
    // have to give broad permissions to allow execution to talk to whatever table
    // the input specifies
    expect(policy.PolicyDocument.Statement[0].Resource).to.equal('*');
  });

  it('should give dynamodb permission to table/TableName/index/* when IndexName.$ is seen', () => {
    const helloTable = 'hello';

    const genStateMachine = (id, tableName) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:query',
            Parameters: {
              TableName: tableName,
              'IndexName.$': '$.myDynamicIndexName',
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1', helloTable),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const policy = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0];
    expect(policy.PolicyDocument.Statement[0].Action)
      .to.be.deep.equal(['dynamodb:Query']);

    // even though some tasks target specific indices, because IndexName.$ is used we
    // have to give broad permissions to allow execution to talk to whatever index
    // the input specifies
    expect(policy.PolicyDocument.Statement[0].Resource[0]['Fn::Join'][1][5]).to.equal('table/hello/index/*');
  });

  it('should give dynamodb permission to table/* whenever TableName.$ and IndexName.$ are seen', () => {
    const genStateMachine = id => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:query',
            Parameters: {
              'TableName.$': '$.myDynamicTableName',
              'IndexName.$': '$.myDynamicIndexName',
            },
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
    expect(policy.PolicyDocument.Statement[0].Action)
      .to.be.deep.equal(['dynamodb:Query']);

    // even though some tasks target specific tables, because TableName.$ is used we
    // have to give broad permissions to allow execution to talk to whatever table
    // the input specifies
    expect(policy.PolicyDocument.Statement[0].Resource[0]).to.equal('*');
  });

  it('should give batch dynamodb permission for only tables referenced by state machine', () => {
    const helloTable = 'hello';
    const helloTableArn = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/hello'],
      ],
    };
    const worldTable = 'world';
    const worldTableArn = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/world'],
      ],
    };

    const genStateMachine = (id, tableName) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:batchWriteItem',
            Parameters: {
              RequestItems: {
                [tableName]: [],
              },
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:batchGetItem',
            Parameters: {
              RequestItems: {
                [tableName]: {},
              },
            },
            End: true,
          },
        },
      },
    });
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1', helloTable),
        myStateMachine2: genStateMachine('StateMachine2', worldTable),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];

    [policy1, policy2].forEach((policy) => {
      expect(policy.PolicyDocument.Statement[0].Action)
        .to.be.deep.equal([
          'dynamodb:BatchWriteItem',
          'dynamodb:BatchGetItem',
        ]);
    });

    expect(policy1.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([helloTableArn]);
    expect(policy2.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([worldTableArn]);
  });

  it('should give batch dynamodb permission to * whenever RequestItems.$ is seen', () => {
    const genStateMachine = id => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:batchWriteItem',
            Parameters: {
              RequestItems: {
                tableName: [],
              },
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:dynamodb:batchWriteItem',
            Parameters: {
              'RequestItems.$': '$.requestItems',
            },
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
    expect(policy.PolicyDocument.Statement[0].Action)
      .to.be.deep.equal(['dynamodb:BatchWriteItem']);

    // even though some tasks target specific tables, because RequestItems.$ is used we
    // have to give broad permissions to allow execution to talk to whatever table
    // the input specifies
    expect(policy.PolicyDocument.Statement[0].Resource).to.equal('*');
  });

  it('should give Redshift Data permissions for safe actions', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:listStatements',
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:describeStatement',
                Next: 'C',
              },
              C: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:getStatementResult',
                Next: 'D',
              },
              D: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:cancelStatement',
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[0];
    expect(statement.Action).to.include('redshift-data:ListStatements');
    expect(statement.Action).to.include('redshift-data:DescribeStatement');
    expect(statement.Action).to.include('redshift-data:GetStatementResult');
    expect(statement.Action).to.include('redshift-data:CancelStatement');
    expect(statement.Resource).to.equal('*');
  });

  it('should give Redshift Data permissions for unsafe actions on a workgroup, given its ARN', () => {
    const workgroupName = 'arn:aws:redshift-serverless:us-east-1:012345678901:workgroup/01234567-89ab-cdef-0123-456789abcdef';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  WorkgroupName: workgroupName,
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  WorkgroupName: workgroupName,
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[0];
    expect(statement.Action).to.include('redshift-data:ExecuteStatement');
    expect(statement.Action).to.include('redshift-data:BatchExecuteStatement');
    expect(statement.Resource).to.have.deep.members([
      workgroupName,
    ]);
  });

  it('should give Redshift Data permissions for unsafe actions on all workgroups, given a name', () => {
    const workgroupName = 'myWorkgroup';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  WorkgroupName: workgroupName,
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  WorkgroupName: workgroupName,
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[0];
    expect(statement.Action).to.include('redshift-data:ExecuteStatement');
    expect(statement.Action).to.include('redshift-data:BatchExecuteStatement');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': 'arn:${AWS::Partition}:redshift-serverless:${AWS::Region}:${AWS::AccountId}:workgroup/*',
    }]);
  });

  it('should give Redshift Data permissions for unsafe actions on all workgroups, promised a name', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  'WorkgroupName.$': '$',
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  'WorkgroupName.$': '$',
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[0];
    expect(statement.Action).to.include('redshift-data:ExecuteStatement');
    expect(statement.Action).to.include('redshift-data:BatchExecuteStatement');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': 'arn:${AWS::Partition}:redshift-serverless:${AWS::Region}:${AWS::AccountId}:workgroup/*',
    }]);
  });

  it('should give Redshift Data permissions for unsafe actions on a cluster, given its identifier', () => {
    const clusterIdentifier = 'myCluster';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  ClusterIdentifier: clusterIdentifier,
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  ClusterIdentifier: clusterIdentifier,
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[0];
    expect(statement.Action).to.include('redshift-data:ExecuteStatement');
    expect(statement.Action).to.include('redshift-data:BatchExecuteStatement');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:cluster:${clusterIdentifier}`,
    }]);
  });

  it('should give Redshift Data permissions for unsafe actions on all clusters, promised an identifier', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  'ClusterIdentifier.$': '$',
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  'ClusterIdentifier.$': '$',
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[0];
    expect(statement.Action).to.include('redshift-data:ExecuteStatement');
    expect(statement.Action).to.include('redshift-data:BatchExecuteStatement');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': 'arn:${AWS::Partition}:redshift:${AWS::Region}:${AWS::AccountId}:cluster:*',
    }]);
  });

  it('should give permissions for unsafe Redshift Data actions to get the value of a secret, given its ARN', () => {
    const secretArn = 'arn:aws:secretsmanager:us-east-1:012345678901:secret:mySecret-ABab01';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  SecretArn: secretArn,
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  SecretArn: secretArn,
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[1];
    expect(statement.Action).to.include('secretsmanager:GetSecretValue');
    expect(statement.Resource).to.have.deep.members([
      secretArn,
    ]);
  });

  it('should give permissions for unsafe Redshift Data actions to get the values of some secrets, given a name', () => {
    const secretArn = 'mySecret';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  SecretArn: secretArn,
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  SecretArn: secretArn,
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[1];
    expect(statement.Action).to.include('secretsmanager:GetSecretValue');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': 'arn:${AWS::Partition}:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:mySecret*',
    }]);
  });

  it('should give permissions for unsafe Redshift Data actions to get the values of all secrets, promised an ARN', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  'SecretArn.$': '$',
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  'SecretArn.$': '$',
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[1];
    expect(statement.Action).to.include('secretsmanager:GetSecretValue');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': 'arn:${AWS::Partition}:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:*',
    }]);
  });

  it('should give permissions for unsafe Redshift Data actions to get temporary credentials for a database user, given its name', () => {
    const dbUser = 'myUser';
    const clusterIdentifier = 'myCluster';
    const database = 'myDatabase';
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  DbUser: dbUser,
                  ClusterIdentifier: clusterIdentifier,
                  Database: database,
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  DbUser: dbUser,
                  ClusterIdentifier: clusterIdentifier,
                  Database: database,
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[1];
    expect(statement.Action).to.include('redshift:GetClusterCredentials');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:dbuser:${clusterIdentifier}/${dbUser}`,
    }, {
      'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:dbname:${clusterIdentifier}/${database}`,
    }]);
  });

  it('should give permissions for unsafe Redshift Data actions to get temporary credentials for all database users, promised a name', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  'DbUser.$': '$',
                  'ClusterIdentifier.$': '$',
                  'Database.$': '$',
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  'DbUser.$': '$',
                  'ClusterIdentifier.$': '$',
                  'Database.$': '$',
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[1];
    expect(statement.Action).to.include('redshift:GetClusterCredentials');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': 'arn:${AWS::Partition}:redshift:${AWS::Region}:${AWS::AccountId}:dbuser:*/*',
    }, {
      'Fn::Sub': 'arn:${AWS::Partition}:redshift:${AWS::Region}:${AWS::AccountId}:dbname:*/*',
    }]);
  });

  it('should give permissions for unsafe Redshift Data actions to get temporary credentials for the current role from workgroups', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  'WorkgroupName.$': '$',
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  'WorkgroupName.$': '$',
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[0];
    expect(statement.Action).to.include('redshift-serverless:GetCredentials');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': 'arn:${AWS::Partition}:redshift-serverless:${AWS::Region}:${AWS::AccountId}:workgroup/*',
    }]);
  });

  it('should give permissions for unsafe Redshift Data actions to get temporary credentials for the current role from clusters', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:executeStatement',
                Parameters: {
                  'ClusterIdentifier.$': '$',
                  'Database.$': '$',
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement',
                Parameters: {
                  'ClusterIdentifier.$': '$',
                  'Database.$': '$',
                },
                End: true,
              },
            },
          },
        },
      },
    };
    serverlessStepFunctions.compileIamRole();
    const statement = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement[1];
    expect(statement.Action).to.include('redshift:GetClusterCredentialsWithIAM');
    expect(statement.Resource).to.have.deep.members([{
      'Fn::Sub': 'arn:${AWS::Partition}:redshift:${AWS::Region}:${AWS::AccountId}:dbname:*/*',
    }]);
  });

  it('should give batch permissions (too permissive, but mirrors console behaviour)', () => {
    const genStateMachine = id => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
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
          'arn',
          { Ref: 'AWS::Partition' },
          'events',
          { Ref: 'AWS::Region' },
          { Ref: 'AWS::AccountId' },
          'rule/StepFunctionsGetEventsForBatchJobsRule',
        ],
      ],
    }]);
  });

  it('should give glue permissions (too permissive, but mirrors console behaviour)', () => {
    const genStateMachine = id => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const gluePermissions = statements.filter(s => _.isEqual(s.Action,
      ['glue:StartJobRun', 'glue:GetJobRun', 'glue:GetJobRuns', 'glue:BatchStopJobRun']));
    expect(gluePermissions).to.have.lengthOf(1);
    expect(gluePermissions[0].Resource).to.equal('*');
  });

  it('should give ECS permissions (too permissive, but mirrors console behaviour)', () => {
    const genStateMachine = id => ({
      id,
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
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
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
          'arn',
          { Ref: 'AWS::Partition' },
          'events',
          { Ref: 'AWS::Region' },
          { Ref: 'AWS::AccountId' },
          'rule/StepFunctionsGetEventsForECSTaskRule',
        ],
      ],
    }]);
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
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/foo'],
      ],
    };
    const dynamodbArn2 = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/bar'],
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

      const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0].Resource).to.include.members([lambda]);

      const snsPermissions = statements.filter(s => _.isEqual(s.Action, ['sns:Publish']));
      expect(snsPermissions).to.have.lengthOf(1);
      expect(snsPermissions[0].Resource).to.deep.eq([sns]);

      const sqsPermissions = statements.filter(s => _.isEqual(s.Action, ['sqs:SendMessage']));
      expect(sqsPermissions).to.have.lengthOf(1);
      expect(sqsPermissions[0].Resource).to.deep.eq([sqsArn]);

      const dynamodbPermissions = statements.filter(s => _.isEqual(s.Action, ['dynamodb:UpdateItem', 'dynamodb:PutItem']));
      expect(dynamodbPermissions).to.have.lengthOf(1);
      expect(dynamodbPermissions[0].Resource).to.deep.eq([dynamodbArn]);
    };

    expectation(policy1, lambda1, sns1, sqsArn1, dynamodbArn1);
    expectation(policy2, lambda2, sns2, sqsArn2, dynamodbArn2);
  });

  it('should not generate any permissions for Pass states', () => {
    const genStateMachine = id => ({
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

  it('should give s3 permissions for only objects referenced by state machine', () => {
    const hello = 'hello.txt';
    const world = 'world.txt';
    const testBucket = 'test-bucket';

    const genStateMachine = (id, bucket, key) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:s3:getObject',
            Parameters: {
              Bucket: bucket,
              Key: key,
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:s3:putObject',
            Parameters: {
              Bucket: bucket,
              Key: key,
              Body: {},
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1', testBucket, hello),
        myStateMachine2: genStateMachine('StateMachine2', testBucket, world),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    expect(policy1.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([`arn:aws:s3:::${testBucket}/${hello}`]);
    expect(policy2.PolicyDocument.Statement[0].Resource)
      .to.be.deep.equal([`arn:aws:s3:::${testBucket}/${world}`]);

    [policy1, policy2].forEach((policy) => {
      expect(policy.PolicyDocument.Statement[0].Action)
        .to.be.deep.equal([
          's3:GetObject',
          's3:PutObject',
        ]);
    });
  });

  it('should give s3:GetObject permission for only objects referenced by state machine with ItemReader', () => {
    const hello = 'hello.txt';
    const world = 'world.txt';
    const testBucket = 'test-bucket';

    const genStateMachine = (id, lambdaArn, bucket, key) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Map',
            ItemProcessor: {
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            ItemReader: {
              Resource: 'arn:aws:states:::s3:getObject',
              Parameters: {
                Bucket: bucket,
                Key: key,
              },
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1',
          'arn:aws:lambda:us-west-2:1234567890:function:foo', testBucket, hello),
        myStateMachine2: genStateMachine('StateMachine2',
          'arn:aws:lambda:us-west-2:1234567890:function:foo', testBucket, world),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    expect(policy1.PolicyDocument.Statement[1].Resource)
      .to.be.deep.equal([`arn:aws:s3:::${testBucket}/${hello}`]);
    expect(policy2.PolicyDocument.Statement[1].Resource)
      .to.be.deep.equal([`arn:aws:s3:::${testBucket}/${world}`]);
  });

  it('should give s3:GetObject permission to * when Bucket.$ and Key.$ are seen on ItemReader', () => {
    const genStateMachine = (id, lambdaArn) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Map',
            ItemProcessor: {
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            ItemReader: {
              Resource: 'arn:aws:states:::s3:getObject',
              Parameters: {
                Bucket: 'test-bucket',
                Key: 'test-key',
              },
            },
            Next: 'C',
          },
          C: {
            Type: 'Map',
            ItemProcessor: {
              StartAt: 'D',
              States: {
                D: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            ItemReader: {
              Resource: 'arn:aws:states:::s3:getObject',
              Parameters: {
                'Bucket.$': '$.testBucket',
                'Key.$': '$.key',
              },
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1',
          'arn:aws:lambda:us-west-2:1234567890:function:foo'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];

    // even though some tasks target specific values, other states use Bucket.$
    // and Key.$  so we need to give broad permissions to be able to get any
    // bucket and key the input specifies
    expect(policy1.PolicyDocument.Statement[1].Resource)
      .to.be.deep.equal('*');
  });

  it('should give s3:PutObject permission for only objects referenced by state machine with ResultWriter', () => {
    const hello = 'hello';
    const world = 'world';
    const testBucket = 'test-bucket';

    const genStateMachine = (id, lambdaArn, bucket, prefix) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Map',
            ItemProcessor: {
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            ResultWriter: {
              Resource: 'arn:aws:states:::s3:putObject',
              Parameters: {
                Bucket: bucket,
                Prefix: prefix,
              },
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1',
          'arn:aws:lambda:us-west-2:1234567890:function:foo', testBucket, hello),
        myStateMachine2: genStateMachine('StateMachine2',
          'arn:aws:lambda:us-west-2:1234567890:function:foo', testBucket, world),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];
    const policy2 = resources.StateMachine2Role.Properties.Policies[0];
    expect(policy1.PolicyDocument.Statement[1].Resource)
      .to.be.deep.equal([`arn:aws:s3:::${testBucket}/${hello}/*`]);
    expect(policy2.PolicyDocument.Statement[1].Resource)
      .to.be.deep.equal([`arn:aws:s3:::${testBucket}/${world}/*`]);
  });

  it('should give s3:PutObject permission to * when Bucket.$ and Prefix.$ are seen on ResultWriter', () => {
    const genStateMachine = (id, lambdaArn) => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Map',
            ItemProcessor: {
              StartAt: 'B',
              States: {
                B: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            ResultWriter: {
              Resource: 'arn:aws:states:::s3:putObject',
              Parameters: {
                Bucket: 'test-bucket',
                Prefix: 'test-prefix',
              },
            },
            Next: 'C',
          },
          C: {
            Type: 'Map',
            ItemProcessor: {
              StartAt: 'D',
              States: {
                D: {
                  Type: 'Task',
                  Resource: lambdaArn,
                  End: true,
                },
              },
            },
            ResultWriter: {
              Resource: 'arn:aws:states:::s3:putObject',
              Parameters: {
                'Bucket.$': '$.testBucket',
                'Prefix.$': '$.prefix',
              },
            },
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('StateMachine1',
          'arn:aws:lambda:us-west-2:1234567890:function:foo'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    const policy1 = resources.StateMachine1Role.Properties.Policies[0];

    // even though some tasks target specific values, other states use Bucket.$
    // and Prefix.$ so we need to give broad permissions to be able to write to
    // any bucket and prefix the input specifies
    expect(policy1.PolicyDocument.Statement[1].Resource)
      .to.be.deep.equal('*');
  });

  it('should not generate any permissions for Task states not yet supported', () => {
    const genStateMachine = id => ({
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
    const genStateMachine = id => ({
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

    const lambdaPermissions = statements.find(x => x.Action[0] === 'lambda:InvokeFunction');
    expect(lambdaPermissions.Resource).to.deep.include.members([
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

      const ecsPermissions = statements.filter(s => _.isEqual(s.Action, ['ecs:RunTask', 'ecs:StopTask', 'ecs:DescribeTasks', 'iam:PassRole']));
      expect(ecsPermissions).to.have.lengthOf(1);
      expect(ecsPermissions[0].Resource).to.equal('*');

      const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
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

      const snsPermissions = statements.filter(s => _.isEqual(s.Action, ['sns:Publish']));
      expect(snsPermissions).to.have.lengthOf(1);
      expect(snsPermissions[0].Resource).to.deep.eq([sns]);

      const sqsPermissions = statements.filter(s => _.isEqual(s.Action, ['sqs:SendMessage']));
      expect(sqsPermissions).to.have.lengthOf(1);
      expect(sqsPermissions[0].Resource).to.deep.eq([sqsArn]);

      const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
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

      const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
      expect(lambdaPermissions).to.have.lengthOf(1);

      expect(lambdaPermissions[0].Resource).to.deep.include(lambdaArn);
    };

    expectation(policy1, { 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:a' });
    expectation(policy2, { 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:b:v1' });
    expectation(policy3, 'arn:aws:lambda:us-west-2:1234567890:function:c');
    expectation(policy4, { 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:1234567890:function:d' });
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

      const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
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
    const getStateMachine = id => ({
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

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
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

      const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
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
    const getStateMachine = id => ({
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

      const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
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

  it('should give CodeBuild permissions', () => {
    const projectName = 'HelloProject';
    const genStateMachine = id => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::codebuild:startBuild',
            Parameters: {
              ProjectName: projectName,
            },
            Next: 'B',
          },
          B: {
            Type: 'Task',
            Resource: 'arn:aws:states:::codebuild:startBuild.sync',
            Parameters: {
              ProjectName: projectName,
            },
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
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const codeBuildPermissions = statements.filter(s => _.isEqual(s.Action, ['codebuild:StartBuild', 'codebuild:StopBuild', 'codebuild:BatchGetBuilds']));
    expect(codeBuildPermissions).to.have.lengthOf(1);
    expect(codeBuildPermissions[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        `arn:\${AWS::Partition}:codebuild:$\{AWS::Region}:$\{AWS::AccountId}:project/${projectName}`,
        {},
      ],
    }]);


    const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
    expect(eventPermissions).to.have.lengthOf(1);
    expect(eventPermissions[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventForCodeBuildStartBuildRule',
        {},
      ],
    }]);
  });

  describe('should give step functions permissions (too permissive, but mirrors console behaviour)', () => {
    it('jsonpath', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const genStateMachine = id => ({
        id,
        definition: {
          StartAt: 'A',
          States: {
            A: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution',
              Parameters: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
              Next: 'B',
            },
            B: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.sync',
              Parameters: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
              Next: 'C',
            },
            C: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.sync:2',
              Parameters: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
              Next: 'D',
            },
            D: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.waitForTaskToken',
              Parameters: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
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
      const statements = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;

      const stateMachinePermissions = statements.filter(s => _.isEqual(s.Action, ['states:StartExecution']));
      expect(stateMachinePermissions).to.have.lengthOf(1);
      expect(stateMachinePermissions[0].Resource).to.deep.eq([stateMachineArn]);

      const executionPermissions = statements.filter(s => _.isEqual(s.Action, ['states:DescribeExecution', 'states:StopExecution']));
      expect(executionPermissions).to.have.lengthOf(1);
      expect(executionPermissions[0].Resource).to.equal('*');

      const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
      expect(eventPermissions).to.have.lengthOf(1);
      expect(eventPermissions[0].Resource).to.deep.eq([{
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForStepFunctionsExecutionRule',
          {},
        ],
      }]);
    });

    it('jsonata', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const genStateMachine = id => ({
        id,
        definition: {
          QueryLanguage: 'JSONata', // JSONPath is default
          StartAt: 'A',
          States: {
            A: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution',
              Arguments: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
              Next: 'B',
            },
            B: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.sync',
              Arguments: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
              Next: 'C',
            },
            C: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.sync:2',
              Arguments: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
              Next: 'D',
            },
            D: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.waitForTaskToken',
              Arguments: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
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
      const statements = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;

      const stateMachinePermissions = statements.filter(s => _.isEqual(s.Action, ['states:StartExecution']));
      expect(stateMachinePermissions).to.have.lengthOf(1);
      expect(stateMachinePermissions[0].Resource).to.deep.eq([stateMachineArn]);

      const executionPermissions = statements.filter(s => _.isEqual(s.Action, ['states:DescribeExecution', 'states:StopExecution']));
      expect(executionPermissions).to.have.lengthOf(1);
      expect(executionPermissions[0].Resource).to.equal('*');

      const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
      expect(eventPermissions).to.have.lengthOf(1);
      expect(eventPermissions[0].Resource).to.deep.eq([{
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForStepFunctionsExecutionRule',
          {},
        ],
      }]);
    });
  });

  describe('should give step functions using sdk permissions (too permissive, but mirrors console behavior)', () => {
    it('jsonpath', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const genStateMachine = id => ({
        id,
        definition: {
          StartAt: 'A',
          States: {
            A: {
              Type: 'Task',
              Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
              Parameters: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
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
      const statements = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;

      const stateMachinePermissions = statements.filter(s => _.isEqual(s.Action, ['states:StartSyncExecution']));
      expect(stateMachinePermissions).to.have.lengthOf(1);
      expect(stateMachinePermissions[0].Resource).to.deep.eq([stateMachineArn]);

      const executionPermissions = statements.filter(s => _.isEqual(s.Action, ['states:DescribeExecution', 'states:StopExecution']));
      expect(executionPermissions).to.have.lengthOf(1);
      expect(executionPermissions[0].Resource).to.equal('*');

      const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
      expect(eventPermissions).to.have.lengthOf(1);
      expect(eventPermissions[0].Resource).to.deep.eq([{
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForStepFunctionsExecutionRule',
          {},
        ],
      }]);
    });

    it('jsonata', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const genStateMachine = id => ({
        id,
        definition: {
          QueryLanguage: 'JSONata', // JSONPath is default
          StartAt: 'A',
          States: {
            A: {
              Type: 'Task',
              Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
              Arguments: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
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
      const statements = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;

      const stateMachinePermissions = statements.filter(s => _.isEqual(s.Action, ['states:StartSyncExecution']));
      expect(stateMachinePermissions).to.have.lengthOf(1);
      expect(stateMachinePermissions[0].Resource).to.deep.eq([stateMachineArn]);

      const executionPermissions = statements.filter(s => _.isEqual(s.Action, ['states:DescribeExecution', 'states:StopExecution']));
      expect(executionPermissions).to.have.lengthOf(1);
      expect(executionPermissions[0].Resource).to.equal('*');

      const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
      expect(eventPermissions).to.have.lengthOf(1);
      expect(eventPermissions[0].Resource).to.deep.eq([{
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForStepFunctionsExecutionRule',
          {},
        ],
      }]);
    });
  });

  describe('should give step functions permission to * whenever StateMachineArn.$ (JSONPath) or {% $arn %} (JSONata) is seen', () => {
    it('jsonpath', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const genStateMachine = id => ({
        id,
        definition: {
          StartAt: 'A',
          States: {
            A: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution',
              Parameters: {
                'StateMachineArn.$': '$.arn',
                Input: {},
              },
              Next: 'B',
            },
            B: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.sync',
              Parameters: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
              Next: 'C',
            },
            C: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.waitForTaskToken',
              Parameters: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
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
      const statements = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;

      const stateMachinePermissions = statements.filter(s => _.includes(s.Action, 'states:StartExecution'));
      expect(stateMachinePermissions).to.have.lengthOf(1);
      expect(stateMachinePermissions[0].Resource).to.equal('*');
    });

    it('jsonata', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const genStateMachine = id => ({
        id,
        definition: {
          QueryLanguage: 'JSONata', // JSONPath is default
          StartAt: 'A',
          States: {
            A: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution',
              Arguments: {
                StateMachineArn: '{% $arn %}',
                Input: {},
              },
              Next: 'B',
            },
            B: {
              Type: 'Task',
              Resource: 'arn:aws:states:::states:startExecution.sync',
              Arguments: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
              Next: 'C',
            },
            C: {
              Type: 'Task',
              Resource:
                'arn:aws:states:::states:startExecution.waitForTaskToken',
              Arguments: {
                StateMachineArn: stateMachineArn,
                Input: {},
              },
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
      const statements = serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;

      const stateMachinePermissions = statements.filter(s => _.includes(s.Action, 'states:StartExecution'));
      expect(stateMachinePermissions).to.have.lengthOf(1);
      expect(stateMachinePermissions[0].Resource).to.equal('*');
    });
  });

  describe('should give step functions using sdk permission to * whenever StateMachineArn.$ (JSONPath) or {% $arn %} (JSONata) is seen', () => {
    it('jsonpath', () => {
      const genStateMachine = id => ({
        id,
        definition: {
          StartAt: 'A',
          States: {
            A: {
              Type: 'Task',
              Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
              Parameters: {
                'StateMachineArn.$': '$.arn',
                Input: {},
              },
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
      const statements = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;

      const stateMachinePermissions = statements.filter(s => _.includes(s.Action, 'states:StartSyncExecution'));

      expect(stateMachinePermissions).to.have.lengthOf(1);
      expect(stateMachinePermissions[0].Resource).to.equal('*');
    });

    it('jsonata', () => {
      const genStateMachine = id => ({
        id,
        definition: {
          QueryLanguage: 'JSONata',
          StartAt: 'A',
          States: {
            A: {
              Type: 'Task',
              Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
              Arguments: {
                StateMachineArn: '{% $arn %}',
                Input: {},
              },
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
      const statements = serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
        .Properties.Policies[0].PolicyDocument.Statement;

      const stateMachinePermissions = statements.filter(s => _.includes(s.Action, 'states:StartSyncExecution'));

      expect(stateMachinePermissions).to.have.lengthOf(1);
      expect(stateMachinePermissions[0].Resource).to.equal('*');
    });
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
        myStateMachine: getStateMachine('StateMachine1', 'arn:aws:lambda:us-west-2:1234567890:function:foo'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
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
        myStateMachine: getStateMachine('StateMachine1', 'arn:aws:lambda:us-west-2:1234567890:function:foo'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
    expect(lambdaPermissions).to.have.lengthOf(1);

    const lambdaArns = [
      'arn:aws:lambda:us-west-2:1234567890:function:foo',
      getAlias('arn:aws:lambda:us-west-2:1234567890:function:foo'),
    ];
    expect(lambdaPermissions[0].Resource).to.deep.equal(lambdaArns);

    const stepFunctionPermission = statements.filter(s => _.isEqual(s.Action, ['states:StartExecution']));
    expect(stepFunctionPermission).to.have.lengthOf(1);
    expect(stepFunctionPermission[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        'arn:aws:states:${AWS::Region}:${AWS::AccountId}:stateMachine:myStateMachine',
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
        myStateMachine: getStateMachine('StateMachine1', 'arn:aws:lambda:us-west-2:1234567890:function:foo'),
      },
    };

    serverlessStepFunctions.compileIamRole();

    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const stepFunctionPermission = statements.filter(s => _.isEqual(s.Action, ['states:StartExecution']));
    expect(stepFunctionPermission).to.have.lengthOf(1);
    expect(stepFunctionPermission[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        'arn:aws:states:${AWS::Region}:${AWS::AccountId}:stateMachine:DistributedMapper',
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

    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
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

    const logsPermissions = statements.filter(s => s.Action.includes('logs:CreateLogDelivery'));
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

    const tracingPermissions = statements.filter(s => s.Action.includes('xray:PutTraceSegments'));
    expect(tracingPermissions).to.have.lengthOf(1);
    expect(tracingPermissions[0].Resource).to.equal('*');
    expect(tracingPermissions[0].Action).to.deep.equal([
      'xray:PutTraceSegments',
      'xray:PutTelemetryRecords',
      'xray:GetSamplingRules',
      'xray:GetSamplingTargets',
    ]);
  });

  it('should support variable FunctionName', () => {
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
                Parameters: {
                  'FunctionName.$': '$.functionName',
                  Payload: {
                    'model.$': '$.new_model',
                    'token.$': '$$.Task.Token',
                  },
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                Parameters: {
                  'FunctionName.$': '$.functionName',
                  AllowedFunctions: '*limited*',
                  Payload: {
                    'model.$': '$.new_model',
                    'token.$': '$$.Task.Token',
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
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;
    const lambdaPermissions = statements.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
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
                Parameters: {
                  'FunctionName.$': '$.functionName',
                  AllowedFunctions: 'arn:aws:lambda:us-west-2:1234567890:function:foo',
                  Payload: {
                    'model.$': '$.new_model',
                    'token.$': '$$.Task.Token',
                  },
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
                Parameters: {
                  'FunctionName.$': '$.functionName',
                  AllowedFunctions: '*limited*',
                  Payload: {
                    'model.$': '$.new_model',
                    'token.$': '$$.Task.Token',
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
    const statements2 = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;
    const lambdaPermissions2 = statements2.filter(s => _.isEqual(s.Action, ['lambda:InvokeFunction']));
    expect(lambdaPermissions2).to.have.lengthOf(1);
    expect(lambdaPermissions2[0].Resource).to.deep.equal([
      'arn:aws:lambda:us-west-2:1234567890:function:foo',
      '*limited*',
    ]);
  });

  it('should give sagemaker batch transform permissions', () => {
    const genStateMachine = id => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::sagemaker:createTransformJob.sync',
            Parameters: {
              ModelName: 'a-model-name',
              TransformInput: {
                CompressionType: 'None',
                ContentType: 'text/csv',
                DataSource: {
                  S3DataSource: {
                    S3DataType: 'S3Prefix',
                    S3Uri: 's3://your-bucket',
                  },
                },
              },
              TransformOutput: {
                S3OutputPath: 's3://your-bucket/TrasformOutputPath',
              },
              TransformResources: {
                InstanceCount: 1,
                InstanceType: 'ml.m4.xlarge',
              },
              TransformJobName: 'your-job-name',
            },
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
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const transformPermissions = statements.filter(s => _.isEqual(s.Action, ['sagemaker:CreateTransformJob', 'sagemaker:DescribeTransformJob', 'sagemaker:StopTransformJob']));
    expect(transformPermissions).to.have.lengthOf(1);
    expect(transformPermissions[0].Resource).to.deep.eq([
      {
        'Fn::Sub': [
          'arn:${AWS::Partition}:sagemaker:${AWS::Region}:${AWS::AccountId}:transform-job/your-job-name*',
          {},
        ],
      },
    ]);

    const listTagPermission = statements.filter(s => _.isEqual(s.Action, ['sagemaker:ListTags']));
    expect(listTagPermission).to.have.lengthOf(1);
    expect(listTagPermission[0].Resource).to.equal('*');

    const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutTargets', 'events:PutRule', 'events:DescribeRule']));
    expect(eventPermissions).to.has.lengthOf(1);
    expect(eventPermissions[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForSageMakerTransformJobsRule',
        {},
      ],
    }]);
  });

  it('should give bedrock invoke permissions for foundation models', () => {
    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: {
          id: 'StateMachine1',
          definition: {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: 'arn:aws:states:::bedrock:invokeModel',
                Parameters: {
                  ModelId: 'anthropic.claude-v2:1',
                  Body: {
                    prompt: 'your-prompt',
                    max_tokens_to_sample: 500,
                    temperature: 0.1,
                  },
                  ContentType: 'application/json',
                  Accept: 'application/json',
                },
                Next: 'B',
              },
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::bedrock:invokeModel',
                Parameters: {
                  // modelId can be specified as an arn
                  ModelId: 'arn:aws:bedrock:us-east-1::foundation-model/meta.llama2-70b-chat-v1',
                  Body: {
                    prompt: 'your-prompt',
                    max_tokens_to_sample: 500,
                    temperature: 0.1,
                  },
                  ContentType: 'application/json',
                  Accept: 'application/json',
                },
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
    const bedrockPermissions = statements.filter(s => _.isEqual(s.Action, ['bedrock:InvokeModel']));
    expect(bedrockPermissions).to.have.lengthOf(1);
    expect(bedrockPermissions[0].Resource).to.have.lengthOf(2);
    expect(bedrockPermissions[0].Resource).to.deep.eq([
      {
        'Fn::Sub': [
          'arn:${AWS::Partition}:bedrock:${AWS::Region}::foundation-model/anthropic.claude-v2:1',
          {},
        ],
      },
      'arn:aws:bedrock:us-east-1::foundation-model/meta.llama2-70b-chat-v1',
    ]);
  });

  it('should give event bridge putEvents permissions', () => {
    const genStateMachine = id => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::events:putEvents',
            Parameters: {
              Entries: [{
                Source: 'source',
                DetailType: 'DetailType',
              }],
            },
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
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutEvents']));
    expect(eventPermissions).to.has.lengthOf(1);
    expect(eventPermissions[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
        { eventBus: 'default' },
      ],
    }]);
  });

  it('should give event bridge putEvents multiple permissions', () => {
    const genStateMachine = id => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::events:putEvents',
            Parameters: {
              Entries: [
                {
                  Source: 'source',
                  DetailType: 'DetailType',
                  EventBusName: 'default',
                },
                {
                  Source: 'source',
                  DetailType: 'DetailType',
                  EventBusName: 'custom',
                },
              ],
            },
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
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const eventPermissions = statements.filter(s => _.isEqual(s.Action, ['events:PutEvents']));
    expect(eventPermissions[0].Resource).to.has.lengthOf(2);
    expect(eventPermissions[0].Resource).to.deep.eq([
      {
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
          { eventBus: 'default' },
        ],
      },
      {
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
          { eventBus: 'custom' },
        ],
      },
    ]);
  });

  it('should give event bridge scheduler createSchedule and passRole permissions', () => {
    const genStateMachine = id => ({
      id,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Task',
            Resource: 'arn:aws:states:::aws-sdk:scheduler:createSchedule',
            Parameters: {
              ActionAfterCompletion: 'DELETE',
              FlexibleTimeWindow: {
                Mode: 'FLEXIBLE',
                MaximumWindowInMinutes: 5,
              },
              'Name.$': '$$.Execution.Name',
              GroupName: 'MyScheduleGroup',
              ScheduleExpression: 'at("2024-03-04T00:00:00")',
              Target: {
                Arn: 'arn:aws:states:${AWS::Region}:${AWS::AccountId}:stateMachine:MyStateMachine',
                RoleArn: 'arn:aws:iam::${AWS::AccountId}:role/MyIAMRole',
                Input: {
                  foo: 'bar',
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
        myStateMachine1: genStateMachine('StateMachine1'),
      },
    };

    serverlessStepFunctions.compileIamRole();
    const statements = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources.StateMachine1Role
      .Properties.Policies[0].PolicyDocument.Statement;

    const schedulerPermissions = statements.filter(s => _.isEqual(s.Action, ['scheduler:CreateSchedule']));
    expect(schedulerPermissions[0].Resource).to.has.lengthOf(1);
    expect(schedulerPermissions[0].Resource).to.deep.eq([{
      'Fn::Sub': [
        'arn:${AWS::Partition}:scheduler:${AWS::Region}:${AWS::AccountId}:schedule/${scheduleGroupName}/*',
        { scheduleGroupName: 'MyScheduleGroup' },
      ],
    }]);
    const rolePermissions = statements.filter(s => _.isEqual(s.Action, ['iam:PassRole']));
    expect(rolePermissions[0].Resource).to.has.lengthOf(1);
    expect(rolePermissions[0].Resource).to.deep.eq(['arn:aws:iam::${AWS::AccountId}:role/MyIAMRole']);
  });

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
    serverless.service.provider.rolePermissionsBoundary = 'arn:aws:iam::myAccount:policy/permission_boundary';
    serverlessStepFunctions.compileIamRole();
    const boundary = serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.StateMachine1Role.Properties
      .PermissionsBoundary;
    expect(boundary).to.equal('arn:aws:iam::myAccount:policy/permission_boundary');
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
    expect(statements[3].Resource[0]).to.equal(`arn:aws:s3:::${myBucket}`);
    expect(statements[3].Resource[1]).to.equal(`arn:aws:s3:::${myBucket}/*`);
  });
});
