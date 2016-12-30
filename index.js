'use strict';
const BbPromise = require('bluebird');
const deploy = require('./lib/deploy');
const remove = require('./lib/remove');

class ServerlessStepFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');

    Object.assign(
      this,
      deploy,
      remove
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
              statemachine: {
                usage: 'Name of the State Machine',
                shortcut: 'sm',
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
              statemachine: {
                usage: 'Name of the State Machine',
                shortcut: 'sm',
                required: true,
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
    };
  }
}
module.exports = ServerlessStepFunctions;
