'use strict';

const { generateTargetId, buildInputOptions } = require('./utils');

function compileTarget(targetObj, index, stateMachineName, status, iamRoleLogicalId) {
  const Arn = targetObj.stepFunctions;
  return {
    Arn,
    Id: generateTargetId({ Arn }, index, stateMachineName, status),
    RoleArn: { 'Fn::GetAtt': [iamRoleLogicalId, 'Arn'] },
    ...buildInputOptions(targetObj),
  };
}

function compilePermission(status, targetObj) {
  return { type: 'iam', action: 'states:StartExecution', resource: targetObj.stepFunctions };
}

module.exports = { compileTarget, compilePermission };
