'use strict';

const expect = require('chai').expect;
const { getStartExecutionPermissions, getSDKPermissions } = require('./stepFunctions');

const EVENTS_RULE_RESOURCE = {
  'Fn::Sub': [
    'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForStepFunctionsExecutionRule',
    {},
  ],
};

describe('stepFunctions strategy', () => {
  describe('getStartExecutionPermissions', () => {
    it('jsonpath: should give states:StartExecution on specific ARN', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution',
        Parameters: {
          StateMachineArn: stateMachineArn,
          Input: {},
        },
      };
      const result = getStartExecutionPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartExecution');
      expect(startPerm).to.not.equal(undefined);
      expect(startPerm.resource).to.equal(stateMachineArn);
    });

    it('jsonpath: should give states:DescribeExecution,states:StopExecution on execution ARN', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution',
        Parameters: {
          StateMachineArn: stateMachineArn,
          Input: {},
        },
      };
      const result = getStartExecutionPermissions(state);
      const execPerm = result.find((p) => p.action === 'states:DescribeExecution,states:StopExecution');
      expect(execPerm).to.not.equal(undefined);
      expect(execPerm.resource).to.equal('arn:aws:states:us-east-1:123456789:execution:HelloStateMachine:*');
    });

    it('jsonpath: should give events:PutTargets/PutRule/DescribeRule on step functions events rule', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution',
        Parameters: {
          StateMachineArn: stateMachineArn,
          Input: {},
        },
      };
      const result = getStartExecutionPermissions(state);
      const eventsPerm = result.find((p) => p.action === 'events:PutTargets,events:PutRule,events:DescribeRule');
      expect(eventsPerm).to.not.equal(undefined);
      expect(eventsPerm.resource).to.deep.equal(EVENTS_RULE_RESOURCE);
    });

    it('jsonata: should give states:StartExecution on specific ARN', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution',
        Arguments: {
          StateMachineArn: stateMachineArn,
          Input: {},
        },
      };
      const result = getStartExecutionPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartExecution');
      expect(startPerm.resource).to.equal(stateMachineArn);
    });

    it('jsonata: should give * when StateMachineArn is JSONata expression', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution',
        Arguments: {
          StateMachineArn: '{% $arn %}',
          Input: {},
        },
      };
      const result = getStartExecutionPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartExecution');
      expect(startPerm.resource).to.equal('*');
    });

    it('jsonpath: should give * when StateMachineArn.$ is used', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution',
        Parameters: {
          'StateMachineArn.$': '$.arn',
          Input: {},
        },
      };
      const result = getStartExecutionPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartExecution');
      expect(startPerm.resource).to.equal('*');
    });

    it('jsonata: should give execution ARN with Fn::Sub for Fn::Sub stateMachine ARN', () => {
      const stateMachineArn = {
        'Fn::Sub': 'arn:aws:states:${AWS::Region}:${AWS::AccountId}:stateMachine:HelloStateMachine',
      };
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution.sync:2',
        Arguments: {
          StateMachineArn: stateMachineArn,
          Input: {},
        },
      };
      const result = getStartExecutionPermissions(state);
      const execPerm = result.find((p) => p.action === 'states:DescribeExecution,states:StopExecution');
      expect(execPerm.resource).to.deep.equal({
        'Fn::Sub': 'arn:aws:states:${AWS::Region}:${AWS::AccountId}:execution:HelloStateMachine:*',
      });
    });

    it('should not throw when StateMachineArn is a top-level Ref (no Parameters block)', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution',
        StateMachineArn: { Ref: 'goodbyeMachine' },
      };
      expect(() => getStartExecutionPermissions(state)).to.not.throw();
      const result = getStartExecutionPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartExecution');
      expect(startPerm.resource).to.deep.equal({ Ref: 'goodbyeMachine' });
    });

    it('should not produce null resource when StateMachineArn is Fn::GetAtt in Parameters', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::states:startExecution',
        Parameters: {
          StateMachineArn: { 'Fn::GetAtt': ['TestMachine', 'Arn'] },
          Input: {},
        },
      };
      const result = getStartExecutionPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartExecution');
      expect(startPerm.resource).to.deep.equal({ 'Fn::GetAtt': ['TestMachine', 'Arn'] });
    });

    it('should use DISTRIBUTED mode stateMachineName for resource ARN', () => {
      const state = {
        Type: 'Map',
        Mode: 'DISTRIBUTED',
        StateMachineName: 'myStateMachine',
        Parameters: {
          StateMachineArn: 'arn:...',
        },
      };
      const result = getStartExecutionPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartExecution');
      expect(startPerm.resource).to.deep.equal({
        'Fn::Sub': [
          'arn:${AWS::Partition}:states:${AWS::Region}:${AWS::AccountId}:stateMachine:myStateMachine',
          {},
        ],
      });
    });
  });

  describe('getSDKPermissions', () => {
    it('jsonpath: should give states:StartSyncExecution on specific ARN', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
        Parameters: {
          StateMachineArn: stateMachineArn,
          Input: {},
        },
      };
      const result = getSDKPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartSyncExecution');
      expect(startPerm).to.not.equal(undefined);
      expect(startPerm.resource).to.equal(stateMachineArn);
    });

    it('jsonata: should give states:StartSyncExecution on specific ARN', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
        Arguments: {
          StateMachineArn: stateMachineArn,
          Input: {},
        },
      };
      const result = getSDKPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartSyncExecution');
      expect(startPerm.resource).to.equal(stateMachineArn);
    });

    it('jsonpath: should give * when StateMachineArn.$ is used', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
        Parameters: {
          'StateMachineArn.$': '$.arn',
          Input: {},
        },
      };
      const result = getSDKPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartSyncExecution');
      expect(startPerm.resource).to.equal('*');
    });

    it('jsonata: should give * when StateMachineArn is JSONata expression', () => {
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
        Arguments: {
          StateMachineArn: '{% $arn %}',
          Input: {},
        },
      };
      const result = getSDKPermissions(state);
      const startPerm = result.find((p) => p.action === 'states:StartSyncExecution');
      expect(startPerm.resource).to.equal('*');
    });

    it('should give events rule permission', () => {
      const stateMachineArn = 'arn:aws:states:us-east-1:123456789:stateMachine:HelloStateMachine';
      const state = {
        Type: 'Task',
        Resource: 'arn:aws:states:::aws-sdk:sfn:startSyncExecution',
        Parameters: {
          StateMachineArn: stateMachineArn,
          Input: {},
        },
      };
      const result = getSDKPermissions(state);
      const eventsPerm = result.find((p) => p.action === 'events:PutTargets,events:PutRule,events:DescribeRule');
      expect(eventsPerm.resource).to.deep.equal(EVENTS_RULE_RESOURCE);
    });
  });
});
