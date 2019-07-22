'use strict';

const BbPromise = require('bluebird');
const path = require('path');

module.exports = {
  getStateMachineArn() {
    const stateMachineOutputKey = this.getStateMachineOutputLogicalId(this.options.name,
      this.serverless.service.stepFunctions.stateMachines[this.options.name]);

    const stackName = this.provider.naming.getStackName(this.options.stage);

    return this.provider.request('CloudFormation',
      'describeStacks',
      { StackName: stackName },
      this.options.stage,
      this.options.region)
      .then((result) => {
        if (result) {
          result.Stacks[0].Outputs.forEach((output) => {
            if (output.OutputKey === stateMachineOutputKey) {
              this.stateMachineArn = output.OutputValue;
            }
          });

          if (!this.stateMachineArn) {
            const errorMessage = [
              `"${this.options.name}" stateMachine does not exists.`,
            ].join('');
            throw new this.serverless.classes.Error(errorMessage);
          }
        }

        return BbPromise.resolve();
      });
  },

  startExecution() {
    let inputData = '';

    if (this.options.data) {
      inputData = this.options.data;
    } else if (this.options.path) {
      const absolutePath = path.isAbsolute(this.options.path)
        ? this.options.path
        : path.join(this.serverless.config.servicePath, this.options.path);
      if (!this.serverless.utils.fileExistsSync(absolutePath)) {
        throw new this.serverless.classes.Error('The file you provided does not exist.');
      }
      inputData = JSON.stringify(this.serverless.utils.readFileSync(absolutePath));
    }

    const params = {
      stateMachineArn: this.stateMachineArn,
    };

    if (inputData) {
      params.input = inputData;
    }
    return this.provider.request('StepFunctions',
      'startExecution',
      params,
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
      .then(result => BbPromise.resolve(result));
  },

  setTimeout() {
    return new BbPromise((resolve) => {
      setTimeout(resolve, 5000);
    });
  },
};
