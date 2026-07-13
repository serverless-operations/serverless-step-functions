'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');
const awsRequest = require('./awsRequest');

describe('#awsRequest()', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('falls back to provider.request() when getAwsSdkV3Config is not available', () => {
    const provider = {
      request: sinon.stub().resolves({ ok: true }),
    };

    return awsRequest(
      provider,
      'CloudFormation',
      'describeStacks',
      { StackName: 'my-stack' },
      'dev',
      'us-east-1',
    ).then((result) => {
      expect(result).to.deep.equal({ ok: true });
      expect(provider.request.calledOnceWithExactly(
        'CloudFormation',
        'describeStacks',
        { StackName: 'my-stack' },
        'dev',
        'us-east-1',
      )).to.equal(true);
    });
  });

  it('uses an AWS SDK v3 client when getAwsSdkV3Config is available', () => {
    const sendStub = sinon.stub(CloudFormationClient.prototype, 'send')
      .resolves({ Stacks: [] });
    const provider = {
      getAwsSdkV3Config: sinon.stub().resolves({ region: 'eu-west-1' }),
      request: sinon.stub(),
    };

    return awsRequest(
      provider,
      'CloudFormation',
      'describeStacks',
      { StackName: 'my-stack' },
      'dev',
      'eu-west-1',
    ).then((result) => {
      expect(result).to.deep.equal({ Stacks: [] });
      expect(provider.request.called).to.equal(false);
      expect(sendStub.calledOnce).to.equal(true);
      const command = sendStub.firstCall.args[0];
      expect(command).to.be.instanceOf(DescribeStacksCommand);
      expect(command.input).to.deep.equal({ StackName: 'my-stack' });
    });
  });

  it('rejects for an unsupported service/method on osls v4', () => {
    const provider = {
      getAwsSdkV3Config: sinon.stub().resolves({}),
    };

    return awsRequest(provider, 'CloudFormation', 'unknownMethod', {})
      .then(() => {
        throw new Error('expected awsRequest to reject');
      })
      .catch((error) => {
        expect(error.message).to.match(/unsupported AWS call/);
      });
  });
});
