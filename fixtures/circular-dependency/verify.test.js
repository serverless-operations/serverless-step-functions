'use strict';

const fs = require('node:fs');
const path = require('node:path');
const expect = require('chai').expect;

const templatePath = path.join(
  __dirname,
  '.serverless',
  'cloudformation-template-update-stack.json',
);

describe('circular-dependency fixture — CloudFormation template', () => {
  let resources;

  before(() => {
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    resources = template.Resources;
  });

  it('should not use a plain Ref to a Lambda function as an IAM policy Resource', () => {
    const iamRoles = Object.values(resources).filter(
      (r) => r.Type === 'AWS::IAM::Role',
    );

    const badResources = [];

    iamRoles.forEach((role) => {
      const policies = (role.Properties && role.Properties.Policies) || [];
      policies.forEach((policy) => {
        const statements = (policy.PolicyDocument && policy.PolicyDocument.Statement) || [];
        [].concat(statements).forEach((statement) => {
          [].concat(statement.Resource || []).forEach((resource) => {
            if (resource && typeof resource === 'object' && resource.Ref) {
              if (typeof resource.Ref === 'string' && resource.Ref.endsWith('LambdaFunction')) {
                badResources.push(resource.Ref);
              }
            }
          });
        });
      });
    });

    expect(badResources).to.deep.equal(
      [],
      'IAM policy Resource(s) use a plain { Ref: LambdaFunction } which resolves to the '
      + 'function name, not its ARN. Use Fn::GetAtt or Fn::Sub to produce a valid ARN. '
      + `Bad refs: ${badResources.join(', ')}`,
    );
  });
});
