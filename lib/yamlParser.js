'use strict';

const _ = require('lodash');

module.exports = {
  yamlParse() {
    const parsedObject = this.serverless.configurationInput;

    this.serverless.service.stepFunctions = {
      validate: parsedObject.stepFunctions ? parsedObject.stepFunctions.validate : false,
      noOutput: parsedObject.stepFunctions ? parsedObject.stepFunctions.noOutput : false,
    };
    this.serverless.service.stepFunctions.stateMachines = parsedObject.stepFunctions
      && parsedObject.stepFunctions.stateMachines
      ? parsedObject.stepFunctions.stateMachines : {};
    this.serverless.service.stepFunctions.activities = parsedObject.stepFunctions
      && parsedObject.stepFunctions.activities
      ? parsedObject.stepFunctions.activities : [];

    if (!this.serverless.pluginManager.cliOptions.stage) {
      this.serverless.pluginManager.cliOptions.stage = this.options.stage
      || (this.serverless.service.provider && this.serverless.service.provider.stage)
      || 'dev';
    }

    if (!this.serverless.pluginManager.cliOptions.region) {
      this.serverless.pluginManager.cliOptions.region = this.options.region
      || (this.serverless.service.provider && this.serverless.service.provider.region)
      || 'us-east-1';
    }
  },

  getAllStateMachines() {
    if (Object.prototype.toString.call(this.serverless.service.stepFunctions.stateMachines)
      !== '[object Object]') {
      const errorMessage = [
        'stateMachines property is not an object',
        ' Please check the README for more info.',
      ].join('');
      throw new this.serverless.classes
        .Error(errorMessage);
    }
    return Object.keys(this.serverless.service.stepFunctions.stateMachines);
  },

  getStateMachine(stateMachineName) {
    if (stateMachineName in this.serverless.service.stepFunctions.stateMachines) {
      return this.serverless.service.stepFunctions.stateMachines[stateMachineName];
    }
    throw new this.serverless.classes
      .Error(`stateMachine "${stateMachineName}" doesn't exist in this Service`);
  },

  isStateMachines() {
    if (this.serverless.service.stepFunctions != null
      && this.serverless.service.stepFunctions.stateMachines != null
      && !_.isEmpty(this.serverless.service.stepFunctions.stateMachines)) {
      return true;
    }
    return false;
  },

  getAllActivities() {
    if (!Array.isArray(this.serverless.service.stepFunctions.activities)) {
      const errorMessage = [
        'activities property is not an array',
        ' Please check the README for more info.',
      ].join('');
      throw new this.serverless.classes
        .Error(errorMessage);
    }
    return this.serverless.service.stepFunctions.activities;
  },

  getActivity(activityName) {
    if (this.serverless.service.stepFunctions.activities.indexOf(activityName) !== -1) {
      return activityName;
    }

    throw new this.serverless.classes
      .Error(`activity "${activityName}" doesn't exist in this Service`);
  },

  isActivities() {
    if (this.serverless.service.stepFunctions != null
      && this.serverless.service.stepFunctions.activities != null
      && !_.isEmpty(this.serverless.service.stepFunctions.activities)) {
      return true;
    }
    return false;
  },
};
