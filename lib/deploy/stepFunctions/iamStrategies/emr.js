'use strict';

function getCreateClusterPermissions({ sync = false } = {}) {
  const actions = sync
    ? 'elasticmapreduce:RunJobFlow,elasticmapreduce:DescribeCluster,elasticmapreduce:TerminateJobFlows'
    : 'elasticmapreduce:RunJobFlow';

  return [
    { action: actions, resource: '*' },
    { action: 'iam:PassRole', resource: '*' },
  ];
}

function getTerminateClusterPermissions() {
  return [{
    action: 'elasticmapreduce:TerminateJobFlows,elasticmapreduce:DescribeCluster',
    resource: '*',
  }];
}

function getAddStepPermissions() {
  return [{
    action: 'elasticmapreduce:AddJobFlowSteps,elasticmapreduce:DescribeStep,elasticmapreduce:CancelSteps',
    resource: '*',
  }];
}

function getCancelStepPermissions() {
  return [{ action: 'elasticmapreduce:CancelSteps', resource: '*' }];
}

function getSetTerminationProtectionPermissions() {
  return [{ action: 'elasticmapreduce:SetTerminationProtection', resource: '*' }];
}

function getModifyInstanceFleetPermissions() {
  return [{
    action: 'elasticmapreduce:ModifyInstanceFleet,elasticmapreduce:ListInstanceFleets',
    resource: '*',
  }];
}

function getModifyInstanceGroupPermissions() {
  return [{
    action: 'elasticmapreduce:ModifyInstanceGroups,elasticmapreduce:ListInstanceGroups',
    resource: '*',
  }];
}

module.exports = {
  getCreateClusterPermissions,
  getTerminateClusterPermissions,
  getAddStepPermissions,
  getCancelStepPermissions,
  getSetTerminationProtectionPermissions,
  getModifyInstanceFleetPermissions,
  getModifyInstanceGroupPermissions,
};
