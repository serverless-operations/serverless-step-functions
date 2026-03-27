'use strict';

const { getStateMachineArn, getExecutionArn } = require('./utils');

const EVENTS_RULE_RESOURCE = {
  'Fn::Sub': [
    'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForStepFunctionsExecutionRule',
    {},
  ],
};

function resolveStateMachineArn(state) {
  if (state.Mode === 'DISTRIBUTED') {
    return {
      'Fn::Sub': [
        `arn:\${AWS::Partition}:states:\${AWS::Region}:\${AWS::AccountId}:stateMachine:${state.StateMachineName}`,
        {},
      ],
    };
  }
  return getStateMachineArn(state);
}

function getStartExecutionPermissions(state) {
  const stateMachineArn = resolveStateMachineArn(state);

  return [{
    action: 'states:StartExecution',
    resource: stateMachineArn,
  }, {
    action: 'states:DescribeExecution,states:StopExecution',
    resource: getExecutionArn(stateMachineArn),
  }, {
    action: 'events:PutTargets,events:PutRule,events:DescribeRule',
    resource: EVENTS_RULE_RESOURCE,
  }];
}

function getSDKPermissions(state) {
  const stateMachineArn = resolveStateMachineArn(state);

  return [{
    action: 'states:StartSyncExecution',
    resource: stateMachineArn,
  }, {
    action: 'states:DescribeExecution,states:StopExecution',
    resource: getExecutionArn(stateMachineArn),
  }, {
    action: 'events:PutTargets,events:PutRule,events:DescribeRule',
    resource: EVENTS_RULE_RESOURCE,
  }];
}

module.exports = { getStartExecutionPermissions, getSDKPermissions };
