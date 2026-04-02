'use strict';

const fs = require('node:fs');
const path = require('node:path');
const expect = require('chai').expect;

const templatePath = path.join(__dirname, '.serverless', 'cloudformation-template-update-stack.json');

describe('basic-state-machine fixture — CloudFormation template', () => {
  let resources;

  before(() => {
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    resources = template.Resources;
  });

  it('should have an IAM role for each state machine', () => {
    const stateMachineRoles = Object.values(resources).filter(
      (r) => r.Type === 'AWS::IAM::Role'
        && JSON.stringify(r).includes('states.'),
    );
    expect(stateMachineRoles).to.have.lengthOf(2);
  });

  it('should grant lambda:InvokeFunction for a Fn::GetAtt resource reference', () => {
    // basicMachine uses Fn::GetAtt: [HelloLambdaFunction, Arn] — the generated
    // role should allow invoking that function and its aliases/versions (:*)
    const roles = Object.values(resources).filter((r) => r.Type === 'AWS::IAM::Role');
    const statements = roles.flatMap((r) => r.Properties.Policies[0].PolicyDocument.Statement);
    const lambdaStatement = statements.find((s) => {
      const actions = [].concat(s.Action);
      return actions.includes('lambda:InvokeFunction');
    });
    expect(lambdaStatement, 'should have a lambda:InvokeFunction statement').to.not.equal(undefined);
    const arnList = [].concat(lambdaStatement.Resource);
    const hasGetAtt = arnList.some((a) => a && a['Fn::GetAtt']);
    expect(hasGetAtt, 'should reference the Lambda function via Fn::GetAtt').to.equal(true);
  });

  it('should not produce nested Fn::Sub when Resource is a Fn::Sub expression (issue #302)', () => {
    // fnSubMachine uses a Fn::Sub ARN (simulating serverless-pseudo-parameters output).
    // The versioned form (:*) must not nest a Fn::Sub inside a Fn::Sub variable map —
    // that is invalid CloudFormation and causes MalformedPolicyDocument errors.
    const roles = Object.values(resources).filter((r) => r.Type === 'AWS::IAM::Role');
    const statements = roles.flatMap((r) => r.Properties.Policies[0].PolicyDocument.Statement);
    const allArns = statements
      .filter((s) => [].concat(s.Action).includes('lambda:InvokeFunction'))
      .flatMap((s) => [].concat(s.Resource));

    for (const arn of allArns) {
      if (arn && typeof arn === 'object' && Array.isArray(arn['Fn::Sub'])) {
        const [, varMap] = arn['Fn::Sub'];
        if (varMap) {
          for (const val of Object.values(varMap)) {
            expect(val, 'Fn::Sub variable map must not contain a nested Fn::Sub').to.not.have.property('Fn::Sub');
          }
        }
      }
    }
  });

  it('should include a valid versioned ARN (:*) for the Fn::Sub resource', () => {
    const fnSubTemplate = 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:my-fn';
    const roles = Object.values(resources).filter((r) => r.Type === 'AWS::IAM::Role');
    const statements = roles.flatMap((r) => r.Properties.Policies[0].PolicyDocument.Statement);
    const allArns = statements
      .filter((s) => [].concat(s.Action).includes('lambda:InvokeFunction'))
      .flatMap((s) => [].concat(s.Resource));

    const versionedArn = allArns.find((a) => a && a['Fn::Sub'] === `${fnSubTemplate}:*`);
    expect(versionedArn, 'versioned ARN should be a Fn::Sub string with :* appended').to.not.equal(undefined);
  });
});
