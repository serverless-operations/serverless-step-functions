'use strict';

const _ = require('lodash');
const Joi = require('@hapi/joi');
const crypto = require('crypto');
const BbPromise = require('bluebird');
const schema = require('./compileNotifications.schema');

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

function generateTargetId(target, index, stateMachineName, status) {
  const suffix = crypto
    .createHash('md5')
    .update(JSON.stringify({ target, index }))
    .digest('hex')
    .substr(0, 5);

  return `${stateMachineName}-${status}-${suffix}`;
}

function generateLogicalId(prefix, index, resource) {
  const suffix = crypto
    .createHash('md5')
    .update(JSON.stringify({ index, resource }))
    .digest('hex')
    .substr(0, 5);
  return `${prefix}${suffix}`;
}

function generatePolicyName(status, targetType, action, resource) {
  const suffix = crypto
    .createHash('md5')
    .update(JSON.stringify({ action, resource }))
    .digest('hex')
    .substr(0, 5);
  return `${status}-${targetType}-${suffix}`;
}

function compileTarget(stateMachineName, status, targetObj, targetIndex, iamRoleLogicalId) {
  // SQS and Kinesis are special cases as they can have additional props
  if (_.has(targetObj, 'sqs.arn')) {
    const target = {
      Arn: targetObj.sqs.arn,
      SqsParameters: {
        MessageGroupId: targetObj.sqs.messageGroupId,
      },
    };
    target.Id = generateTargetId(target, targetIndex, stateMachineName, status);
    return target;
  } if (_.has(targetObj, 'kinesis.arn')) {
    const target = {
      Arn: targetObj.kinesis.arn,
      KinesisParameters: {
        PartitionKeyPath: targetObj.kinesis.partitionKeyPath,
      },
    };
    target.Id = generateTargetId(target, targetIndex, stateMachineName, status);
    return target;
  } if (_.has(targetObj, 'stepFunctions')) {
    const target = {
      Arn: targetObj.stepFunctions,
      RoleArn: {
        'Fn::GetAtt': [iamRoleLogicalId, 'Arn'],
      },
    };
    target.Id = generateTargetId(target, targetIndex, stateMachineName, status);
    return target;
  }

  const targetType = supportedTargets.find(t => _.has(targetObj, t));
  const arn = _.get(targetObj, targetType);
  const target = {
    Arn: arn,
  };
  target.Id = generateTargetId(target, targetIndex, stateMachineName, status);
  return target;
}

function compileSnsPolicy(status, snsTarget) {
  return {
    Type: 'AWS::SNS::TopicPolicy',
    Properties: {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: {
          Sid: generatePolicyName(status, 'sns', 'sns:Publish', snsTarget),
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
          Sid: generatePolicyName(status, 'sqs', 'sqs:SendMessage', sqsTarget),
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

  for (let index = 0; index < targets.length; index++) {
    const { status, target } = targets[index];
    const perm = compilePermissionForTarget(status, target);
    if (perm.type === 'iam') {
      const targetType = _.keys(target)[0];
      addPolicy(
        generatePolicyName(status, targetType, perm.action, perm.resource),
        perm.action,
        perm.resource,
      );
    } else if (perm.type === 'policy') {
      yield {
        logicalId: generateLogicalId(`${stateMachineLogicalId}ResourcePolicy`, index, perm.resource),
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
      const cfnTargets = targets.map((t, index) => compileTarget(stateMachineName,
        status, t, index, iamRoleLogicalId));

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

function validateConfig(serverless, stateMachineName, stateMachineObj, notificationsObj) {
  // no notifications defined at all
  if (!_.isObject(notificationsObj)) {
    return false;
  }

  if (stateMachineObj.type === 'EXPRESS') {
    serverless.cli.consoleLog(
      `State machine [${stateMachineName}] : notifications are not supported on Express Workflows. `
      + 'Please see https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html for difference between Step Functions Standard and Express Workflow.',
    );
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

      if (!validateConfig(this.serverless, stateMachineName, stateMachineObj, notificationsObj)) {
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
