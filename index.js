'use strict';
const BbPromise = require('bluebird');
const deploy = require('./lib/deploy');
const remove = require('./lib/remove');
const invoke = require('./lib/invoke');

class ServerlessStepFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');

    Object.assign(
      this,
      deploy,
      remove,
      invoke
    );

    this.commands = {
      deploy: {
        commands: {
          stepf: {
            usage: 'Deploy Step functions',
            lifecycleEvents: [
              'deploy',
            ],
            options: {
              state: {
                usage: 'Name of the State Machine',
                shortcut: 's',
                required: true,
              },
            },
          },
        },
      },
      remove: {
        commands: {
          stepf: {
            usage: 'Remove Step functions',
            lifecycleEvents: [
              'remove',
            ],
            options: {
              state: {
                usage: 'Name of the State Machine',
                shortcut: 's',
                required: true,
              },
            },
          },
        },
      },
      invoke: {
        commands: {
          stepf: {
            usage: 'Remove Step functions',
            lifecycleEvents: [
              'invoke',
            ],
            options: {
              state: {
                usage: 'Name of the State Machine',
                shortcut: 's',
                required: true,
              },
              data: {
                usage: 'String data to be passed as an event to your step function',
                shortcut: 'd',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'deploy:stepf:deploy': () => BbPromise.bind(this)
        .then(this.deploy),
      'remove:stepf:remove': () => BbPromise.bind(this)
        .then(this.remove),
      'invoke:stepf:invoke': () => BbPromise.bind(this)
        .then(this.invoke),
    };
  }
}
module.exports = ServerlessStepFunctions;
