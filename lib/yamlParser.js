'use strict';
const BbPromise = require('bluebird');
const path = require('path');
const _ = require('lodash');

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

  parseInputdate() {
    if (!this.options.data && this.options.path) {
      const absolutePath = path.isAbsolute(this.options.path) ?
        this.options.path :
        path.join(this.serverless.config.servicePath, this.options.path);
      if (!this.serverless.utils.fileExistsSync(absolutePath)) {
        throw new this.serverless.classes.Error('The file you provided does not exist.');
      }
      this.options.data = JSON.stringify(this.serverless.utils.readFileSync(absolutePath));
    }
    return BbPromise.resolve();
  },

  getFunctionArns() {
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      _.forEach(this.serverless.service.functions, (value, key) => {
        this.functionArns[key]
        = `arn:aws:lambda:${this.region}:${result.Account}:function:${value.name}`;
      });
      return BbPromise.resolve();
    });
  },

  compile() {
    this.serverless.service.stepFunctions.stateMachines[this.options.name] =
      JSON.stringify(this.serverless.service.stepFunctions.stateMachines[this.options.name]);
    _.forEach(this.functionArns, (functionArn, functionName) => {
      const regExp = new RegExp(`"Resource":"${functionName}"`, 'g');
      this.serverless.service.stepFunctions.stateMachines[this.options.name] =
        this.serverless.service.stepFunctions.stateMachines[this.options.name]
        .replace(regExp, `"Resource":"${functionArn}"`);
    });

    _.forEach(this.activityArns, (activityArn, activityName) => {
      const regExp = new RegExp(`"Resource":"${activityName}"`, 'g');
      _.forEach(this.serverless.service.stepFunctions.stateMachines,
        (stepFunctionObj, stepFunctionKey) => {
          this.serverless.service.stepFunctions.stateMachines[stepFunctionKey] =
          this.serverless.service.stepFunctions.stateMachines[stepFunctionKey]
          .replace(regExp, `"Resource":"${activityArn}"`);
        });
    });
    return BbPromise.resolve();
  },

  compileAll() {
    _.forEach(this.serverless.service.stepFunctions.stateMachines,
      (stepFunctionObj, stepFunctionKey) => {
        this.serverless.service.stepFunctions.stateMachines[stepFunctionKey]
        = JSON.stringify(stepFunctionObj);
      });

    _.forEach(this.functionArns, (functionArn, functionName) => {
      const regExp = new RegExp(`"Resource":"${functionName}"`, 'g');
      _.forEach(this.serverless.service.stepFunctions.stateMachines,
        (stepFunctionObj, stepFunctionKey) => {
          this.serverless.service.stepFunctions.stateMachines[stepFunctionKey] =
          this.serverless.service.stepFunctions.stateMachines[stepFunctionKey]
          .replace(regExp, `"Resource":"${functionArn}"`);
        });
    });

    _.forEach(this.activityArns, (activityArn, activityName) => {
      const regExp = new RegExp(`"Resource":"${activityName}"`, 'g');
      _.forEach(this.serverless.service.stepFunctions.stateMachines,
        (stepFunctionObj, stepFunctionKey) => {
          this.serverless.service.stepFunctions.stateMachines[stepFunctionKey] =
          this.serverless.service.stepFunctions.stateMachines[stepFunctionKey]
          .replace(regExp, `"Resource":"${activityArn}"`);
        });
    });
    return BbPromise.resolve();
  },
};