'use strict';
const _ = require('lodash');
const Joi = require('@hapi/joi');
const Chance = require('chance');
const BbPromise = require('bluebird');
const schema = require('./compileNotifications.schema');

const chance = new Chance();

const executionStatuses = [
  'ABORTED', 'FAILED', 'RUNNING', 'SUCCEEDED', 'TIMED_OUT',
];

const supportedTargets = [
  'sns', 'sqs', 'kinesis', 'firehose', 'lambda', 'stepFunctions',
];

const targetPermissions = {
  sns: 'sns:Publish',
  sqs: 'sqs:SendMessage',
  kinesis: 'kinesis:PutRecord',
  firehose: 'firehose:PutRecord',
  lambda: 'lambda:InvokeFunction',
  stepFunctions: 'states:StartExecution',
};

function randomTargetId(stateMachineName, status) {
  const suffix = chance.string({
    length: 5,
    pool: 'abcdefghijklmnopqrstufwxyzABCDEFGHIJKLMNOPQRSTUFWXYZ1234567890',
  });

  return `${stateMachineName}-${status}-${suffix}`;
}

function compileTarget(stateMachineName, status, targetObj) {
  // SQS and Kinesis are special cases as they can have additional props
  if (_.has(targetObj, 'sqs.arn')) {
    return {
      Arn: targetObj.sqs.arn,
      Id: randomTargetId(stateMachineName, status),
      SqsParameters: {
        MessageGroupId: targetObj.sqs.messageGroupId,
      },
    };
  } else if (_.has(targetObj, 'kinesis.arn')) {
    return {
      Arn: targetObj.kinesis.arn,
      Id: randomTargetId(stateMachineName, status),
      KinesisParameters: {
        PartitionKeyPath: targetObj.kinesis.partitionKeyPath,
      },
    };
  }
  const targetType = supportedTargets.find(t => _.has(targetObj, t));
  const arn = _.get(targetObj, targetType);
  return {
    Arn: arn,
    Id: randomTargetId(stateMachineName, status),
  };
}

function compileIamPermission(targetObj) {
  const targetType = supportedTargets.find(t => _.has(targetObj, t));
  const action = targetPermissions[targetType];

  // SQS and Kinesis are special cases as they can have additional props
  if (_.has(targetObj, 'sqs.arn')) {
    return {
      action,
      resource: _.get(targetObj, 'sqs.arn'),
    };
  } else if (_.has(targetObj, 'kinesis.arn')) {
    return {
      action,
      resource: _.get(targetObj, 'kinesis.arn'),
    };
  }

  return {
    action,
    resource: targetObj[targetType],
  };
}

function bootstrapIamRole() {
  const iamRole = {
    Type: 'AWS::IAM::Role',
    Properties: {
      AssumeRolePolicyDocument: {
        Statement: {
          Effect: 'Allow',
          Action: 'sts:AssumeRole',
          Principal: {
            Service: 'events.amazonaws.com',
          },
        },
      },
      Policies: [
        {
          PolicyName: 'root',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [],
          },
        },
      ],
    },
  };
  const addPermission = (action, resource) => {
    iamRole.Properties.Policies[0].PolicyDocument.Statement.push({
      Effect: 'Allow',
      Action: action,
      Resource: resource,
    });
  };

  return { iamRole, addPermission };
}

function* compileResources(stateMachineLogicalId, stateMachineName, notificationsObj) {
  const iamRoleLogicalId = `${stateMachineLogicalId}NotificationsIamRole`;
  const { iamRole, addPermission } = bootstrapIamRole();

  for (const status of executionStatuses) {
    const targets = notificationsObj[status];
    if (!_.isEmpty(targets)) {
      const cfnTargets = targets
        .map(t => compileTarget(stateMachineName, status, t))
        .filter(_.isObjectLike);
      targets
        .map(compileIamPermission)
        .filter(_.isObjectLike)
        .forEach(({ action, resource }) => addPermission(action, resource));

      const eventRuleLogicalId =
        `${stateMachineLogicalId}Notifications${status.replace('_', '')}EventRule`;
      const eventRule = {
        Type: 'AWS::Events::Rule',
        Properties: {
          Description: `[${status}] status notification for state machine [${stateMachineName}]`,
          EventPattern: {
            source: ['aws.states'],
            'detail-type': ['Step Functions Execution Status Change'],
            detail: {
              status: [status],
            },
          },
          Name: `${stateMachineName}-${status}-notification`,
          RoleArn: {
            'Fn::GetAtt': [iamRoleLogicalId, 'Arn'],
          },
          Targets: cfnTargets,
        },
      };
      yield [eventRuleLogicalId, eventRule];
    }
  }

  if (!_.isEmpty(iamRole.Properties.Policies[0].PolicyDocument.Statement)) {
    yield [iamRoleLogicalId, iamRole];
  }
}

function validateConfig(serverless, stateMachineName, notificationsObj) {
  // no notifications defined at all
  if (!_.isObject(notificationsObj)) {
    return false;
  }

  const { error } = Joi.validate(
    notificationsObj, schema, { allowUnknown: false });

  if (error) {
    serverless.cli.consoleLog(
      `State machine [${stateMachineName}] : notifications config is malformed. ` +
      'Please see https://github.com/horike37/serverless-step-functions for examples. ' +
      `${error}`);
    return false;
  }

  return true;
}

module.exports = {
  compileNotifications() {
    const newResourcePairs = _.flatMap(this.getAllStateMachines(), (name) => {
      const stateMachineObj = this.getStateMachine(name);
      const stateMachineLogicalId = this.getStateMachineLogicalId(name, stateMachineObj);
      const stateMachineName = stateMachineObj.name || name;
      const notificationsObj = stateMachineObj.notifications;

      if (!validateConfig(this.serverless, stateMachineName, notificationsObj)) {
        return [];
      }

      const resourcesIterator = compileResources(
        stateMachineLogicalId,
        stateMachineName,
        notificationsObj);

      return Array.from(resourcesIterator);
    });
    const newResources = _.fromPairs(newResourcePairs);

    _.merge(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newResources);
    return BbPromise.resolve();
  },
};
