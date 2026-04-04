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

  it('should include statements from all state machines in the merged SNS topic policy', () => {
    const snsPolicies = Object.values(resources).filter(
      (r) => r.Type === 'AWS::SNS::TopicPolicy',
    );

    for (const policy of snsPolicies) {
      const statements = [].concat(policy.Properties.PolicyDocument.Statement);
      expect(statements.length).to.be.greaterThan(
        1,
        'SNS topic policy should have statements from both notificationMachine and notificationMachine2',
      );
    }
  });

  it('should include statements from all state machines in the merged SQS queue policy', () => {
    const sqsPolicies = Object.values(resources).filter(
      (r) => r.Type === 'AWS::SQS::QueuePolicy',
    );

    for (const policy of sqsPolicies) {
      const statements = [].concat(policy.Properties.PolicyDocument.Statement);
      expect(statements.length).to.be.greaterThan(
        1,
        'SQS queue policy should have statements from both notificationMachine and notificationMachine2',
      );
    }
  });
});
