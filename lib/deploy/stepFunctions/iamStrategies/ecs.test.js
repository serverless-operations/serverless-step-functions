'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./ecs');

describe('ecs strategy', () => {
  it('should return ecs:RunTask/StopTask/DescribeTasks/TagResource and iam:PassRole permissions on *', () => {
    const result = getPermissions();
    const ecsPerm = result.find((p) => p.action.includes('ecs:RunTask'));
    expect(ecsPerm).to.not.equal(undefined);
    expect(ecsPerm.resource).to.equal('*');
  });

  it('should return events:PutTargets/PutRule/DescribeRule on the ECS events rule ARN', () => {
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
          'rule/StepFunctionsGetEventsForECSTaskRule',
        ],
      ],
    });
  });
});
