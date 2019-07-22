'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileHttpIamRole() {
    const needDefaultIamRole = this.pluginhttpValidated.events.some(event => _.has(event, 'http') && !_.has(event, 'http.iamRole'));

    if (!needDefaultIamRole) {
      return BbPromise.resolve();
    }

    const iamRoleApiGatewayToStepFunctionsAction = [
      'states:StartExecution',
    ];

    // generate IAM Role action by http.action parameter.
    this.pluginhttpValidated.events.forEach((event) => {
      if (_.has(event, 'http.action')) {
        const actionName = `states:${event.http.action}`;

        if (iamRoleApiGatewayToStepFunctionsAction.indexOf(actionName) === -1) {
          iamRoleApiGatewayToStepFunctionsAction.push(actionName);
        }
      }
    });

    const iamRoleApiGatewayToStepFunctions = {
      Type: 'AWS::IAM::Role',
      Properties: {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'apigateway.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        },
        Policies: [
          {
            PolicyName: 'apigatewaytostepfunctions',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Action: iamRoleApiGatewayToStepFunctionsAction,
                  Resource: '*',
                },
              ],
            },
          },
        ],
      },
    };


    const getApiToStepFunctionsIamRoleLogicalId = this.getApiToStepFunctionsIamRoleLogicalId();
    const newIamRoleStateMachineExecutionObject = {
      [getApiToStepFunctionsIamRoleLogicalId]: iamRoleApiGatewayToStepFunctions,
    };

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newIamRoleStateMachineExecutionObject);
    return BbPromise.resolve();
  },
};
