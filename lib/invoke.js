'use strict';
const BbPromise = require('bluebird');

module.exports = {
  invoke() {
    BbPromise.bind(this)
    .then(this.getStateMachineArn)
    .then(this.startExecution)
    .then(this.describeExecution);

    return BbPromise.resolve();
  },
  
  startExecution() {
    return this.provider.request('StepFunctions',
      'startExecution',
      {
        stateMachineArn: this.stateMachineArn,
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.executionArn = result.executionArn
      return BbPromise.resolve();
    }).catch((error) => {
      console.log(error);
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
        setTimeout(this.describeExecution.bind(this), 5000);
      } else {
        
      }
      return BbPromise.resolve();
    }).catch((error) => {
      console.log(error);
    });
  }
};