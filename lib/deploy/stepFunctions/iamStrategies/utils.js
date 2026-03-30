'use strict';

const { isIntrinsic } = require('../../../utils/aws');
const { getArnPartition } = require('../../../utils/arn');
const logger = require('../../../utils/logger');

function sqsQueueUrlToArn(serverless, queueUrl) {
  const regex = /https:\/\/sqs.(.*).amazonaws.com\/(.*)\/(.*)/g;
  const match = regex.exec(queueUrl);
  if (match) {
    const region = match[1];
    const accountId = match[2];
    const queueName = match[3];
    const partition = getArnPartition(region);
    return `arn:${partition}:sqs:${region}:${accountId}:${queueName}`;
  }
  if (isIntrinsic(queueUrl)) {
    if (queueUrl.Ref) {
      return {
        'Fn::GetAtt': [queueUrl.Ref, 'Arn'],
      };
    }
    return '*';
  }
  logger.log(`Unable to parse SQS queue url [${queueUrl}]`);
  return [];
}

function getDynamoDBArn(tableName) {
  if (isIntrinsic(tableName)) {
    if (tableName.Ref) {
      return {
        'Fn::GetAtt': [tableName.Ref, 'Arn'],
      };
    }
    if (tableName['Fn::ImportValue']) {
      return {
        'Fn::Join': [
          ':',
          [
            'arn',
            { Ref: 'AWS::Partition' },
            'dynamodb',
            { Ref: 'AWS::Region' },
            { Ref: 'AWS::AccountId' },
            {
              'Fn::Join': [
                '/',
                [
                  'table',
                  tableName,
                ],
              ],
            },
          ],
        ],
      };
    }
  }

  return {
    'Fn::Join': [
      ':',
      [
        'arn',
        { Ref: 'AWS::Partition' },
        'dynamodb',
        { Ref: 'AWS::Region' },
        { Ref: 'AWS::AccountId' },
        `table/${tableName}`,
      ],
    ],
  };
}

function isJsonPathParameter(state, key) {
  const jsonPath = `${key}.$`;
  return state.Parameters && state.Parameters[jsonPath];
}

function isJsonataArgument(state, key) {
  return state.Arguments && state.Arguments[key] && typeof state.Arguments[key] === 'string' && state.Arguments[key].trim().startsWith('{%');
}

function getParameterOrArgument(state, key) {
  if (state.QueryLanguage === 'JSONata') return state.Arguments && state.Arguments[key];

  if (state.QueryLanguage === 'JSONPath') return state.Parameters && state.Parameters[key];

  if (state.Parameters && !state.Arguments) return state.Parameters[key];

  if (state.Arguments && !state.Parameters) return state.Arguments[key];

  return undefined;
}

function hasParameterOrArgument(state, key) {
  if (state.QueryLanguage === 'JSONata') return state.Arguments && state.Arguments[key];

  if (state.QueryLanguage === 'JSONPath') return state.Parameters && state.Parameters[key];

  if (state.Parameters && !state.Arguments) return state.Parameters[key];

  if (state.Arguments && !state.Parameters) return state.Arguments[key];

  return false;
}

function getStateMachineArn(state) {
  let stateMachineArn;

  if (state.Arguments) {
    const arn = state.Arguments.StateMachineArn;
    if (typeof arn !== 'string') {
      stateMachineArn = arn;
    } else {
      stateMachineArn = arn.trim().startsWith('{%') ? '*' : arn;
    }
  } else if (state.Parameters) {
    stateMachineArn = state.Parameters['StateMachineArn.$']
      ? '*'
      : state.Parameters.StateMachineArn;
  } else {
    // StateMachineArn may be a top-level field (e.g., { Ref: 'logicalId' })
    stateMachineArn = state.StateMachineArn || '*';
  }

  return stateMachineArn;
}

function getExecutionArn(stateMachineArn) {
  if (stateMachineArn === '*') {
    return '*';
  }
  if (typeof stateMachineArn === 'string') {
    return `${stateMachineArn.replace(':stateMachine:', ':execution:')}:*`;
  }
  if (stateMachineArn['Fn::Sub']) {
    const sub = stateMachineArn['Fn::Sub'];
    if (typeof sub === 'string') {
      return {
        'Fn::Sub': `${sub.replace(':stateMachine:', ':execution:')}:*`,
      };
    }
    const [template, vars] = sub;
    return {
      'Fn::Sub': [
        `${template.replace(':stateMachine:', ':execution:')}:*`,
        vars,
      ],
    };
  }
  return '*';
}

function resolveS3BucketReference(bucket, resource) {
  if (isIntrinsic(bucket)) {
    return {
      'Fn::Sub': [
        resource,
        { bucket },
      ],
    };
  }

  return { 'Fn::Sub': resource.replaceAll('${bucket}', bucket) };
}

function resolveS3BucketReferences(bucket, resources) {
  return resources.map((resource) => resolveS3BucketReference(bucket, resource));
}

module.exports = {
  sqsQueueUrlToArn,
  getDynamoDBArn,
  isJsonPathParameter,
  isJsonataArgument,
  getParameterOrArgument,
  hasParameterOrArgument,
  getStateMachineArn,
  getExecutionArn,
  resolveS3BucketReference,
  resolveS3BucketReferences,
};
