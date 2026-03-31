'use strict';

const { getParameterOrArgument, isJsonPathParameter, isJsonataArgument } = require('./utils');

function getPermissions(state) {
  const eventBuses = new Set();
  const entries = getParameterOrArgument(state, 'Entries');

  for (const entry of entries) {
    eventBuses.add(entry.EventBusName || 'default');
  }

  return [{
    action: 'events:PutEvents',
    resource: [...eventBuses].map((eventBus) => ({
      'Fn::Sub': [
        'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
        { eventBus },
      ],
    })),
  }];
}

function getPutTargetsPermissions(state) {
  if (isJsonPathParameter(state, 'Rule') || isJsonataArgument(state, 'Rule')) {
    return [{ action: 'events:PutTargets', resource: '*' }];
  }

  const ruleName = getParameterOrArgument(state, 'Rule');
  const eventBusName = getParameterOrArgument(state, 'EventBusName');

  const template = eventBusName
    ? 'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/${eventBusName}/${ruleName}'
    : 'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/${ruleName}';

  const vars = eventBusName ? { eventBusName, ruleName } : { ruleName };

  return [{
    action: 'events:PutTargets',
    resource: { 'Fn::Sub': [template, vars] },
  }];
}

function getSchedulerPermissions(action, state) {
  const scheduleGroupName = getParameterOrArgument(state, 'GroupName') || 'default';
  const target = getParameterOrArgument(state, 'Target');
  const scheduleTargetRoleArn = target && target.RoleArn;

  return [
    {
      action,
      resource: {
        'Fn::Sub': [
          'arn:${AWS::Partition}:scheduler:${AWS::Region}:${AWS::AccountId}:schedule/${scheduleGroupName}/*',
          { scheduleGroupName },
        ],
      },
    },
    ...(scheduleTargetRoleArn ? [{
      action: 'iam:PassRole',
      resource: scheduleTargetRoleArn,
    }] : []),
  ];
}

module.exports = { getPermissions, getPutTargetsPermissions, getSchedulerPermissions };
