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
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.cli = { consoleLog: consoleLogSpy };
    const options = {
      stage: 'dev',
      region: 'ap-northeast-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  const validateCloudWatchEvent = (resources, logicalId, status) => {
    expect(resources).to.haveOwnProperty(logicalId);
    const event = resources[logicalId];
    expect(event.Type).to.equal('AWS::Events::Rule');
    expect(event.Properties.EventPattern.source).to.deep.equal(['aws.states']);
    expect(event.Properties.EventPattern.detail.status).to.deep.equal([status]);
    expect(event.Properties.Targets).to.have.lengthOf(8);

    for (const target of event.Properties.Targets) {
      const isStringOrFn =
        _.isString(target.Arn) ||
        (target.Arn.Ref && _.isString(target.Arn.Ref)) ||
        (target.Arn['Fn::GetAtt'] && _.isArray(target.Arn['Fn::GetAtt']));

      expect(isStringOrFn).to.equal(true);
    }

    const sqsWithParam = event.Properties.Targets.find(t => t.SqsParameters);
    expect(sqsWithParam).to.not.equal(undefined);
    const kinesisWithParam = event.Properties.Targets.find(t => t.KinesisParameters);
    expect(kinesisWithParam).to.not.equal(undefined);
  };

  const validateHasPermission = (iamRole, action, resource) => {
    const statements = iamRole.Properties.Policies[0].PolicyDocument.Statement;
    expect(statements.find(x => x.Action === action && _.isEqual(x.Resource, resource)))
      .to.not.equal(undefined);
  };

  it('should generate CloudWatch Event Rules with strig ARNs', () => {
    const targets = [
      { sns: 'SNS_TOPIC_ARN' },
      { sqs: 'SQS_QUEUE_ARN' },
      { sqs: { arn: 'SQS_QUEUE_ARN', messageGroupId: '12345' } },
      { lambda: 'LAMBDA_FUNCTION_ARN' },
      { kinesis: 'KINESIS_STREAM_ARN' },
      { kinesis: { arn: 'KINESIS_STREAM_ARN', partitionKeyPath: '$.id' } },
      { firehose: 'FIREHOSE_STREAM_ARN' },
      { stepFunctions: 'STATE_MACHINE_ARN' },
    ];

    const genStateMachine = (name) => ({
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

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachine('Beta1'),
        beta2: genStateMachine('Beta2'),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const validateCloudWatchEvents = (prefix) => {
      validateCloudWatchEvent(resources, `${prefix}NotificationsABORTEDEventRule`, 'ABORTED');
      validateCloudWatchEvent(resources, `${prefix}NotificationsFAILEDEventRule`, 'FAILED');
      validateCloudWatchEvent(resources, `${prefix}NotificationsRUNNINGEventRule`, 'RUNNING');
      validateCloudWatchEvent(resources, `${prefix}NotificationsSUCCEEDEDEventRule`, 'SUCCEEDED');
      validateCloudWatchEvent(resources, `${prefix}NotificationsTIMEDOUTEventRule`, 'TIMED_OUT');
    };

    validateCloudWatchEvents('Beta1');
    validateCloudWatchEvents('Beta2');

    const validateIamRole = (iamRole) => {
      // 8 targets, 5 event rules = 5 * 8 = 40 statements
      expect(iamRole.Properties.Policies[0].PolicyDocument.Statement).to.have.lengthOf(40);
      validateHasPermission(iamRole, 'sns:Publish', 'SNS_TOPIC_ARN');
      validateHasPermission(iamRole, 'sqs:SendMessage', 'SQS_QUEUE_ARN');
      validateHasPermission(iamRole, 'kinesis:PutRecord', 'KINESIS_STREAM_ARN');
      validateHasPermission(iamRole, 'firehose:PutRecord', 'FIREHOSE_STREAM_ARN');
      validateHasPermission(iamRole, 'lambda:InvokeFunction', 'LAMBDA_FUNCTION_ARN');
      validateHasPermission(iamRole, 'states:StartExecution', 'STATE_MACHINE_ARN');
    };

    validateIamRole(resources.Beta1NotificationsIamRole);
    validateIamRole(resources.Beta2NotificationsIamRole);

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should generate CloudWatch Event Rules with Ref ang Fn::GetAtt', () => {
    const snsArn = { Ref: 'MyTopic' };
    const sqsArn = { 'Fn::GetAtt': ['MyQueue', 'Arn'] };
    const lambdaArn = { 'Fn::GetAtt': ['MyFunction', 'Arn'] };
    const kinesisArn = { 'Fn::GetAtt': ['MyStream', 'Arn'] };
    const firehoseArn = { 'Fn::GetAtt': ['MyDeliveryStream', 'Arn'] };
    const stepFunctionsArn = { Ref: 'MyStateMachine' };
    const targets = [
      { sns: snsArn },
      { sqs: sqsArn },
      { sqs: { arn: sqsArn, messageGroupId: '12345' } },
      { lambda: lambdaArn },
      { kinesis: kinesisArn },
      { kinesis: { arn: kinesisArn, partitionKeyPath: '$.id' } },
      { firehose: firehoseArn },
      { stepFunctions: stepFunctionsArn },
    ];

    const genStateMachine = (name) => ({
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

    serverless.service.stepFunctions = {
      stateMachines: {
        beta1: genStateMachine('Beta1'),
        beta2: genStateMachine('Beta2'),
      },
    };

    serverlessStepFunctions.compileNotifications();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const validateCloudWatchEvents = (prefix) => {
      validateCloudWatchEvent(resources, `${prefix}NotificationsABORTEDEventRule`, 'ABORTED');
      validateCloudWatchEvent(resources, `${prefix}NotificationsFAILEDEventRule`, 'FAILED');
      validateCloudWatchEvent(resources, `${prefix}NotificationsRUNNINGEventRule`, 'RUNNING');
      validateCloudWatchEvent(resources, `${prefix}NotificationsSUCCEEDEDEventRule`, 'SUCCEEDED');
      validateCloudWatchEvent(resources, `${prefix}NotificationsTIMEDOUTEventRule`, 'TIMED_OUT');
    };

    validateCloudWatchEvents('Beta1');
    validateCloudWatchEvents('Beta2');

    const validateIamRole = (iamRole) => {
      // 8 targets, 5 event rules = 5 * 8 = 40 statements
      expect(iamRole.Properties.Policies[0].PolicyDocument.Statement).to.have.lengthOf(40);
      validateHasPermission(iamRole, 'sns:Publish', snsArn);
      validateHasPermission(iamRole, 'sqs:SendMessage', sqsArn);
      validateHasPermission(iamRole, 'kinesis:PutRecord', kinesisArn);
      validateHasPermission(iamRole, 'firehose:PutRecord', firehoseArn);
      validateHasPermission(iamRole, 'lambda:InvokeFunction', lambdaArn);
      validateHasPermission(iamRole, 'states:StartExecution', stepFunctionsArn);
    };

    validateIamRole(resources.Beta1NotificationsIamRole);
    validateIamRole(resources.Beta2NotificationsIamRole);

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should not generate resources when no notifications are defined', () => {
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
    const genStateMachine = (name) => ({
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
    const genStateMachine = (name) => ({
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
});
