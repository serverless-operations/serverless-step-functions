'use strict';

const _ = require('lodash');
const { generateTargetId, buildInputOptions } = require('./utils');

function compileTarget(targetObj, index, stateMachineName, status) {
  const inputOptions = buildInputOptions(targetObj);
  if (_.has(targetObj, 'kinesis.arn')) {
    const Arn = targetObj.kinesis.arn;
    return {
      Arn,
      Id: generateTargetId({ Arn }, index, stateMachineName, status),
      KinesisParameters: { PartitionKeyPath: targetObj.kinesis.partitionKeyPath },
      ...inputOptions,
    };
  }
  const Arn = targetObj.kinesis;
  return {
    Arn,
    Id: generateTargetId({ Arn }, index, stateMachineName, status),
    ...inputOptions,
  };
}

function compilePermission(status, targetObj) {
  const arn = _.get(targetObj, 'kinesis.arn', targetObj.kinesis);
  return { type: 'iam', action: 'kinesis:PutRecord', resource: arn };
}

module.exports = { compileTarget, compilePermission };
