'use strict';

const expect = require('chai').expect;
const { validateEventInput, buildIamRole } = require('./eventUtils');

class TestError extends Error {}

describe('eventUtils', () => {
  describe('#validateEventInput()', () => {
    it('should not throw when only Input is set', () => {
      expect(() => validateEventInput('value', undefined, undefined, TestError)).to.not.throw();
    });

    it('should not throw when only InputPath is set', () => {
      expect(() => validateEventInput(undefined, '$.path', undefined, TestError)).to.not.throw();
    });

    it('should not throw when only InputTransformer is set', () => {
      expect(() => validateEventInput(undefined, undefined, { inputTemplate: 'tpl' }, TestError)).to.not.throw();
    });

    it('should not throw when none are set', () => {
      expect(() => validateEventInput(undefined, undefined, undefined, TestError)).to.not.throw();
    });

    it('should throw when Input and InputPath are both set', () => {
      expect(() => validateEventInput('value', '$.path', undefined, TestError)).to.throw(TestError);
    });

    it('should throw when Input and InputTransformer are both set', () => {
      expect(() => validateEventInput('value', undefined, { inputTemplate: 'tpl' }, TestError)).to.throw(TestError);
    });

    it('should throw when all three are set', () => {
      expect(() => validateEventInput('value', '$.path', { inputTemplate: 'tpl' }, TestError)).to.throw(TestError);
    });
  });

  describe('#buildIamRole()', () => {
    it('should return a CF IAM Role with the given principal service', () => {
      const result = buildIamRole('events.amazonaws.com', 'my-policy', 'MyStateMachine');
      expect(result.Type).to.equal('AWS::IAM::Role');
      expect(result.Properties.AssumeRolePolicyDocument.Statement[0].Principal.Service)
        .to.equal('events.amazonaws.com');
    });

    it('should set the policy name and state machine resource ref', () => {
      const result = buildIamRole('scheduler.amazonaws.com', 'my-policy', 'MyStateMachine');
      const policy = result.Properties.Policies[0];
      expect(policy.PolicyName).to.equal('my-policy');
      expect(policy.PolicyDocument.Statement[0].Resource).to.deep.equal({ Ref: 'MyStateMachine' });
      expect(policy.PolicyDocument.Statement[0].Action).to.deep.equal(['states:StartExecution']);
    });

    it('should use the given principal service for scheduler', () => {
      const result = buildIamRole('scheduler.amazonaws.com', 'my-policy', 'MyStateMachine');
      expect(result.Properties.AssumeRolePolicyDocument.Statement[0].Principal.Service)
        .to.equal('scheduler.amazonaws.com');
    });
  });
});
