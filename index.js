'use strict';
const BbPromise = require('bluebird');
const deploy = require('./lib/deploy');

class ServerlessStepFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');

    Object.assign(
      this,
      deploy
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
    };

    this.hooks = {
      'deploy:stepf:deploy': () => BbPromise.bind(this)
        .then(this.deploy),
    };
  }
}
module.exports = ServerlessStepFunctions;
