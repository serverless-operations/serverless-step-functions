'use strict';

const itParam = require('mocha-param');
const expect = require('chai').expect;
const { getPermissions, getPutTargetsPermissions, getSchedulerPermissions } = require('./eventbridge');

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
      const results = getPermissions(state);
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.equal('events:PutEvents');
      expect(result.resource).to.deep.equal([{
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
      const results = getPermissions(state);
      const result = results[0];
      expect(result.resource).to.have.lengthOf(2);
      expect(result.resource).to.deep.include({
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
          { eventBus: 'default' },
        ],
      });
      expect(result.resource).to.deep.include({
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:event-bus/${eventBus}',
          { eventBus: 'custom' },
        ],
      });
    });
  });

  describe('getPutTargetsPermissions (putTargets)', () => {
    itParam('should give events:PutTargets on * when Rule is dynamic: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:eventbridge:putTargets.waitForTaskToken',
        QueryLanguage: queryLanguage,
        ...getParamsOrArgs(
          queryLanguage,
          { 'Rule.$': '$.ruleName', Targets: [] },
          { Rule: '{%$states.input.ruleName%}', Targets: [] },
        ),
      };
      const results = getPutTargetsPermissions(state);
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.equal('events:PutTargets');
      expect(result.resource).to.equal('*');
    });

    itParam('should give events:PutTargets scoped to rule ARN when no EventBusName: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:eventbridge:putTargets',
        QueryLanguage: queryLanguage,
        ...getParamsOrArgs(queryLanguage, {
          Rule: 'MyRule',
          Targets: [{ Id: '1', Arn: 'arn:aws:lambda:us-east-1:123:function:fn' }],
        }),
      };
      const results = getPutTargetsPermissions(state);
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.equal('events:PutTargets');
      expect(result.resource).to.deep.equal({
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/${ruleName}',
          { ruleName: 'MyRule' },
        ],
      });
    });

    itParam('should give events:PutTargets scoped to rule ARN with EventBusName: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:eventbridge:putTargets',
        QueryLanguage: queryLanguage,
        ...getParamsOrArgs(queryLanguage, {
          Rule: 'MyRule',
          EventBusName: 'MyBus',
          Targets: [{ Id: '1', Arn: 'arn:aws:lambda:us-east-1:123:function:fn' }],
        }),
      };
      const results = getPutTargetsPermissions(state);
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.equal('events:PutTargets');
      expect(result.resource).to.deep.equal({
        'Fn::Sub': [
          'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/${eventBusName}/${ruleName}',
          { eventBusName: 'MyBus', ruleName: 'MyRule' },
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
      const results = getSchedulerPermissions('scheduler:CreateSchedule', state);
      const schedulePerm = results.find((p) => p.action === 'scheduler:CreateSchedule');
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
      const results = getSchedulerPermissions('scheduler:CreateSchedule', state);
      const rolePerm = results.find((p) => p.action === 'iam:PassRole');
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
      const results = getSchedulerPermissions('scheduler:DeleteSchedule', state);
      const rolePerm = results.find((p) => p.action === 'iam:PassRole');
      expect(rolePerm).to.equal(undefined);
    });

    it('should use default group name when GroupName is not present (deleteSchedule)', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:scheduler:deleteSchedule',
        Parameters: {},
      };
      const results = getSchedulerPermissions('scheduler:DeleteSchedule', state);
      const schedulePerm = results.find((p) => p.action === 'scheduler:DeleteSchedule');
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
      const results = getSchedulerPermissions('scheduler:CreateSchedule', state);
      const schedulePerm = results.find((p) => p.action === 'scheduler:CreateSchedule');
      expect(schedulePerm).to.not.equal(undefined);
      expect(schedulePerm.resource).to.deep.equal({
        'Fn::Sub': [
          'arn:${AWS::Partition}:scheduler:${AWS::Region}:${AWS::AccountId}:schedule/${scheduleGroupName}/*',
          { scheduleGroupName: 'MyScheduleGroup' },
        ],
      });
      const rolePerm = results.find((p) => p.action === 'iam:PassRole');
      expect(rolePerm).to.not.equal(undefined);
      expect(rolePerm.resource).to.equal(roleArn);
    });
  });
});
