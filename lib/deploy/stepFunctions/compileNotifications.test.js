'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../index');

describe('#compileNotifications', () => {
  let consoleLogSpy;
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    consoleLogSpy = sinon.spy();
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.cli = { consoleLog: consoleLogSpy };
    const options = {
      stage: 'dev',
      region: 'ap-northeast-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  const validateCloudWatchEvent = (resources, logicalId, status, targetsCount) => {
    expect(resources).to.haveOwnProperty(logicalId);
    const event = resources[logicalId];
    expect(event.Type).to.equal('AWS::Events::Rule');
    expect(event.Properties.EventPattern.source).to.deep.equal(['aws.states']);
    expect(event.Properties.EventPattern.detail.status).to.deep.equal([status]);
    expect(event.Properties.Targets).to.have.lengthOf(targetsCount);

    for (const target of event.Properties.Targets) {
      const isStringOrFn = _.isString(target.Arn)
        || (target.Arn.Ref && _.isString(target.Arn.Ref))
        || (target.Arn['Fn::GetAtt'] && _.isArray(target.Arn['Fn::GetAtt']));

      expect(isStringOrFn).to.equal(true);
    }

    const sqsWithParam = event.Properties.Targets.find(t => t.SqsParameters);
    expect(sqsWithParam).to.not.equal(undefined);
    const kinesisWithParam = event.Properties.Targets.find(t => t.KinesisParameters);
    expect(kinesisWithParam).to.not.equal(undefined);
  };

  const validateHasPermission = (iamRole, action, resource) => {
    const policies = iamRole.Properties.Policies;
    const matchedPolicy = policies.find((policy) => {
      const statement = policy.PolicyDocument.Statement[0];
      return statement.Action === action && _.isEqual(statement.Resource, resource);
    });
    expect(matchedPolicy).to.not.equal(
      undefined,
      `IAM Role is expected to have policy for [${action}] on [${resource}]`,
    );
  };

  const validateHasSnsPolicy = (resources, topicArn) => {
    const snsPolicies = _.values(resources).filter(resource => resource.Type === 'AWS::SNS::TopicPolicy');
    const matchedPolicy = snsPolicies.find(policy => _.isEqual(policy.Properties.Topics[0],
      topicArn));
    expect(matchedPolicy).to.not.equal(
      undefined,
      `SNS topic policy is missing for [${topicArn}]`,
    );
  };

  const validateHasSqsPolicy = (resources, queueUrl) => {
    const sqsPolicies = _.values(resources).filter(resource => resource.Type === 'AWS::SQS::QueuePolicy');
    const matchedPolicy = sqsPolicies.find(policy => _.isEqual(policy.Properties.Queues[0],
      queueUrl));
    expect(matchedPolicy).to.not.equal(
      undefined,
      `SQS queue policy is missing for [${queueUrl}]`,
    );
  };

  const validateHasLambdaPermission = (resources, lambdaArn) => {
    const lambdaPolicies = _.values(resources).filter(resource => resource.Type === 'AWS::Lambda::Permission');
    const matchedPolicy = lambdaPolicies.find(policy => _.isEqual(policy.Properties.FunctionName,
      lambdaArn));
    expect(matchedPolicy).to.not.equal(
      undefined,
      `Lambda permission is missing for [${lambdaArn}]`,
    );
  };

  const genStateMachineWithTargets = (name, targets) => ({
    id: name,
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
    notifications: {
      ABORTED: targets,
      FAILED: targets,
      RUNNING: targets,
      SUCCEEDED: targets,
      TIMED_OUT: targets,
    },
  });

  it('should generate CloudWatch Event Rules with string ARNs', () => {
    const targets = [
      { sns: 'SNS_TOPIC_ARN' },
      { sqs: 'SQS_QUEUE_ARN' },
      { sqs: 'arn:aws:sqs:#{AWS::Region}:#{AWS::AccountId}:MyQueue' },
      { sqs: { arn: 'SQS_QUEUE_NESTED_ARN', messageGroupId: '12345' } },
      { lambda: 'LAMBDA_FUNCTION_ARN' },
      { kinesis: 'KINESIS_STREAM_ARN' },
      { kinesis: { arn: 'KINESIS_STREAM_NESTED_ARN', partitionKeyPath: '$.id' } },
      { firehose: 'FIREHOSE_STREAM_ARN' },
      { stepFunctions: 'STATE_MACHINE_ARN' },
    ];

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachineWithTargets('Beta1', targets),
        beta2: genStateMachineWithTargets('Beta2', targets),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const count = targets.length;
    const validateCloudWatchEvents = (prefix) => {
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsABORTEDEventRule`, 'ABORTED', count,
      );
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsFAILEDEventRule`, 'FAILED', count,
      );
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsRUNNINGEventRule`, 'RUNNING', count,
      );
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsSUCCEEDEDEventRule`, 'SUCCEEDED', count,
      );
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsTIMEDOUTEventRule`, 'TIMED_OUT', count,
      );
    };

    validateCloudWatchEvents('Beta1');
    validateCloudWatchEvents('Beta2');

    const validateIamRole = (iamRole) => {
      // 4 targets (excluding sns, sqs, lambda), 5 event rules = 5 * 4 = 20 policies
      expect(iamRole.Properties.Policies).to.have.lengthOf(20);
      validateHasPermission(iamRole, 'kinesis:PutRecord', 'KINESIS_STREAM_ARN');
      validateHasPermission(iamRole, 'kinesis:PutRecord', 'KINESIS_STREAM_NESTED_ARN');
      validateHasPermission(iamRole, 'firehose:PutRecord', 'FIREHOSE_STREAM_ARN');
      validateHasPermission(iamRole, 'states:StartExecution', 'STATE_MACHINE_ARN');
    };

    validateIamRole(resources.Beta1NotificationsIamRole);
    validateIamRole(resources.Beta2NotificationsIamRole);

    const toQueueUrl = queueName => ({
      'Fn::Sub': [
        'https://sqs.${AWS::Region}.amazonaws.com/${AWS::AccountId}/${QueueName}',
        { QueueName: queueName },
      ],
    });

    validateHasSnsPolicy(resources, 'SNS_TOPIC_ARN');
    validateHasSqsPolicy(resources, toQueueUrl('SQS_QUEUE_ARN'));
    validateHasSqsPolicy(resources, toQueueUrl('MyQueue'));
    validateHasSqsPolicy(resources, toQueueUrl('SQS_QUEUE_NESTED_ARN'));
    validateHasLambdaPermission(resources, 'LAMBDA_FUNCTION_ARN');

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should generate CloudWatch Event Rules with Ref ang Fn::GetAtt', () => {
    const snsArn = { Ref: 'MyTopic' };
    const sqsArn = { 'Fn::GetAtt': ['MyQueue', 'Arn'] };
    const sqsNestedArn = { 'Fn::GetAtt': ['MyNestedQueue', 'Arn'] };
    const lambdaArn = { 'Fn::GetAtt': ['MyFunction', 'Arn'] };
    const kinesisArn = { 'Fn::GetAtt': ['MyStream', 'Arn'] };
    const kinesisNestedArn = { 'Fn::GetAtt': ['MyNestedStream', 'Arn'] };
    const firehoseArn = { 'Fn::GetAtt': ['MyDeliveryStream', 'Arn'] };
    const stepFunctionsArn = { Ref: 'MyStateMachine' };
    const targets = [
      { sns: snsArn },
      { sqs: sqsArn },
      { sqs: { arn: sqsNestedArn, messageGroupId: '12345' } },
      { lambda: lambdaArn },
      { kinesis: kinesisArn },
      { kinesis: { arn: kinesisNestedArn, partitionKeyPath: '$.id' } },
      { firehose: firehoseArn },
      { stepFunctions: stepFunctionsArn },
    ];

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachineWithTargets('Beta1', targets),
        beta2: genStateMachineWithTargets('Beta2', targets),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const count = targets.length;
    const validateCloudWatchEvents = (prefix) => {
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsABORTEDEventRule`, 'ABORTED', count,
      );
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsFAILEDEventRule`, 'FAILED', count,
      );
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsRUNNINGEventRule`, 'RUNNING', count,
      );
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsSUCCEEDEDEventRule`, 'SUCCEEDED', count,
      );
      validateCloudWatchEvent(
        resources, `${prefix}NotificationsTIMEDOUTEventRule`, 'TIMED_OUT', count,
      );
    };

    validateCloudWatchEvents('Beta1');
    validateCloudWatchEvents('Beta2');

    const validateIamRole = (iamRole) => {
      // 4 targets (excluding sns, sqs, lambda), 5 event rules = 5 * 4 = 20 policies
      expect(iamRole.Properties.Policies).to.have.lengthOf(20);
      validateHasPermission(iamRole, 'kinesis:PutRecord', kinesisArn);
      validateHasPermission(iamRole, 'kinesis:PutRecord', kinesisNestedArn);
      validateHasPermission(iamRole, 'firehose:PutRecord', firehoseArn);
      validateHasPermission(iamRole, 'states:StartExecution', stepFunctionsArn);
    };

    validateIamRole(resources.Beta1NotificationsIamRole);
    validateIamRole(resources.Beta2NotificationsIamRole);

    validateHasSnsPolicy(resources, snsArn);
    validateHasSqsPolicy(resources, { Ref: 'MyQueue' });
    validateHasSqsPolicy(resources, { Ref: 'MyNestedQueue' });
    validateHasLambdaPermission(resources, lambdaArn);

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should do deterministic compilation of CloudWatch Event Rules', () => {
    const snsArn = { Ref: 'MyTopic' };
    const sqsArn = { 'Fn::GetAtt': ['MyQueue', 'Arn'] };
    const sqsNestedArn = { 'Fn::GetAtt': ['MyNestedQueue', 'Arn'] };
    const lambdaArn = { 'Fn::GetAtt': ['MyFunction', 'Arn'] };
    const kinesisArn = { 'Fn::GetAtt': ['MyStream', 'Arn'] };
    const kinesisNestedArn = { 'Fn::GetAtt': ['MyNestedStream', 'Arn'] };
    const firehoseArn = { 'Fn::GetAtt': ['MyDeliveryStream', 'Arn'] };
    const stepFunctionsArn = { Ref: 'MyStateMachine' };
    const targets = [
      { sns: snsArn },
      { sqs: sqsArn },
      { sqs: { arn: sqsNestedArn, messageGroupId: '12345' } },
      { lambda: lambdaArn },
      { kinesis: kinesisArn },
      { kinesis: { arn: kinesisNestedArn, partitionKeyPath: '$.id' } },
      { firehose: firehoseArn },
      { stepFunctions: stepFunctionsArn },
      { sns: 'SNS_TOPIC_ARN' },
      { sqs: 'SQS_QUEUE_ARN' },
      { sqs: 'arn:aws:sqs:#{AWS::Region}:#{AWS::AccountId}:MyQueue' },
      { sqs: { arn: 'SQS_QUEUE_NESTED_ARN', messageGroupId: '12345' } },
      { lambda: 'LAMBDA_FUNCTION_ARN' },
      { kinesis: 'KINESIS_STREAM_ARN' },
      { kinesis: { arn: 'KINESIS_STREAM_NESTED_ARN', partitionKeyPath: '$.id' } },
      { firehose: 'FIREHOSE_STREAM_ARN' },
      { stepFunctions: 'STATE_MACHINE_ARN' },
    ];

    const definition = {
      stateMachines: {
        beta1: genStateMachineWithTargets('Beta1', targets),
        beta2: genStateMachineWithTargets('Beta2', targets),
      },
    };

    serverless.service.stepFunctions = _.cloneDeep(definition);
    serverlessStepFunctions.compileNotifications();
    const resources1 = _.cloneDeep(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources);

    serverless.service.stepFunctions = _.cloneDeep(definition);
    serverlessStepFunctions.compileNotifications();
    const resources2 = _.cloneDeep(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources);

    expect(resources1).to.deep.equal(resources2);
  });

  it('should not generate resources when no notifications are defined', () => {
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
        beta1: genStateMachine('Beta1'),
        beta2: genStateMachine('Beta2'),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should not generate resources when notifications is empty', () => {
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
      notifications: {},
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachine('Beta1'),
        beta2: genStateMachine('Beta2'),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should not generate resources when targets are empty', () => {
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
      notifications: {
        ABORTED: [],
        FAILED: [],
        RUNNING: [],
        SUCCEEDED: [],
        TIMED_OUT: [],
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachine('Beta1'),
        beta2: genStateMachine('Beta2'),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should log the validation errors if notifications contains non-existent status', () => {
    const targets = [
      { sns: 'SNS_TOPIC_ARN' },
    ];
    const genStateMachine = name => ({
      id: name,
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
      notifications: {
        ABORTED: targets,
        FAILURE: targets, // wrong name
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachine('Beta1'),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(1);
    const { args } = consoleLogSpy.lastCall;
    const [logMessage] = args;
    expect(logMessage.startsWith('State machine [Beta1] : notifications config is malformed.'))
      .to.equal(true);
  });

  it('should log the validation errors if notifications contains non-existent target type', () => {
    const wrongTargets = [
      { sns: 'SNS_TOPIC_ARN' },
      { sqqs: 'SQS_QUEUE_ARN' },
    ];
    const genStateMachine = name => ({
      id: name,
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
      notifications: {
        ABORTED: wrongTargets,
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachine('Beta1'),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(1);
    const { args } = consoleLogSpy.lastCall;
    const [logMessage] = args;
    expect(logMessage.startsWith('State machine [Beta1] : notifications config is malformed.'))
      .to.equal(true);
  });

  it('should log the validation errors if state machine is an Express Workflow', () => {
    const genStateMachine = name => ({
      name,
      type: 'EXPRESS',
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      notifications: {
        ABORTED: [{ sns: 'SNS_TOPIC_ARN' }],
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachine('Beta1'),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(1);
    const { args } = consoleLogSpy.lastCall;
    const [logMessage] = args;
    expect(logMessage.startsWith('State machine [Beta1] : notifications are not supported on Express Workflows.'))
      .to.equal(true);
  });
});
