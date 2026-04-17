'use strict';

const expect = require('chai').expect;
const { compileTarget, compilePermission } = require('./firehose');

describe('firehose notification strategy', () => {
  describe('#compileTarget()', () => {
    it('should return a CF target with the Firehose ARN', () => {
      const targetObj = { firehose: 'arn:aws:firehose:us-east-1:123456789:deliverystream/MyStream' };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED');
      expect(result.Arn).to.equal('arn:aws:firehose:us-east-1:123456789:deliverystream/MyStream');
      expect(result.Id).to.be.a('string');
    });
  });

  describe('#compilePermission()', () => {
    it('should return an IAM permission for Firehose', () => {
      const targetObj = { firehose: 'arn:aws:firehose:us-east-1:123456789:deliverystream/MyStream' };
      const result = compilePermission('FAILED', targetObj);
      expect(result).to.deep.equal({
        type: 'iam',
        action: 'firehose:PutRecord',
        resource: 'arn:aws:firehose:us-east-1:123456789:deliverystream/MyStream',
      });
    });
  });
});
