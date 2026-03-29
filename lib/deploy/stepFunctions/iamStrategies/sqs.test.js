'use strict';

const expect = require('chai').expect;
const logger = require('../../../utils/logger');
const { getPermissions } = require('./sqs');

// Configure logger so strategy modules can call logger.log
before(() => {
  logger.log = () => {};
});

// Minimal mock for serverless — sqsQueueUrlToArn only needs this for Ref intrinsic handling
const serverless = { service: { functions: {} } };

describe('sqs strategy', () => {
  it('should give sqs:SendMessage permission with specific QueueUrl (standard)', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sqs:sendMessage',
      Parameters: {
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/hello',
        Message: '42',
      },
    };
    const result = getPermissions(state, { serverless });
    expect(result).to.deep.equal([{ action: 'sqs:SendMessage', resource: 'arn:aws:sqs:us-east-1:123456789:hello' }]);
  });

  it('should give sqs:SendMessage permission with specific QueueUrl (gov)', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sqs:sendMessage',
      Parameters: {
        QueueUrl: 'https://sqs.us-gov-east-1.amazonaws.com/123456789/cloudGov',
        Message: '42',
      },
    };
    const result = getPermissions(state, { serverless });
    expect(result).to.deep.equal([{ action: 'sqs:SendMessage', resource: 'arn:aws-us-gov:sqs:us-gov-east-1:123456789:cloudGov' }]);
  });

  it('should give sqs:SendMessage permission to * when QueueUrl.$ is seen', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sqs:sendMessage',
      Parameters: {
        'QueueUrl.$': '$.queueUrl',
        Message: '42',
      },
    };
    const result = getPermissions(state, { serverless });
    expect(result).to.deep.equal([{ action: 'sqs:SendMessage', resource: '*' }]);
  });

  it('should give sqs:SendMessage permission to * when QueueUrl is an intrinsic (non-Ref)', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sqs:sendMessage',
      Parameters: {
        QueueUrl: { 'Fn::ImportValue': 'some-shared-value-here' },
        Message: '42',
      },
    };
    const result = getPermissions(state, { serverless });
    expect(result).to.deep.equal([{ action: 'sqs:SendMessage', resource: '*' }]);
  });

  it('should give sqs:SendMessage permission using Fn::GetAtt when QueueUrl is a Ref intrinsic', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sqs:sendMessage',
      Parameters: {
        QueueUrl: { Ref: 'MyQueue' },
        Message: '42',
      },
    };
    const result = getPermissions(state, { serverless });
    expect(result).to.deep.equal([{ action: 'sqs:SendMessage', resource: { 'Fn::GetAtt': ['MyQueue', 'Arn'] } }]);
  });

  it('should return [] when QueueUrl and QueueUrl.$ are missing', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sqs:sendMessage',
      Parameters: {
        Message: '42',
      },
    };
    const result = getPermissions(state, { serverless });
    expect(result).to.deep.equal([]);
  });

  it('should return empty resource array when QueueUrl is invalid', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sqs:sendMessage',
      Parameters: {
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/hello',
        Message: '42',
      },
    };
    const result = getPermissions(state, { serverless });
    expect(result).to.deep.equal([{ action: 'sqs:SendMessage', resource: [] }]);
  });
});
