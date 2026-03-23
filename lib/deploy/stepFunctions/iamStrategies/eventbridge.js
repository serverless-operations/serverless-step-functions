'use strict';

const { getParameterOrArgument } = require('./utils');

function getPermissions(state) {
  const eventBuses = new Set();
  const entries = getParameterOrArgument(state, 'Entries');

  for (const entry of entries) {
    eventBuses.add(entry.EventBusName || 'default');
  }

  return [{
    action: 'events:PutEvents',
    resource: [...eventBuses].map(eventBus => ({
      'Fn::Sub': [
        'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
        { eventBus },
      ],
    })),
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

module.exports = { getPermissions, getSchedulerPermissions };
