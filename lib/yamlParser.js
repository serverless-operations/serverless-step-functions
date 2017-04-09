'use strict';
const BbPromise = require('bluebird');
const path = require('path');

module.exports = {
  functionArns: {},
  yamlParse() {
    const servicePath = this.serverless.config.servicePath;
    if (!servicePath) {
      return BbPromise.resolve();
    }

    const serverlessYmlPath = path.join(servicePath, 'serverless.yml');
    return this.serverless.yamlParser
      .parse(serverlessYmlPath)
      .then((serverlessFileParam) => {
        this.serverless.service.stepFunctions = {};
        this.serverless.service.stepFunctions.stateMachines
          = serverlessFileParam.stepFunctions
          && serverlessFileParam.stepFunctions.stateMachines
          ? serverlessFileParam.stepFunctions.stateMachines : {};
        this.serverless.service.stepFunctions.activities
          = serverlessFileParam.stepFunctions
          && serverlessFileParam.stepFunctions.activities
          ? serverlessFileParam.stepFunctions.activities : {};
        this.serverless.variables.populateService(this.serverless.pluginManager.cliOptions);
        return BbPromise.resolve();
      });
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
    if (this.serverless.service.stepFunctions
      && this.serverless.service.stepFunctions.stateMachines) {
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
    if (this.serverless.service.stepFunctions
      && this.serverless.service.stepFunctions.activities) {
      return true;
    }
    return false;
  },
};
