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

function randomLogicalId(prefix) {
  const suffix = chance.string({
    length: 5,
    pool: 'ABCDEFGHIJKLMNOPQRSTUFWXYZ',
  });
  return `${prefix}${suffix}`;
}

function randomPolicyName(status, targetType) {
  const suffix = chance.string({
    length: 5,
    pool: 'abcdefghijklmnopqrstufwxyzABCDEFGHIJKLMNOPQRSTUFWXYZ',
  });
  return `${status}-${targetType}-${suffix}`;
}

function compileTarget(stateMachineName, status, targetObj, iamRoleLogicalId) {
  // SQS and Kinesis are special cases as they can have additional props
  if (_.has(targetObj, 'sqs.arn')) {
    return {
      Arn: targetObj.sqs.arn,
      Id: randomTargetId(stateMachineName, status),
      SqsParameters: {
        MessageGroupId: targetObj.sqs.messageGroupId,
      },
    };
  } if (_.has(targetObj, 'kinesis.arn')) {
    return {
      Arn: targetObj.kinesis.arn,
      Id: randomTargetId(stateMachineName, status),
      KinesisParameters: {
        PartitionKeyPath: targetObj.kinesis.partitionKeyPath,
      },
    };
  } if (_.has(targetObj, 'stepFunctions')) {
    return {
      Arn: targetObj.stepFunctions,
      Id: randomTargetId(stateMachineName, status),
      RoleArn: {
        'Fn::GetAtt': [iamRoleLogicalId, 'Arn'],
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

function compileSnsPolicy(status, snsTarget) {
  return {
    Type: 'AWS::SNS::TopicPolicy',
    Properties: {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: {
          Sid: randomPolicyName(status, 'sns'),
          Principal: {
            Service: 'events.amazonaws.com',
          },
          Effect: 'Allow',
          Action: 'sns:Publish',
          Resource: snsTarget,
        },
      },
      Topics: [snsTarget],
    },
  };
}

function convertToQueueUrl(sqsArn) {
  if (_.isString(sqsArn)) {
    const segments = sqsArn.split(':');
    const queueName = _.last(segments);
    return {
      'Fn::Sub': [
        'https://sqs.${AWS::Region}.amazonaws.com/${AWS::AccountId}/${QueueName}',
        { QueueName: queueName },
      ],
    };
  } if (sqsArn['Fn::GetAtt']) {
    const logicalId = sqsArn['Fn::GetAtt'][0];
    return { Ref: logicalId };
  }
  throw new Error(
    `Unable to convert SQS ARN [${sqsArn}] to SQS Url. `
    + 'This is required for setting up Step Functions notifications to SQS. '
    + 'Try using Fn::GetAtt when setting the SQS arn.',
  );
}

function compileSqsPolicy(status, sqsTarget) {
  return {
    Type: 'AWS::SQS::QueuePolicy',
    Properties: {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: {
          Sid: randomPolicyName(status, 'sqs'),
          Principal: {
            Service: 'events.amazonaws.com',
          },
          Effect: 'Allow',
          Action: 'sqs:SendMessage',
          Resource: sqsTarget,
        },
      },
      Queues: [convertToQueueUrl(sqsTarget)],
    },
  };
}

function compileLambdaPermission(lambdaTarget) {
  return {
    Type: 'AWS::Lambda::Permission',
    Properties: {
      Action: 'lambda:InvokeFunction',
      FunctionName: lambdaTarget,
      Principal: 'events.amazonaws.com',
    },
  };
}

function compilePermissionForTarget(status, targetObj) {
  if (targetObj.sns) {
    return {
      type: 'policy',
      resource: compileSnsPolicy(status, targetObj.sns),
    };
  } if (targetObj.sqs) {
    const arn = _.get(targetObj, 'sqs.arn', targetObj.sqs);
    return {
      type: 'policy',
      resource: compileSqsPolicy(status, arn),
    };
  } if (targetObj.kinesis) {
    const arn = _.get(targetObj, 'kinesis.arn', targetObj.kinesis);
    return {
      type: 'iam',
      action: 'kinesis:PutRecord',
      resource: arn,
    };
  } if (targetObj.lambda) {
    return {
      type: 'policy',
      resource: compileLambdaPermission(targetObj.lambda),
    };
  }

  const targetType = supportedTargets.find(t => _.has(targetObj, t));
  const action = targetPermissions[targetType];

  return {
    type: 'iam',
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
      Policies: [],
    },
  };
  const addPolicy = (name, action, resource) => {
    iamRole.Properties.Policies.push({
      PolicyName: name,
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Action: action,
          Resource: resource,
        }],
      },
    });
  };

  return { iamRole, addPolicy };
}

