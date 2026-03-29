'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./batch');

describe('batch strategy', () => {
  it('should return batch:SubmitJob/DescribeJobs/TerminateJob permissions on *', () => {
    const result = getPermissions();
    const batchPerm = result.find((p) => p.action.includes('batch:SubmitJob'));
    expect(batchPerm).to.not.equal(undefined);
    expect(batchPerm.resource).to.equal('*');
  });

  it('should return events:PutTargets/PutRule/DescribeRule on the batch events rule ARN', () => {
    const result = getPermissions();
    const eventsPerm = result.find((p) => p.action.includes('events:PutTargets'));
    expect(eventsPerm).to.not.equal(undefined);
    expect(eventsPerm.resource).to.deep.equal({
      'Fn::Join': [
        ':',
        [
          'arn',
          { Ref: 'AWS::Partition' },
          'events',
          { Ref: 'AWS::Region' },
          { Ref: 'AWS::AccountId' },
          'rule/StepFunctionsGetEventsForBatchJobsRule',
        ],
      ],
    });
  });
});
