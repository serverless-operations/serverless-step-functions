'use strict';

const fs = require('node:fs');
const path = require('node:path');
const expect = require('chai').expect;

const templatePath = path.join(__dirname, '.serverless', 'cloudformation-template-update-stack.json');

describe('notifications fixture — CloudFormation template', () => {
  let resources;

  before(() => {
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    resources = template.Resources;
  });

  it('should produce exactly one AWS::SNS::TopicPolicy per unique topic', () => {
    const snsPolicies = Object.values(resources).filter(
      (r) => r.Type === 'AWS::SNS::TopicPolicy',
    );

    const topicKeys = snsPolicies.map((p) => JSON.stringify(p.Properties.Topics));
    const uniqueTopics = new Set(topicKeys);

    expect(snsPolicies.length).to.equal(
      uniqueTopics.size,
      'Multiple AWS::SNS::TopicPolicy resources for the same topic — the second would '
      + 'overwrite the first in CloudFormation, silently breaking the first machine\'s notifications',
    );
  });

  it('should produce exactly one AWS::SQS::QueuePolicy per unique queue', () => {
    const sqsPolicies = Object.values(resources).filter(
      (r) => r.Type === 'AWS::SQS::QueuePolicy',
    );

    const queueKeys = sqsPolicies.map((p) => JSON.stringify(p.Properties.Queues));
    const uniqueQueues = new Set(queueKeys);

    expect(sqsPolicies.length).to.equal(
      uniqueQueues.size,
      'Multiple AWS::SQS::QueuePolicy resources for the same queue — the second would '
      + 'overwrite the first in CloudFormation, silently breaking the first machine\'s notifications',
    );
  });

  it('should not emit duplicate statement Sids in any merged SNS topic policy', () => {
    // Regression guard for #801: the fan-in fixture has two state machines targeting the
    // same topic on the same status, so their grants share a Sid. If they are concatenated
    // without deduping, AWS rejects the deploy with "Every policy statement must have a
    // unique ID". LocalStack accepts duplicate Sids, so only this template assertion catches it.
    const snsPolicies = Object.values(resources).filter(
      (r) => r.Type === 'AWS::SNS::TopicPolicy',
    );

    for (const policy of snsPolicies) {
      const sids = [].concat(policy.Properties.PolicyDocument.Statement).map((s) => s.Sid);
      expect(new Set(sids).size).to.equal(
        sids.length,
        'Duplicate Sid in a merged SNS topic policy — AWS rejects this with '
        + `"Every policy statement must have a unique ID": [${sids}]`,
      );
    }
  });

  it('should not emit duplicate statement Sids in any merged SQS queue policy', () => {
    const sqsPolicies = Object.values(resources).filter(
      (r) => r.Type === 'AWS::SQS::QueuePolicy',
    );

    for (const policy of sqsPolicies) {
      const sids = [].concat(policy.Properties.PolicyDocument.Statement).map((s) => s.Sid);
      expect(new Set(sids).size).to.equal(
        sids.length,
        'Duplicate Sid in a merged SQS queue policy — AWS rejects this with '
        + `"Every policy statement must have a unique ID": [${sids}]`,
      );
    }
  });
});
