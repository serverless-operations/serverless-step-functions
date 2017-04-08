'use strict';

module.exports = {
  getStateMachineLogicalId(stateMachineName) {
    return `${this.provider.naming
      .getNormalizedFunctionName(stateMachineName)}StepFunctionsStateMachine`;
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
};
