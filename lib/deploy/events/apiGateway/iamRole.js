'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');
const path = require('path');

module.exports = {
  compileHttpIamRole() {
    const iamRoleApiGatewayToStepFunctionsTemplate =
      JSON.stringify(this.serverless.utils.readFileSync(
      path.join(__dirname,
        'apigateway-to-stepfunctions-assume-role.json'))
    );

    const getApiToStepFunctionsIamRoleLogicalId = this.getApiToStepFunctionsIamRoleLogicalId();
    const newIamRoleStateMachineExecutionObject = {
      [getApiToStepFunctionsIamRoleLogicalId]: JSON.parse(iamRoleApiGatewayToStepFunctionsTemplate),
    };

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newIamRoleStateMachineExecutionObject);
    return BbPromise.resolve();
  },
};
