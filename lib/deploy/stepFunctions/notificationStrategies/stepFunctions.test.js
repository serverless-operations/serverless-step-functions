'use strict';

const expect = require('chai').expect;
const { compileTarget, compilePermission } = require('./stepFunctions');

describe('stepFunctions notification strategy', () => {
  describe('#compileTarget()', () => {
    it('should return a CF target with RoleArn', () => {
      const targetObj = { stepFunctions: 'arn:aws:states:us-east-1:123456789:stateMachine:MyMachine' };
      const result = compileTarget(targetObj, 0, 'MyMachine', 'FAILED', 'MyIamRoleLogicalId');
      expect(result.Arn).to.equal('arn:aws:states:us-east-1:123456789:stateMachine:MyMachine');
      expect(result.RoleArn).to.deep.equal({ 'Fn::GetAtt': ['MyIamRoleLogicalId', 'Arn'] });
      expect(result.Id).to.be.a('string');
    });
  });

  describe('#compilePermission()', () => {
    it('should return an IAM permission for Step Functions execution', () => {
      const targetObj = { stepFunctions: 'arn:aws:states:us-east-1:123456789:stateMachine:MyMachine' };
      const result = compilePermission('FAILED', targetObj);
      expect(result).to.deep.equal({
        type: 'iam',
        action: 'states:StartExecution',
        resource: 'arn:aws:states:us-east-1:123456789:stateMachine:MyMachine',
      });
    });
  });
});
