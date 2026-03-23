'use strict';

function getPermissions(state) {
  const transformJobName = state.Parameters.TransformJobName ? `${state.Parameters.TransformJobName}` : '';

  return [{
    action: 'sagemaker:CreateTransformJob,sagemaker:DescribeTransformJob,sagemaker:StopTransformJob',
    resource: {
      'Fn::Sub': [
        `arn:\${AWS::Partition}:sagemaker:$\{AWS::Region}:$\{AWS::AccountId}:transform-job/${transformJobName}*`,
        {},
      ],
    },
  }, {
    action: 'sagemaker:ListTags',
    resource: '*',
  }, {
    action: 'events:PutTargets,events:PutRule,events:DescribeRule',
    resource: {
      'Fn::Sub': [
        'arn:${AWS::Partition}:events:${AWS::Region}:${AWS::AccountId}:rule/StepFunctionsGetEventsForSageMakerTransformJobsRule',
        {},
      ],
    },
  }];
}

module.exports = { getPermissions };
