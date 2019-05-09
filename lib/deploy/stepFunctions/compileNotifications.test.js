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

  const validateCloudWatchEvent = (event, status) => {
    expect(event.Type).to.equal('AWS::Events::Rule');
    expect(event.Properties.EventPattern.source).to.deep.equal(['aws.states']);
    expect(event.Properties.EventPattern.detail.status).to.deep.equal([status]);
    expect(event.Properties.Targets).to.have.lengthOf(8);

    for (const target of event.Properties.Targets) {
      expect(_.isString(target.Arn)).to.equal(true);
      expect(typeof target.Arn).to.equal('string');
      expect(_.isString(target.Id)).to.equal(true);
    }

    const sqsWithParam = event.Properties.Targets.find(t => t.SqsParameters);
    expect(sqsWithParam).to.not.equal(undefined);
    const kinesisWithParam = event.Properties.Targets.find(t => t.KinesisParameters);
    expect(kinesisWithParam).to.not.equal(undefined);
  };

  const validateHasPermission = (iamRole, action, resource) => {
    const statements = iamRole.Properties.Policies[0].PolicyDocument.Statement;
    expect(statements.find(x => x.Action === action && x.Resource === resource))
      .to.not.equal(undefined);
  };

  const validateCloudWatchIamRole = (iamRole) => {
    // 8 targets, 5 event rules = 5 * 8 = 40 statements
    expect(iamRole.Properties.Policies[0].PolicyDocument.Statement).to.have.lengthOf(40);
    validateHasPermission(iamRole, 'sns:Publish', 'SNS_TOPIC_ARN');
    validateHasPermission(iamRole, 'sqs:SendMessage', 'SQS_QUEUE_ARN');
    validateHasPermission(iamRole, 'kinesis:PutRecord', 'KINESIS_STREAM_ARN');
    validateHasPermission(iamRole, 'firehose:PutRecord', 'FIREHOSE_STREAM_ARN');
    validateHasPermission(iamRole, 'lambda:InvokeFunction', 'LAMBDA_FUNCTION_ARN');
    validateHasPermission(iamRole, 'states:StartExecution', 'STATE_MACHINE_ARN');
  };

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

  it('should generate CloudWatch Event Rules', () => {
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
    validateCloudWatchEvent(resources.Beta1NotificationsABORTEDEventRule, 'ABORTED');
    validateCloudWatchEvent(resources.Beta1NotificationsFAILEDEventRule, 'FAILED');
    validateCloudWatchEvent(resources.Beta1NotificationsRUNNINGEventRule, 'RUNNING');
    validateCloudWatchEvent(resources.Beta1NotificationsSUCCEEDEDEventRule, 'SUCCEEDED');
    validateCloudWatchEvent(resources.Beta1NotificationsTIMEDOUTEventRule, 'TIMED_OUT');
    validateCloudWatchIamRole(resources.Beta1NotificationsIamRole);
    validateCloudWatchEvent(resources.Beta2NotificationsABORTEDEventRule, 'ABORTED');
    validateCloudWatchEvent(resources.Beta2NotificationsFAILEDEventRule, 'FAILED');
    validateCloudWatchEvent(resources.Beta2NotificationsRUNNINGEventRule, 'RUNNING');
    validateCloudWatchEvent(resources.Beta2NotificationsSUCCEEDEDEventRule, 'SUCCEEDED');
    validateCloudWatchEvent(resources.Beta2NotificationsTIMEDOUTEventRule, 'TIMED_OUT');
    validateCloudWatchIamRole(resources.Beta2NotificationsIamRole);

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
