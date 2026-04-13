'use strict';

const crypto = require('node:crypto');

function generateTargetId(target, index, stateMachineName, status) {
  const suffix = crypto
    .createHash('md5')
    .update(JSON.stringify({ target, index }))
    .digest('hex')
    .substr(0, 5);
  return `${stateMachineName}-${status}-${suffix}`;
}

function generatePolicyName(status, targetType, action, resource) {
  const suffix = crypto
    .createHash('md5')
    .update(JSON.stringify({ action, resource }))
    .digest('hex')
    .substr(0, 5);
  return `${status}-${targetType}-${suffix}`;
}

function buildInputOptions(targetObj) {
  return {
    ...(targetObj.inputPath && { InputPath: targetObj.inputPath }),
    ...(targetObj.inputTransformer && {
      InputTransformer: {
        InputPathsMap: targetObj.inputTransformer.inputPathsMap,
        InputTemplate: targetObj.inputTransformer.inputTemplate,
      },
    }),
  };
}

module.exports = { generateTargetId, generatePolicyName, buildInputOptions };
