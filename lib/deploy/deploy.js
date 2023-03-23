'use strict';

const BbPromise = require('bluebird');
// const _ = require('lodash');

module.exports = {
  /*
   * Will get stack resources and create object and append in obj
   * with key as ARN Name and value as ARN Value
  */
  getLambdaStackResource() {
    const resources = [];
    const stackName = this.provider.naming.getStackName(this.options.stage);
    // eslint-disable-next-line max-len
    return this.provider.request('CloudFormation', 'describeStacks', { StackName: stackName }, this.options.stage, this.options.region).then((result) => {
      if (result) {
        // eslint-disable-next-line max-len
        result.Stacks[0].Outputs.forEach(output => resources.push({ [output.OutputKey]: output.OutputValue }));
      }
      return BbPromise.resolve();
    });
  },
  /*
   * Will get lambda resources from state-machine
   * that needs to be configured and replaced with
   * 'Fn:Get'
  */
  getResourceNeedsToBeConfigured() {
    // TO - DO
  },
  /*
   * Will create a definition string for state-machine
   * that needs to be updated along with
   *  => It should replace resource string that we fetched from
   *     last life cycle events step.
   * 'Fn:Get'
  */
  createDefinitionString() {
    // TO - DO
  },
  /*
   * Will get call StateMachine.updateStateMachine
   * and will pass ARN and definition string as params.
   * 'Fn:Get'
  */
  callUpdateFunction() {
    // TO - DO
  },
};
