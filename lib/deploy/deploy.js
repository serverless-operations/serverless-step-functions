'use strict';

// const BbPromise = require('bluebird');
// const _ = require('lodash');

module.exports = {
  /*
   * Will get stack resources and create object and append in obj
   * with key as ARN Name and value as ARN Value
  */
  getLambdaStackResource() {
    // TO - DO
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
