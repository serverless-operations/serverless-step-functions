'use strict';

const _ = require('lodash');
const crypto = require('node:crypto');
const BbPromise = require('bluebird');
const schema = require('./compileNotifications.schema');
const logger = require('../../utils/logger');
const { translateLocalFunctionNames } = require('../../utils/aws');
const { getStrategy } = require('./notificationStrategies');
const { generatePolicyName } = require('./notificationStrategies/utils');

const executionStatuses = [
  'ABORTED', 'FAILED', 'RUNNING', 'SUCCEEDED', 'TIMED_OUT',
];

function generateLogicalId(prefix, index, resource) {
  const suffix = crypto
    .createHash('md5')
    .update(JSON.stringify({ index, resource }))
    .digest('hex')
    .substr(0, 5);
  return `${prefix}${suffix}`;
}

function bootstrapIamRole(rolePath) {
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
      ...(rolePath && { Path: rolePath }),
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

function* compilePermissionResources(stateMachineLogicalId, iamRoleLogicalId, targets, rolePath) {
  const { iamRole, addPolicy } = bootstrapIamRole(rolePath);

  for (let index = 0; index < targets.length; index++) {
    const { status, target } = targets[index];
    const { type, strategy } = getStrategy(target);
    const perm = strategy.compilePermission(status, target);
    if (perm.type === 'iam') {
      addPolicy(
        generatePolicyName(status, type, perm.action, perm.resource),
        perm.action,
        perm.resource,
      );
    }
    if (perm.type === 'policy') {
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

// Recursively walk a target object and apply translateFn to any Ref/Fn::GetAtt
// intrinsic that refers to a local serverless function name.
function normalizeIntrinsicRefs(value, translateFn) {
  if (_.isArray(value)) return value.map((v) => normalizeIntrinsicRefs(v, translateFn));
  if (_.isObject(value)) {
    if (value.Ref || value['Fn::GetAtt']) return translateFn(value);
    return _.mapValues(value, (v) => normalizeIntrinsicRefs(v, translateFn));
  }
  return value;
}

function* compileResources(
  stateMachineLogicalId,
  stateMachineName,
  notificationsObj,
  rolePath,
  translateFn,
) {
  const iamRoleLogicalId = `${stateMachineLogicalId}NotificationsIamRole`;
  const normalizedNotificationsObj = _.mapValues(
    notificationsObj,
    (targets) => (targets || []).map((target) => normalizeIntrinsicRefs(target, translateFn)),
  );
  const allTargets = _.flatMap(executionStatuses, (status) => _.get(
    normalizedNotificationsObj,
    status,
    [],
  ).map((target) => ({ status, target })));
  const permissions = compilePermissionResources(
    stateMachineLogicalId,
    iamRoleLogicalId,
    allTargets,
    rolePath,
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
    const targets = normalizedNotificationsObj[status];
    if (!_.isEmpty(targets)) {
      const cfnTargets = targets.map((t, index) => {
        const { strategy } = getStrategy(t);
        return strategy.compileTarget(t, index, stateMachineName, status, iamRoleLogicalId);
      });

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
    logger.log(
      `State machine [${stateMachineName}] : notifications are not supported on Express Workflows. `
      + 'Please see https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html for difference between Step Functions Standard and Express Workflow.',
    );
    return false;
  }

  const { error } = schema.validate(notificationsObj, { allowUnknown: false });

  if (error) {
    logger.log(
      `State machine [${stateMachineName}] : notifications config is malformed. `
      + 'Please see https://github.com/horike37/serverless-step-functions for examples. '
      + `${error}`,
    );
    return false;
  }

  return true;
}

// Merge AWS::SNS::TopicPolicy and AWS::SQS::QueuePolicy resources that target
// the same topic/queue into a single resource with combined statements.
//
// CloudFormation treats these resource types as full policy replacements: if two
// separate resources target the same topic/queue, the second one overwrites the
// first. When multiple state machines share a notification topic/queue (fan-in),
// this destroys the first machine's permissions. Merging into one resource with
// all statements ensures CloudFormation sets the policy exactly once, correctly.
function mergeResourcePolicies(resourcePairs) {
  const snsMap = new Map(); // JSON-serialised Topics array → { logicalId, resource }
  const sqsMap = new Map(); // JSON-serialised Queues array → { logicalId, resource }
  const result = {};

  for (const [logicalId, resource] of resourcePairs) {
    if (resource.Type === 'AWS::SNS::TopicPolicy') {
      const key = JSON.stringify(resource.Properties.Topics);
      if (snsMap.has(key)) {
        const incoming = [].concat(resource.Properties.PolicyDocument.Statement);
        snsMap.get(key).resource.Properties.PolicyDocument.Statement.push(...incoming);
      } else {
        const merged = _.cloneDeep(resource);
        merged.Properties.PolicyDocument.Statement = [].concat(
          merged.Properties.PolicyDocument.Statement,
        );
        snsMap.set(key, { logicalId, resource: merged });
        result[logicalId] = merged;
      }
    } else if (resource.Type === 'AWS::SQS::QueuePolicy') {
      const key = JSON.stringify(resource.Properties.Queues);
      if (sqsMap.has(key)) {
        const incoming = [].concat(resource.Properties.PolicyDocument.Statement);
        sqsMap.get(key).resource.Properties.PolicyDocument.Statement.push(...incoming);
      } else {
        const merged = _.cloneDeep(resource);
        merged.Properties.PolicyDocument.Statement = [].concat(
          merged.Properties.PolicyDocument.Statement,
        );
        sqsMap.set(key, { logicalId, resource: merged });
        result[logicalId] = merged;
      }
    } else {
      result[logicalId] = resource;
    }
  }

  return result;
}

module.exports = {
  compileNotifications() {
    logger.config(this.serverless, this.v3Api);
    const newResourcePairs = _.flatMap(this.getAllStateMachines(), (name) => {
      const stateMachineObj = this.getStateMachine(name);
      const stateMachineLogicalId = this.getStateMachineLogicalId(name, stateMachineObj);
      const stateMachineName = stateMachineObj.name || name;
      const notificationsObj = stateMachineObj.notifications;

      if (!validateConfig(this.serverless, stateMachineName, stateMachineObj, notificationsObj)) {
        return [];
      }

      const rolePath = _.get(this.serverless.service, 'provider.iam.role.path');
      const translateFn = translateLocalFunctionNames.bind(this);
      const resourcesIterator = compileResources(
        stateMachineLogicalId,
        stateMachineName,
        notificationsObj,
        rolePath,
        translateFn,
      );

      return Array.from(resourcesIterator);
    });
    const newResources = mergeResourcePolicies(newResourcePairs);

    _.merge(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newResources,
    );
    return BbPromise.resolve();
  },
};
