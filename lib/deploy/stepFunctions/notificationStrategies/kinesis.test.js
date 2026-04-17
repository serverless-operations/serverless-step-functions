'use strict';

const expect = require('chai').expect;
const { compileTarget, compilePermission } = require('./kinesis');

describe('kinesis notification strategy', () => {
  describe('#compileTarget()', () => {
    it('should return a CF target with a plain Kinesis ARN', () => {
      const targetObj = { kinesis: 'arn:aws:kinesis:us-east-1:123456789:stream/MyStream' };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED');
      expect(result.Arn).to.equal('arn:aws:kinesis:us-east-1:123456789:stream/MyStream');
      expect(result).to.not.have.property('KinesisParameters');
    });

    it('should return KinesisParameters when kinesis.arn is used', () => {
      const targetObj = { kinesis: { arn: 'arn:aws:kinesis:us-east-1:123456789:stream/MyStream', partitionKeyPath: '$.id' } };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED');
      expect(result.Arn).to.equal('arn:aws:kinesis:us-east-1:123456789:stream/MyStream');
      expect(result.KinesisParameters).to.deep.equal({ PartitionKeyPath: '$.id' });
    });
  });

  describe('#compilePermission()', () => {
    it('should return an IAM permission for a plain Kinesis ARN', () => {
      const targetObj = { kinesis: 'arn:aws:kinesis:us-east-1:123456789:stream/MyStream' };
      const result = compilePermission('FAILED', targetObj);
      expect(result).to.deep.equal({
        type: 'iam',
        action: 'kinesis:PutRecord',
        resource: 'arn:aws:kinesis:us-east-1:123456789:stream/MyStream',
      });
    });

    it('should return an IAM permission using nested kinesis.arn', () => {
      const targetObj = { kinesis: { arn: 'arn:aws:kinesis:us-east-1:123456789:stream/MyStream', partitionKeyPath: '$.id' } };
      const result = compilePermission('FAILED', targetObj);
      expect(result).to.deep.equal({
        type: 'iam',
        action: 'kinesis:PutRecord',
        resource: 'arn:aws:kinesis:us-east-1:123456789:stream/MyStream',
      });
    });
  });
});
