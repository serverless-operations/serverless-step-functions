'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./bedrock');

describe('bedrock strategy', () => {
  it('should give bedrock:InvokeModel with Fn::Sub ARN for a non-ARN model ID', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::bedrock:invokeModel',
      Parameters: {
        ModelId: 'anthropic.claude-v2:1',
      },
    };
    const result = getPermissions(state);
    expect(result).to.deep.equal([{
      action: 'bedrock:InvokeModel',
      resource: {
        'Fn::Sub': [
          'arn:${AWS::Partition}:bedrock:${AWS::Region}::foundation-model/anthropic.claude-v2:1',
          {},
        ],
      },
    }]);
  });

  it('should give bedrock:InvokeModel with literal ARN for a full ARN model ID', () => {
    const modelArn = 'arn:aws:bedrock:us-east-1::foundation-model/meta.llama2-70b-chat-v1';
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::bedrock:invokeModel',
      Parameters: {
        ModelId: modelArn,
      },
    };
    const result = getPermissions(state);
    expect(result).to.deep.equal([{
      action: 'bedrock:InvokeModel',
      resource: modelArn,
    }]);
  });
});
