'use strict';
const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {
  stateMachineArns: {},
  getStateMachineName(state) {
    return `${this.service}-${this.stage}-${state}`;
  },

  getStateMachineArn(state) {
    const stateMachine = state || this.options.name;
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.stateMachineArns[stateMachine] =
      `arn:aws:states:${this.region}:${result.Account}:`;
      this.stateMachineArns[stateMachine] +=
      `stateMachine:${this.getStateMachineName(stateMachine)}`;
      return BbPromise.resolve();
    });
  },

  getStateMachineNames() {
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      _.forEach(this.serverless.service.stepFunctions, (value, key) => {
        this.stateMachineArns[key] =
          `arn:aws:states:${this.region}:${result.Account}:`;
        this.stateMachineArns[key] +=
          `stateMachine:${this.getStateMachineName(key)}`;
      });
      return BbPromise.resolve();
    });
  },

  deleteStateMachine(state) {
    const stateMachine = state || this.options.name;
    return this.provider.request('StepFunctions',
      'deleteStateMachine',
      {
        stateMachineArn: this.stateMachineArns[stateMachine],
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve());
  },

  deleteStateMachines() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions, (value, key) => {
      promises.push(key);
    });

    return BbPromise
    .map(promises, (state) => this.deleteStateMachine(state))
    .then(() => BbPromise.resolve());
  },

  createStateMachine(state) {
    const stateMachine = state || this.options.name;
    return this.provider.request('StepFunctions',
      'createStateMachine',
      {
        definition: this.serverless.service.stepFunctions[stateMachine],
        name: this.getStateMachineName(stateMachine),
        roleArn: this.iamRoleArn[stateMachine],
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve())
    .catch((error) => {
      if (error.message.match(/State Machine is being deleted/)) {
        this.serverless.cli.printDot();
        return this.setTimeout()
        .then(() => this.createStateMachine(stateMachine));
      }

      throw new this.serverless.classes.Error(error.message);
    });
  },

  createStateMachines() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions, (value, key) => {
      promises.push(key);
    });

    return BbPromise
    .map(promises, (state) => this.createStateMachine(state))
    .then(() => BbPromise.resolve());
  },

  startExecution() {
    return this.provider.request('StepFunctions',
      'startExecution',
      {
        stateMachineArn: this.stateMachineArns[this.options.name],
        input: this.options.data,
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.executionArn = result.executionArn;
      return BbPromise.resolve();
    }).catch((error) => {
      throw new this.serverless.classes.Error(error.message);
    });
  },

  describeExecution() {
    return this.provider.request('StepFunctions',
      'describeExecution',
      {
        executionArn: this.executionArn,
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      if (result.status === 'RUNNING') {
        this.serverless.cli.printDot();
        return this.setTimeout()
        .then(() => this.describeExecution());
      }
      return BbPromise.resolve(result);
    });
  },

  getExecutionHistory() {
    return this.provider.request('StepFunctions',
      'getExecutionHistory',
      {
        executionArn: this.executionArn,
      },
      this.options.stage,
      this.options.region)
    .then((result) => BbPromise.resolve(result));
  },
};
