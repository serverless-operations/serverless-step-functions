'use strict';

const expect = require('chai').expect;
const logger = require('../../../utils/logger');
const { getPermissions } = require('./sns');

// Configure logger so strategy modules can call logger.log
before(() => {
  logger.log = () => {};
});

describe('sns strategy', () => {
  it('should give sns:Publish permission with specific TopicArn', () => {
    const topicArn = 'arn:aws:sns:us-east-1:123456789:hello';
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sns:publish',
      Parameters: {
        Message: '42',
        TopicArn: topicArn,
      },
    };
    const result = getPermissions(state);
    expect(result).to.deep.equal([{ action: 'sns:Publish', resource: topicArn }]);
  });

  it('should give sns:Publish permission to * when TopicArn.$ is seen', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sns:publish',
      Parameters: {
        Message: '42',
        'TopicArn.$': '$.snsTopic',
      },
    };
    const result = getPermissions(state);
    expect(result).to.deep.equal([{ action: 'sns:Publish', resource: '*' }]);
  });

  it('should return [] when TopicArn and TopicArn.$ are missing', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sns:publish',
      Parameters: {
        MessageBody: '42',
      },
    };
    const result = getPermissions(state);
    expect(result).to.deep.equal([]);
  });
});
