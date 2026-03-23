'use strict';

const _ = require('lodash');
const logger = require('../../../utils/logger');

function getPermissions(state) {
  if (_.has(state, 'Parameters.TopicArn')
      || _.has(state, ['Parameters', 'TopicArn.$'])) {
    const topicArn = state.Parameters['TopicArn.$'] ? '*' : state.Parameters.TopicArn;
    return [{ action: 'sns:Publish', resource: topicArn }];
  }
  logger.log('SNS task missing Parameters.TopicArn or Parameters.TopicArn.$');
  return [];
}

module.exports = { getPermissions };
