'use strict';

module.exports = {
  getStateMachineLogicalId(stateMachineName) {
    return `${this.provider.naming
      .getNormalizedFunctionName(stateMachineName)}StepFunctionsStateMachine`;
  },

  getActivityLogicalId(activityName) {
    return `${this.provider.naming
      .getNormalizedFunctionName(activityName)}StepFunctionsActivity`;
  },

  getStateMachinePolicyName() {
    return [
      this.provider.getStage(),
      this.provider.getRegion(),
      this.provider.serverless.service.service,
      'statemachine',
    ].join('-');
  },

  getiamRoleStateMachineLogicalId() {
    return 'IamRoleStateMachineExecution';
  },

  getRestApiLogicalId() {
    return 'ApiGatewayRestApiStepFunctions';
  },

  getApiGatewayName() {
    return `${this.provider.getStage()}-${this.provider.serverless.service.service}-stepfunctions`;
  },
};
