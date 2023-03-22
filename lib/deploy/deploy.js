'use strict';

// const BbPromise = require('bluebird');
// const _ = require('lodash');

module.exports = {
  async listStateMachine() {
    // const stackName = this.provider.naming.getStackName(this.options.stage);
    // eslint-disable-next-line max-len
    // return this.provider.request('CloudFormation', 'describeStacks', { StackName: stackName }, this.options.stage, this.options.region).then((result) => {
    //   if (result) {
    //     console.log(result.Stacks[0].Outputs);
    //   }
    //   return BbPromise.resolve();
    // });
    const stateMachineName = this.options.name;
    const stateMachineObj = this.getStateMachine(stateMachineName);
    console.log(stateMachineObj.definition);
    // const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName,
    //   stateMachineObj);
    // console.log(stateMachineLogicalId);
  },
};
