'use strict';

module.exports = {
  getStateMachineLogicalId(stateMachineName, stateMachine) {
    const custom = stateMachine ? stateMachine.id || stateMachine.name : null;

    if (custom) {
      return `${this.provider.naming.getNormalizedFunctionName(custom)}`;
    }

    return `${this.provider.naming
      .getNormalizedFunctionName(stateMachineName)}StepFunctionsStateMachine`;
  },

  getStateMachineOutputLogicalId(stateMachineName, stateMachine) {
    const custom = stateMachine ? stateMachine.id || stateMachine.name : null;

    if (custom) {
      return `${this.provider.naming.getNormalizedFunctionName(custom)}Arn`;
    }

    return `${this.provider.naming
      .getNormalizedFunctionName(stateMachineName)}StepFunctionsStateMachineArn`;
  },

  getActivityLogicalId(activityName) {
    return `${this.provider.naming
      .getNormalizedFunctionName(activityName)}StepFunctionsActivity`;
  },

  getActivityOutputLogicalId(activityName) {
    return `${this.provider.naming
      .getNormalizedFunctionName(activityName)}StepFunctionsActivityArn`;
  },

  getStateMachinePolicyName() {
    return [
      this.provider.getStage(),
      this.provider.getRegion(),
      this.provider.serverless.service.service,
      'statemachine',
    ].join('-');
  },

  getRestApiLogicalId() {
    return 'ApiGatewayRestApiStepFunctions';
  },

  getApiGatewayName() {
    return `${this.provider.getStage()}-${this.provider.serverless.service.service}-stepfunctions`;
  },

  getApiToStepFunctionsIamRoleLogicalId() {
    return 'ApigatewayToStepFunctionsRole';
  },

  // Schedule
  getScheduleId(stateMachineName) {
    return `${stateMachineName}StepFunctionsSchedule`;
  },

  getScheduleLogicalId(stateMachineName, scheduleIndex) {
    return `${this.provider.naming
      .getNormalizedFunctionName(stateMachineName)}StepFunctionsEventsRuleSchedule${scheduleIndex}`;
  },

  getScheduleToStepFunctionsIamRoleLogicalId(stateMachineName) {
    return `${this.provider.naming.getNormalizedFunctionName(
      stateMachineName,
    )}ScheduleToStepFunctionsRole`;
  },

  getSchedulePolicyName(stateMachineName) {
    return [
      this.provider.getStage(),
      this.provider.getRegion(),
      this.provider.serverless.service.service,
      stateMachineName,
      'schedule',
    ].join('-');
  },

  // CloudWatch Event
  getCloudWatchEventId(stateMachineName) {
    return `${stateMachineName}CloudWatchEvent`;
  },

  getCloudWatchEventLogicalId(stateMachineName, cloudWatchIndex) {
    return `${this.provider.naming
      .getNormalizedFunctionName(stateMachineName)}EventsRuleCloudWatchEvent${cloudWatchIndex}`;
  },

  getCloudWatchEventPolicyName(stateMachineName) {
    return [
      this.provider.getStage(),
      this.provider.getRegion(),
      this.provider.serverless.service.service,
      stateMachineName,
      'event',
    ].join('-');
  },

  getCloudWatchEventToStepFunctionsIamRoleLogicalId(stateMachineName) {
    return `${this.provider.naming.getNormalizedFunctionName(
      stateMachineName,
    )}EventToStepFunctionsRole`;
  },
};
