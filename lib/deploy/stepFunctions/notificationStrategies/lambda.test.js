'use strict';

const expect = require('chai').expect;
const { compileTarget, compilePermission } = require('./lambda');

describe('lambda notification strategy', () => {
  describe('#compileTarget()', () => {
    it('should return a CF target with the Lambda ARN', () => {
      const targetObj = { lambda: 'arn:aws:lambda:us-east-1:123456789:function:MyFunction' };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED');
      expect(result.Arn).to.equal('arn:aws:lambda:us-east-1:123456789:function:MyFunction');
      expect(result.Id).to.be.a('string');
    });
  });

  describe('#compilePermission()', () => {
    it('should return a Lambda Permission resource', () => {
      const targetObj = { lambda: 'arn:aws:lambda:us-east-1:123456789:function:MyFunction' };
      const result = compilePermission('FAILED', targetObj);
      expect(result.type).to.equal('policy');
      expect(result.resource.Type).to.equal('AWS::Lambda::Permission');
      expect(result.resource.Properties.FunctionName).to.equal('arn:aws:lambda:us-east-1:123456789:function:MyFunction');
      expect(result.resource.Properties.Action).to.equal('lambda:InvokeFunction');
    });
  });
});
