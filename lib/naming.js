'use strict';

module.exports = {
  generateLogicalId(name, suffix = '') {
    return `${this.provider.naming.getNormalizedFunctionName(name)}${suffix}`;
  },

  getStateMachineLogicalId(stateMachineName, stateMachine) {
    const custom = stateMachine ? stateMachine.id || stateMachine.name : null;
    if (custom) {
      return this.generateLogicalId(custom);
    }
    return this.generateLogicalId(stateMachineName, 'StepFunctionsStateMachine');
  },

  getStateMachineOutputLogicalId(stateMachineName, stateMachine) {
    const custom = stateMachine ? stateMachine.id || stateMachine.name : null;
    if (custom) {
      return this.generateLogicalId(custom, 'Arn');
    }
    return this.generateLogicalId(stateMachineName, 'StepFunctionsStateMachineArn');
  },

  getActivityLogicalId(activityName) {
    return this.generateLogicalId(activityName, 'StepFunctionsActivity');
  },

  getActivityOutputLogicalId(activityName) {
    return this.generateLogicalId(activityName, 'StepFunctionsActivityArn');
  },

  getStateMachinePolicyName() {
    return [
      this.provider.getStage(),
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
    return this.generateLogicalId(stateMachineName, `StepFunctionsEventsRuleSchedule${scheduleIndex}`);
  },

  getSchedulerScheduleLogicalId(stateMachineName, scheduleIndex) {
    return this.generateLogicalId(stateMachineName, `StepFunctionsSchedulerSchedule${scheduleIndex}`);
  },

  getScheduleToStepFunctionsIamRoleLogicalId(stateMachineName) {
    return this.generateLogicalId(stateMachineName, 'ScheduleToStepFunctionsRole');
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
    return this.generateLogicalId(stateMachineName, `EventsRuleCloudWatchEvent${cloudWatchIndex}`);
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
    return this.generateLogicalId(stateMachineName, 'EventToStepFunctionsRole');
  },
};
