'use strict';

const itParam = require('mocha-param');
const expect = require('chai').expect;
const { getPermissions, getSchedulerPermissions } = require('./eventbridge');

function getParamsOrArgs(queryLanguage, params, args) {
  return queryLanguage === 'JSONPath'
    ? { Parameters: params }
    : { Arguments: args === undefined ? params : args };
}

describe('eventbridge strategy', () => {
  describe('getPermissions (putEvents)', () => {
    itParam('should give events:PutEvents on default event bus when no EventBusName: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::events:putEvents',
        QueryLanguage: queryLanguage,
        ...getParamsOrArgs(queryLanguage, {
          Entries: [{
            Source: 'source',
            DetailType: 'DetailType',
          }],
        }),
      };
      const result = getPermissions(state);
      expect(result).to.have.lengthOf(1);
      expect(result[0].action).to.equal('events:PutEvents');
      expect(result[0].resource).to.deep.equal([{
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
          { eventBus: 'default' },
        ],
      }]);
    });

    itParam('should give events:PutEvents on multiple event buses: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::events:putEvents',
        QueryLanguage: queryLanguage,
        ...getParamsOrArgs(queryLanguage, {
          Entries: [
            { Source: 'source', DetailType: 'DetailType', EventBusName: 'default' },
            { Source: 'source', DetailType: 'DetailType', EventBusName: 'custom' },
          ],
        }),
      };
      const result = getPermissions(state);
      expect(result[0].resource).to.have.lengthOf(2);
      expect(result[0].resource).to.deep.include({
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
          { eventBus: 'default' },
        ],
      });
      expect(result[0].resource).to.deep.include({
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
          { eventBus: 'custom' },
        ],
      });
    });
  });

  describe('getSchedulerPermissions (createSchedule)', () => {
    it('should give scheduler:CreateSchedule on schedule group ARN', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:scheduler:createSchedule',
        Parameters: {
          GroupName: 'MyScheduleGroup',
          Target: {
            Arn: 'arn:...',
            RoleArn: 'arn:aws:iam::${AWS::AccountId}:role/MyIAMRole',
          },
        },
      };
      const result = getSchedulerPermissions('scheduler:CreateSchedule', state);
      const schedulePerm = result.find((p) => p.action === 'scheduler:CreateSchedule');
      expect(schedulePerm).to.not.equal(undefined);
      expect(schedulePerm.resource).to.deep.equal({
        'Fn::Sub': [
          'arn:${AWS::Partition}:scheduler:${AWS::Region}:${AWS::AccountId}:schedule/${scheduleGroupName}/*',
          { scheduleGroupName: 'MyScheduleGroup' },
        ],
      });
    });

    it('should give iam:PassRole when Target.RoleArn is present', () => {
      const roleArn = 'arn:aws:iam::${AWS::AccountId}:role/MyIAMRole';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:scheduler:createSchedule',
        Parameters: {
          GroupName: 'MyScheduleGroup',
          Target: {
            Arn: 'arn:...',
            RoleArn: roleArn,
          },
        },
      };
      const result = getSchedulerPermissions('scheduler:CreateSchedule', state);
      const rolePerm = result.find((p) => p.action === 'iam:PassRole');
      expect(rolePerm).to.not.equal(undefined);
      expect(rolePerm.resource).to.equal(roleArn);
    });

    it('should not give iam:PassRole for deleteSchedule', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:scheduler:deleteSchedule',
        Parameters: {
          GroupName: 'MyScheduleGroup',
        },
      };
      const result = getSchedulerPermissions('scheduler:DeleteSchedule', state);
      const rolePerm = result.find((p) => p.action === 'iam:PassRole');
      expect(rolePerm).to.equal(undefined);
    });

    it('should use default group name when GroupName is not present (deleteSchedule)', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:scheduler:deleteSchedule',
        Parameters: {},
      };
      const result = getSchedulerPermissions('scheduler:DeleteSchedule', state);
      const schedulePerm = result.find((p) => p.action === 'scheduler:DeleteSchedule');
      expect(schedulePerm.resource).to.deep.equal({
        'Fn::Sub': [
          'arn:${AWS::Partition}:scheduler:${AWS::Region}:${AWS::AccountId}:schedule/${scheduleGroupName}/*',
          { scheduleGroupName: 'default' },
        ],
      });
    });

    it('should support JSONata (Arguments) for createSchedule', () => {
      const roleArn = 'arn:aws:iam::${AWS::AccountId}:role/MyIAMRole';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:scheduler:createSchedule',
        QueryLanguage: 'JSONata',
        Arguments: {
          GroupName: 'MyScheduleGroup',
          Target: {
            Arn: 'arn:...',
            RoleArn: roleArn,
          },
        },
      };
      const result = getSchedulerPermissions('scheduler:CreateSchedule', state);
      const schedulePerm = result.find((p) => p.action === 'scheduler:CreateSchedule');
      expect(schedulePerm).to.not.equal(undefined);
      expect(schedulePerm.resource).to.deep.equal({
        'Fn::Sub': [
          'arn:${AWS::Partition}:scheduler:${AWS::Region}:${AWS::AccountId}:schedule/${scheduleGroupName}/*',
          { scheduleGroupName: 'MyScheduleGroup' },
        ],
      });
      const rolePerm = result.find((p) => p.action === 'iam:PassRole');
      expect(rolePerm).to.not.equal(undefined);
      expect(rolePerm.resource).to.equal(roleArn);
    });
  });
});
