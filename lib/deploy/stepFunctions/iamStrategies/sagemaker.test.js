'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./sagemaker');

describe('sagemaker strategy', () => {
  it('should give sagemaker:CreateTransformJob/DescribeTransformJob/StopTransformJob on specific job name', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sagemaker:createTransformJob.sync',
      Parameters: {
        TransformJobName: 'your-job-name',
        ModelName: 'a-model-name',
        TransformInput: {},
        TransformOutput: {},
        TransformResources: {},
      },
    };
    const result = getPermissions(state);
    const transformPerm = result.find((p) => p.action.includes('sagemaker:CreateTransformJob'));
    expect(transformPerm).to.not.equal(undefined);
    expect(transformPerm.resource).to.deep.equal({
      'Fn::Sub': [
        'arn:${AWS::Partition}:sagemaker:${AWS::Region}:${AWS::AccountId}:transform-job/your-job-name*',
        {},
      ],
    });
  });

  it('should give sagemaker:ListTags on *', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sagemaker:createTransformJob.sync',
      Parameters: {
        TransformJobName: 'your-job-name',
      },
    };
    const result = getPermissions(state);
    const listTagsPerm = result.find((p) => p.action === 'sagemaker:ListTags');
    expect(listTagsPerm).to.not.equal(undefined);
    expect(listTagsPerm.resource).to.equal('*');
  });

  it('should give events:PutTargets/PutRule/DescribeRule on sagemaker events rule', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::sagemaker:createTransformJob.sync',
      Parameters: {
        TransformJobName: 'your-job-name',
      },
    };
    const result = getPermissions(state);
    const eventsPerm = result.find((p) => p.action.includes('events:PutTargets'));
    expect(eventsPerm).to.not.equal(undefined);
    expect(eventsPerm.resource).to.deep.equal({
      'Fn::Sub': [
        'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForSageMakerTransformJobsRule',
        {},
      ],
    });
  });
});
