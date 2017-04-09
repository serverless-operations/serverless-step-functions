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
    return Object.keys(this.serverless.service.stepFunctions.stateMachines);
  },

  getStateMachine(stateMachineName) {
    if (stateMachineName in this.serverless.service.stepFunctions.stateMachines) {
      return this.serverless.service.stepFunctions.stateMachines[stateMachineName];
    }
    throw new this.serverless.classes
      .Error(`stepFunction "${stateMachineName}" doesn't exist in this Service`);
  },

  isStateMachines() {
    if (this.serverless.service.stepFunctions
      && this.serverless.service.stepFunctions.stateMachines) {
      return true;
    }
    return false;
  },
};
