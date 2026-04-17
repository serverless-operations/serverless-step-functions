'use strict';

const _ = require('lodash');
const { generateTargetId, generatePolicyName, buildInputOptions } = require('./utils');

function convertToQueueUrl(sqsArn) {
  if (_.isString(sqsArn)) {
    const segments = sqsArn.split(':');
    const queueName = _.last(segments);
    return {
      'Fn::Sub': [
        'https://sqs.${AWS::Region}.amazonaws.com/${AWS::AccountId}/${QueueName}',
        { QueueName: queueName },
      ],
    };
  }
  if (sqsArn['Fn::GetAtt']) {
    const logicalId = sqsArn['Fn::GetAtt'][0];
    return { Ref: logicalId };
  }
  throw new Error(
    `Unable to convert SQS ARN [${sqsArn}] to SQS Url. `
    + 'This is required for setting up Step Functions notifications to SQS. '
    + 'Try using Fn::GetAtt when setting the SQS arn.',
  );
}

function compileTarget(targetObj, index, stateMachineName, status) {
  const inputOptions = buildInputOptions(targetObj);
  if (_.has(targetObj, 'sqs.arn')) {
    const Arn = targetObj.sqs.arn;
    return {
      Arn,
      Id: generateTargetId({ Arn }, index, stateMachineName, status),
      SqsParameters: { MessageGroupId: targetObj.sqs.messageGroupId },
      ...inputOptions,
    };
  }
  const Arn = targetObj.sqs;
  return {
    Arn,
    Id: generateTargetId({ Arn }, index, stateMachineName, status),
    ...inputOptions,
  };
}

function compilePermission(status, targetObj) {
  const arn = _.get(targetObj, 'sqs.arn', targetObj.sqs);
  return {
    type: 'policy',
    resource: {
      Type: 'AWS::SQS::QueuePolicy',
      Properties: {
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: {
            Sid: generatePolicyName(status, 'sqs', 'sqs:SendMessage', arn),
            Principal: { Service: 'events.amazonaws.com' },
            Effect: 'Allow',
            Action: 'sqs:SendMessage',
            Resource: arn,
          },
        },
        Queues: [convertToQueueUrl(arn)],
      },
    },
  };
}

module.exports = { compileTarget, compilePermission, convertToQueueUrl };
