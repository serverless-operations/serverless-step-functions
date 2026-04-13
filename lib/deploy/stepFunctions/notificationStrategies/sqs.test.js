'use strict';

const expect = require('chai').expect;
const { compileTarget, compilePermission } = require('./sqs');

describe('sqs notification strategy', () => {
  describe('#compileTarget()', () => {
    it('should return a CF target with a plain SQS ARN', () => {
      const targetObj = { sqs: 'arn:aws:sqs:us-east-1:123456789:MyQueue' };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED');
      expect(result.Arn).to.equal('arn:aws:sqs:us-east-1:123456789:MyQueue');
      expect(result).to.not.have.property('SqsParameters');
    });

    it('should return SqsParameters when sqs.arn is used', () => {
      const targetObj = { sqs: { arn: 'arn:aws:sqs:us-east-1:123456789:MyFifoQueue.fifo', messageGroupId: 'group1' } };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED');
      expect(result.Arn).to.equal('arn:aws:sqs:us-east-1:123456789:MyFifoQueue.fifo');
      expect(result.SqsParameters).to.deep.equal({ MessageGroupId: 'group1' });
    });
  });

  describe('#compilePermission()', () => {
    it('should return a policy permission with AWS::SQS::QueuePolicy for plain ARN', () => {
      const targetObj = { sqs: 'arn:aws:sqs:us-east-1:123456789:MyQueue' };
      const result = compilePermission('FAILED', targetObj);
      expect(result.type).to.equal('policy');
      expect(result.resource.Type).to.equal('AWS::SQS::QueuePolicy');
      expect(result.resource.Properties.PolicyDocument.Statement.Action).to.equal('sqs:SendMessage');
    });

    it('should return a policy permission using nested sqs.arn', () => {
      const targetObj = { sqs: { arn: 'arn:aws:sqs:us-east-1:123456789:MyQueue', messageGroupId: 'group1' } };
      const result = compilePermission('FAILED', targetObj);
      expect(result.type).to.equal('policy');
      expect(result.resource.Type).to.equal('AWS::SQS::QueuePolicy');
    });
  });
});