function* compilePermissionResources(stateMachineLogicalId, iamRoleLogicalId, targets) {
  const { iamRole, addPolicy } = bootstrapIamRole();

  for (const { status, target } of targets) {
    const perm = compilePermissionForTarget(status, target);
    if (perm.type === 'iam') {
      const targetType = _.keys(target)[0];
      addPolicy(
        randomPolicyName(status, targetType),
        perm.action,
        perm.resource,
      );
    } else if (perm.type === 'policy') {
      yield {
        logicalId: randomLogicalId(`${stateMachineLogicalId}ResourcePolicy`),
        resource: perm.resource,
      };
    }
  }

  if (!_.isEmpty(iamRole.Properties.Policies)) {
    yield {
      logicalId: iamRoleLogicalId,
      resource: iamRole,
    };
  }
}

function* compileResources(stateMachineLogicalId, stateMachineName, notificationsObj) {
  const iamRoleLogicalId = `${stateMachineLogicalId}NotificationsIamRole`;
  const allTargets = _.flatMap(executionStatuses, status => _.get(notificationsObj,
    status, []).map(target => ({ status, target })));
  const permissions = compilePermissionResources(
    stateMachineLogicalId, iamRoleLogicalId, allTargets,
  );
  const permissionResources = Array.from(permissions);
  for (const { logicalId, resource } of permissionResources) {
    yield [logicalId, resource];
  }

  const needRoleArn = permissionResources.some(({ logicalId }) => logicalId === iamRoleLogicalId);
  const roleArn = needRoleArn
    ? { 'Fn::GetAtt': [iamRoleLogicalId, 'Arn'] }
    : undefined;

  for (const status of executionStatuses) {
    const targets = notificationsObj[status];
    if (!_.isEmpty(targets)) {
      const cfnTargets = targets.map(t => compileTarget(stateMachineName,
        status, t, iamRoleLogicalId));

      const eventRuleLogicalId = `${stateMachineLogicalId}Notifications${status.replace('_', '')}EventRule`;
      const eventRule = {
        Type: 'AWS::Events::Rule',
        Properties: {
          Description: `[${status}] status notification for state machine [${stateMachineName}]`,
          EventPattern: {
            source: ['aws.states'],
            'detail-type': ['Step Functions Execution Status Change'],
            detail: {
              status: [status],
              stateMachineArn: [{
                Ref: stateMachineLogicalId,
              }],
            },
          },
          Name: `${stateMachineName}-${status}-notification`,
          RoleArn: roleArn,
          Targets: cfnTargets,
        },
      };
      yield [eventRuleLogicalId, eventRule];
    }
  }
}

function validateConfig(serverless, stateMachineName, notificationsObj) {
  // no notifications defined at all
  if (!_.isObject(notificationsObj)) {
    return false;
  }

  const { error } = Joi.validate(
    notificationsObj, schema, { allowUnknown: false },
  );

  if (error) {
    serverless.cli.consoleLog(
      `State machine [${stateMachineName}] : notifications config is malformed. `
      + 'Please see https://github.com/horike37/serverless-step-functions for examples. '
      + `${error}`,
    );
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
        notificationsObj,
      );

      return Array.from(resourcesIterator);
    });
    const newResources = _.fromPairs(newResourcePairs);

    _.merge(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newResources,
    );
    return BbPromise.resolve();
  },
};
