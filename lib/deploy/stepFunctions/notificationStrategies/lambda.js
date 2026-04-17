'use strict';

const { generateTargetId, buildInputOptions } = require('./utils');

function compileTarget(targetObj, index, stateMachineName, status) {
  const Arn = targetObj.lambda;
  return {
    Arn,
    Id: generateTargetId({ Arn }, index, stateMachineName, status),
    ...buildInputOptions(targetObj),
  };
}

function compilePermission(status, targetObj) {
  return {
    type: 'policy',
    resource: {
      Type: 'AWS::Lambda::Permission',
      Properties: {
        Action: 'lambda:InvokeFunction',
        FunctionName: targetObj.lambda,
        Principal: 'events.amazonaws.com',
      },
    },
  };
}

module.exports = { compileTarget, compilePermission };
