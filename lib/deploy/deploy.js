'use strict';

const BbPromise = require('bluebird');

module.exports = {
  /*
   * Will get stack resources and create object and append in obj
   * with key as ARN Name and value as ARN Value. The main purpose
   * behind this function is get the lambda ARN associated with
   * each state of step functions
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
  /*
  * Recursion function to get the states related information and lambda
  * associated with it
  */
  iterateStates(obj, value) {
    const data = {};
    data.States = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'States') {
        for (const [stateKey, state] of Object.entries(val)) {
          if (state.Type && state.Type === 'Task') {
            if (state.Resource && (typeof state.Resource === 'object') && 'Fn::GetAtt' in state.Resource) {
              const lambdaQualifiedARN = value.getLambdaQualifiedArn(state.Resource['Fn::GetAtt'][0]);
              const lambdaQualifiedARNObject = value.deployStateMachine.getLambdaStackResource.find(
                // eslint-disable-next-line array-callback-return, consistent-return
                (ob) => {
                  if (lambdaQualifiedARN in ob) {
                    return ob;
                  }
                },
              );
              if (lambdaQualifiedARNObject) {
                state.Resource = lambdaQualifiedARNObject[lambdaQualifiedARN];
              } else {
                throw new Error('Lambda does not exist in state machine');
              }
            }
            data.States[stateKey] = state;
          } else {
            data.States[stateKey] = state;
            this.iterateStates(state, value);
          }
        }
      } else if (typeof obj[key] === 'object') {
        this.iterateStates(obj[key], value);
      } else if (typeof obj[key] === 'string') {
        data[key] = obj[key];
      }
    }
    return data;
  },
  replaceAllStatesARNInDefinition(definition, value) {
    return this.iterateStates(definition, value);
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
      // eslint-disable-next-line consistent-return
      return this.provider.request('StepFunctions', 'updateStateMachine', { stateMachineArn, definition }, this.options.stage, this.options.region).then((result) => {
        if (result) {
          return BbPromise.resolve('Step-Function deployed');
        }
      });
    }
    throw new Error('Step function does not exist in cloud formation');
  },
};
