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
          = serverlessFileParam.stepFunctions.stateMachines;
        this.serverless.service.stepFunctions.activities
          = serverlessFileParam.stepFunctions.activities;
        this.serverless.variables.populateService(this.serverless.pluginManager.cliOptions);
        return BbPromise.resolve();
      });
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
    if (!this.serverless.service.stepFunctions.stateMachines) {
      const errorMessage = [
        'stepFunctions statement does not exists in serverless.yml',
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    if (typeof this.serverless.service.stepFunctions.stateMachines[this.options.name]
      === 'undefined') {
      const errorMessage = [
        `Step function "${this.options.name}" is not exists`,
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    this.serverless.service.stepFunctions.stateMachines[this.options.name] =
      JSON.stringify(this.serverless.service.stepFunctions.stateMachines[this.options.name]);
    _.forEach(this.functionArns, (value, key) => {
      const regExp = new RegExp(`"Resource":"${key}"`, 'g');
      this.serverless.service.stepFunctions.stateMachines[this.options.name] =
        this.serverless.service.stepFunctions.stateMachines[this.options.name]
        .replace(regExp, `"Resource":"${value}"`);
    });
    return BbPromise.resolve();
  },

  compileAll() {
    if (!this.serverless.service.stepFunctions.stateMachines) {
      const errorMessage = [
        'stepFunctions statement does not exists in serverless.yml',
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    _.forEach(this.serverless.service.stepFunctions.stateMachines,
      (stepFunctionObj, stepFunctionKey) => {
        this.serverless.service.stepFunctions.stateMachines[stepFunctionKey]
        = JSON.stringify(stepFunctionObj);
      });

    _.forEach(this.functionArns, (functionObj, functionKey) => {
      const regExp = new RegExp(`"Resource":"${functionKey}"`, 'g');
      _.forEach(this.serverless.service.stepFunctions.stateMachines,
        (stepFunctionObj, stepFunctionKey) => {
          this.serverless.service.stepFunctions.stateMachines[stepFunctionKey] =
          this.serverless.service.stepFunctions.stateMachines[stepFunctionKey]
          .replace(regExp, `"Resource":"${functionObj}"`);
        });
    });
    return BbPromise.resolve();
  },
};
