'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./codebuild');

describe('codebuild strategy', () => {
  it('should give codebuild:StartBuild/StopBuild/BatchGetBuilds on project ARN', () => {
    const projectName = 'HelloProject';
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::codebuild:startBuild',
      Parameters: {
        ProjectName: projectName,
      },
    };
    const result = getPermissions(state);
    const codeBuildPerm = result.find((p) => p.action.includes('codebuild:StartBuild'));
    expect(codeBuildPerm).to.not.equal(undefined);
    expect(codeBuildPerm.resource).to.deep.equal({
      'Fn::Sub': [
        `arn:\${AWS::Partition}:codebuild:$\{AWS::Region}:$\{AWS::AccountId}:project/${projectName}`,
        {},
      ],
    });
  });

  it('should give events:PutTargets/PutRule/DescribeRule on CodeBuild events rule ARN', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::codebuild:startBuild',
      Parameters: {
        ProjectName: 'TestProject',
      },
    };
    const result = getPermissions(state);
    const eventsPerm = result.find((p) => p.action.includes('events:PutTargets'));
    expect(eventsPerm).to.not.equal(undefined);
    expect(eventsPerm.resource).to.deep.equal({
      'Fn::Sub': [
        'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventForCodeBuildStartBuildRule',
        {},
      ],
    });
  });
});
