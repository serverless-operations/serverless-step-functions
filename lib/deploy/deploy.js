'use strict';

const BbPromise = require('bluebird');

module.exports = {
  /*
   * Will get stack resources and create object and append in obj
   * with key as ARN Name and value as ARN Value
  */
  getLambdaStackResource() {
    const resources = [];
    const stackName = this.provider.naming.getStackName(this.options.stage);
    return this.provider.request('CloudFormation', 'describeStacks', { StackName: stackName }, this.options.stage, this.options.region).then((result) => {
      if (result) {
        result.Stacks[0].Outputs.forEach((output) => {
          let outputValue = output.OutputValue;
          outputValue = output.OutputKey.includes('Lambda') ? outputValue.substring(0, outputValue.lastIndexOf(':')) : outputValue;
          resources.push({ [output.OutputKey]: outputValue });
        });
        this.deployStateMachine = {};
        this.deployStateMachine.getLambdaStackResource = resources;
      }
      return BbPromise.resolve();
    });
  },
  replaceAllStatesARNInDefinition(definition, value) {
    function iterateStates(obj) {
      const data = {};
      data.States = {};
      for (const key in obj) {
        if (key === 'States') {
          const subStates = obj[key];
          // eslint-disable-next-line guard-for-in
          for (const stateKey in subStates) {
            const state = subStates[stateKey];
            if (state.Type && state.Type === 'Task') {
              if (state.Resource && (typeof state.Resource === 'object') && 'Fn::GetAtt' in state.Resource) {
                const lambdaQualifiedARN = value.getLambdaQualifiedArn(state.Resource['Fn::GetAtt'][0]);
                // eslint-disable-next-line array-callback-return, consistent-return, max-len
                const lambdaQualifiedARNObject = value.deployStateMachine.getLambdaStackResource.find((ob) => {
                  if (lambdaQualifiedARN in ob) {
                    return ob;
                  }
                });
                if (lambdaQualifiedARNObject) {
                  state.Resource = lambdaQualifiedARNObject[lambdaQualifiedARN];
                } else {
                  throw new Error('Lambda does not exist in state machine');
                }
              }
              data.States[stateKey] = state;
            } else {
              data.States[stateKey] = state;
              iterateStates(state);
            }
          }
        } else if (typeof obj[key] === 'object') {
          iterateStates(obj[key]);
        } else if (typeof obj[key] === 'string') {
          data[key] = obj[key];
        }
      }
      return data;
    }
    return iterateStates(definition);
  },
  /*
   * Will create a definition string for state-machine
   * that needs to be updated along with
   *  => It should replace resource string that we fetched from
   *     last life cycle events step.
   * 'Fn:Get'
  */
  createDefinitionString() {
    const stateMachineObj = this.getStateMachine(this.options.name).definition;
    // eslint-disable-next-line max-len
    this.deployStateMachine.definitionObject = this.replaceAllStatesARNInDefinition(stateMachineObj, this);
  },
  /*
   * Will get call StateMachine.updateStateMachine
   * and will pass ARN and definition string as params.
   * 'Fn:Get'
  */
  callUpdateFunction() {
    // eslint-disable-next-line array-callback-return, consistent-return
    const stateMachineArnObject = this.deployStateMachine.getLambdaStackResource.find((obj) => {
      if (`${this.options.name}Arn` in obj) {
        return obj;
      }
    });
    const definition = JSON.stringify(this.deployStateMachine.definitionObject);
    if (stateMachineArnObject) {
      const stateMachineArn = stateMachineArnObject[`${this.options.name}Arn`];
      return this.provider.request('StepFunctions', 'updateStateMachine', { stateMachineArn, definition }, this.options.stage, this.options.region).then((result) => {
        if (result) {
          BbPromise.resolve('Step-Function deployed');
        }
      });
    }
    throw new Error('Step function does not exist in cloud formation');
  },
};
