'use strict';

const { generateTargetId, buildInputOptions } = require('./utils');

function compileTarget(targetObj, index, stateMachineName, status) {
  const Arn = targetObj.firehose;
  return {
    Arn,
    Id: generateTargetId({ Arn }, index, stateMachineName, status),
    ...buildInputOptions(targetObj),
  };
}

function compilePermission(status, targetObj) {
  return { type: 'iam', action: 'firehose:PutRecord', resource: targetObj.firehose };
}

module.exports = { compileTarget, compilePermission };
