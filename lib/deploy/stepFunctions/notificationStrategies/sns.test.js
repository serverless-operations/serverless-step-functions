'use strict';

const expect = require('chai').expect;
const { compileTarget, compilePermission } = require('./sns');

describe('sns notification strategy', () => {
  describe('#compileTarget()', () => {
    it('should return a CF target with the SNS ARN', () => {
      const targetObj = { sns: 'arn:aws:sns:us-east-1:123456789:MyTopic' };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED');
      expect(result.Arn).to.equal('arn:aws:sns:us-east-1:123456789:MyTopic');
      expect(result.Id).to.be.a('string');
    });

    it('should include InputPath when set', () => {
      const targetObj = { sns: 'arn:aws:sns:us-east-1:123456789:MyTopic', inputPath: '$.detail' };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED');
      expect(result.InputPath).to.equal('$.detail');
    });
  });

  describe('#compilePermission()', () => {
    it('should return a policy permission with AWS::SNS::TopicPolicy', () => {
      const targetObj = { sns: 'arn:aws:sns:us-east-1:123456789:MyTopic' };
      const result = compilePermission('FAILED', targetObj);
      expect(result.type).to.equal('policy');
      expect(result.resource.Type).to.equal('AWS::SNS::TopicPolicy');
      expect(result.resource.Properties.Topics[0]).to.equal('arn:aws:sns:us-east-1:123456789:MyTopic');
      expect(result.resource.Properties.PolicyDocument.Statement.Action).to.equal('sns:Publish');
    });
  });
});
