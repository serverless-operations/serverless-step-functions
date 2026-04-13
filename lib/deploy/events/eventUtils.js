'use strict';

/**
 * Validates that at most one of Input, InputPath, InputTransformer is set.
 * Throws a Serverless error if more than one is set simultaneously.
 */
function validateEventInput(Input, InputPath, InputTransformer, ServerlessError) {
  if ([Input, InputPath, InputTransformer].filter(Boolean).length > 1) {
    throw new ServerlessError(
      "You can't set input, inputPath and inputTransformer properties at the "
      + 'same time for events. Please check the AWS docs for more info',
    );
  }
}

/**
 * Builds a CloudFormation IAM Role resource for events/scheduler → Step Functions execution.
 * @param {string} principalService - e.g. 'events.amazonaws.com' or 'scheduler.amazonaws.com'
 * @param {string} policyName
 * @param {string} stateMachineLogicalId
 * @returns {object} CloudFormation IAM Role resource object
 */
function buildIamRole(principalService, policyName, stateMachineLogicalId) {
  return {
    Type: 'AWS::IAM::Role',
    Properties: {
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { Service: principalService },
          Action: 'sts:AssumeRole',
        }],
      },
      Policies: [{
        PolicyName: policyName,
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Action: ['states:StartExecution'],
            Resource: { Ref: stateMachineLogicalId },
          }],
        },
      }],
    },
  };
}

module.exports = { validateEventInput, buildIamRole };
