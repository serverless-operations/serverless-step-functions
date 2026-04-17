'use strict';

const { generateTargetId, generatePolicyName, buildInputOptions } = require('./utils');

function compileTarget(targetObj, index, stateMachineName, status) {
  const Arn = targetObj.sns;
  return {
    Arn,
    Id: generateTargetId({ Arn }, index, stateMachineName, status),
    ...buildInputOptions(targetObj),
  };
}

function compilePermission(status, targetObj) {
  const snsTarget = targetObj.sns;
  return {
    type: 'policy',
    resource: {
      Type: 'AWS::SNS::TopicPolicy',
      Properties: {
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: {
            Sid: generatePolicyName(status, 'sns', 'sns:Publish', snsTarget),
            Principal: { Service: 'events.amazonaws.com' },
            Effect: 'Allow',
            Action: 'sns:Publish',
            Resource: snsTarget,
          },
        },
        Topics: [snsTarget],
      },
    },
  };
}

module.exports = { compileTarget, compilePermission };
