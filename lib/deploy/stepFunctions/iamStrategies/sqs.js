'use strict';

const _ = require('lodash');
const logger = require('../../../utils/logger');
const { sqsQueueUrlToArn } = require('./utils');

function getPermissions(state, { serverless }) {
  if (_.has(state, 'Parameters.QueueUrl')
      || _.has(state, ['Parameters', 'QueueUrl.$'])) {
    const queueArn = state.Parameters['QueueUrl.$']
      ? '*'
      : sqsQueueUrlToArn(serverless, state.Parameters.QueueUrl);
    return [{ action: 'sqs:SendMessage', resource: queueArn }];
  }
  logger.log('SQS task missing Parameters.QueueUrl or Parameters.QueueUrl.$');
  return [];
}

module.exports = { getPermissions };
