'use strict';

const BbPromise = require('bluebird');
const compileStateMachines = require('./deploy/stepFunctions/compileStateMachines');
const compileIamRole = require('./deploy/stepFunctions/compileIamRole');
const yamlParser = require('./yamlParser');
const naming = require('./naming');

class ServerlessStepFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('aws');
    this.service = this.serverless.service.service;
    this.region = this.provider.getRegion();
    this.stage = this.provider.getStage();

    Object.assign(
      this,
      compileStateMachines,
      compileIamRole,
      yamlParser,
      naming
    );

    this.commands = {
      invoke: {
        commands: {
          stepf: {
            usage: 'Invoke Step functions',
            lifecycleEvents: [
              'invoke',
            ],
            options: {
              name: {
                usage: 'State Machine name',
                shortcut: 'n',
                required: true,
              },
              data: {
                usage: 'String data to be passed as an event to your step function',
                shortcut: 'd',
              },
              path: {
                usage:
                'The path to a json file with input data to be passed to the invoked step function',
                shortcut: 'p',
              },
              stage: {
                usage: 'Stage of the service',
                shortcut: 's',
              },
              region: {
                usage: 'Region of the service',
                shortcut: 'r',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'invoke:stepf:invoke': () => BbPromise.bind(this)
        .then(this.invoke),
      'before:deploy:initialize': () => BbPromise.bind(this)
          .then(this.yamlParse),
      'after:deploy:compileFunctions': () => BbPromise.bind(this)
        .then(this.compileIamRole)
        .then(this.compileStateMachines),
    };
  }

  invoke() {

  }
}
module.exports = ServerlessStepFunctions;
