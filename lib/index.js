'use strict';
const stateMachine = require('./stateMachine');
const iam = require('./iam');
const dataProcessing = require('./dataProcessing');
const utils = require('./utils');
const BbPromise = require('bluebird');
const _ = require('lodash');
const chalk = require('chalk');

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
      stateMachine,
      iam,
      dataProcessing,
      utils
    );
    this.assumeRolePolicyDocument =
      this.assumeRolePolicyDocument.replace('[region]', this.region);
    this.commands = {
      deploy: {
        commands: {
          stepf: {
            usage: 'Deploy the State Machine of Step functions',
            lifecycleEvents: [
              'deploy',
            ],
            options: {
              state: {
                usage: 'Name of the State Machine',
                shortcut: 't',
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
          tasks: {
            usage: 'Deploy the Tasks of Step functions',
            lifecycleEvents: [
              'deploy',
            ],
            options: {
              state: {
                usage: 'Name of the Tasks',
                shortcut: 't',
                required: true,
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
                shortcut: 't',
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
          tasks: {
            usage: 'Remove the Tasks of Step functions',
            lifecycleEvents: [
              'deploy',
            ],
            options: {
              state: {
                usage: 'Name of the Tasks',
                shortcut: 't',
                required: true,
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
      invoke: {
        commands: {
          stepf: {
            usage: 'Invoke Step functions',
            lifecycleEvents: [
              'invoke',
            ],
            options: {
              state: {
                usage: 'Name of the State Machine',
                shortcut: 't',
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
      'deploy:stepf:deploy': () => BbPromise.bind(this)
        .then(this.stateMachineDeploy),
      'remove:stepf:remove': () => BbPromise.bind(this)
        .then(this.stateMachineRemove),
      'invoke:stepf:invoke': () => BbPromise.bind(this)
        .then(this.stateMachineInvoke),
      'deploy:tasks:deploy': () => BbPromise.bind(this)
        .then(this.tasksDeploy),
      'remove:tasks:remove': () => BbPromise.bind(this)
        .then(this.tasksRemove),
    };
  }

  stateMachineDeploy() {
    if (this.options.state) {
      this.serverless.cli.log(`Start to deploy ${this.options.state} step function...`);
      return BbPromise.bind(this)
      .then(this.yamlParse)
      .then(this.getStateMachineArn)
      .then(this.getFunctionArns)
      .then(this.compile)
      .then(this.getIamRole)
      .then(this.deleteStateMachine)
      .then(this.createStateMachine)
      .then(() => {
        this.serverless.cli.consoleLog('');
        this.serverless.cli.log(`Finish to deploy ${this.options.state} step function`);
        let message = '';
        message += `${chalk.yellow.underline('Service Information')}\n`;
        message += `${chalk.yellow('service:')} ${this.service}\n`;
        message += `${chalk.yellow('stage:')} ${this.stage}\n`;
        message += `${chalk.yellow('region:')} ${this.region}\n\n`;
        message += `${chalk.yellow.underline('State Machine Information')}\n`;
        message += `${chalk.yellow(this.options.state)}${chalk.yellow(':')} `;
        message += `${this.stateMachineArns[this.options.state]}\n`;
        this.serverless.cli.consoleLog(message);
        return BbPromise.resolve();
      });
    }
    this.serverless.cli.log('Start to deploy all step functions...');
    return BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.getStateMachineNames)
    .then(this.getFunctionArns)
    .then(this.compileAll)
    .then(this.getIamRoles)
    .then(this.deleteStateMachines)
    .then(this.createStateMachines)
    .then(() => {
      this.serverless.cli.consoleLog('');
      this.serverless.cli.log('Finish to deploy all step functions');
      let message = '';
      message += `${chalk.yellow.underline('Service Information')}\n`;
      message += `${chalk.yellow('service:')} ${this.service}\n`;
      message += `${chalk.yellow('stage:')} ${this.stage}\n`;
      message += `${chalk.yellow('region:')} ${this.region}\n\n`;
      message += `${chalk.yellow.underline('State Machine Information')}\n`;
      _.forEach(this.stateMachineArns, (arn, name) => {
        message += `${chalk.yellow(name)}${chalk.yellow(':')} ${arn}\n`;
      });
      this.serverless.cli.consoleLog(message);
      return BbPromise.resolve();
    });
  }

  stateMachineRemove() {
    if (this.options.state) {
      return BbPromise.bind(this)
      .then(this.yamlParse)
      .then(this.deleteIamRole)
      .then(this.getStateMachineArn)
      .then(this.deleteStateMachine)
      .then(() => {
        this.serverless.cli.log(`Remove ${this.options.state}`);
        return BbPromise.resolve();
      });
    }
    return BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.deleteIamRoles)
    .then(this.getStateMachineNames)
    .then(this.deleteStateMachines)
    .then(() => {
      this.serverless.cli.log('Remove all state machine');
      let message = '';
      message += `${chalk.yellow.underline('Service Information')}\n`;
      message += `${chalk.yellow('service:')} ${this.service}\n`;
      message += `${chalk.yellow('stage:')} ${this.stage}\n`;
      message += `${chalk.yellow('region:')} ${this.region}\n\n`;
      message += `${chalk.yellow.underline('Deleted State Machine')}\n`;
      _.forEach(this.stateMachineArns, (arn, name) => {
        message += `${chalk.yellow(name)}${chalk.yellow(':')} ${arn}\n`;
      });
      this.serverless.cli.consoleLog(message);
      return BbPromise.resolve();
    });
  }

  stateMachineInvoke() {
    return BbPromise.bind(this)
    .then(this.parseInputdate)
    .then(this.getStateMachineArn)
    .then(this.startExecution)
    .then(this.describeExecution)
    .then((result) => {
      this.serverless.cli.consoleLog('');
      this.serverless.cli.consoleLog(chalk.yellow.underline('Execution Result'));
      this.serverless.cli.consoleLog('');
      this.serverless.cli.consoleLog(result);

      if (result.status === 'FAILED') {
        return this.getExecutionHistory()
        .then((error) => {
          this.serverless.cli.consoleLog('');
          this.serverless.cli.consoleLog(chalk.yellow.underline('Error Log'));
          this.serverless.cli.consoleLog('');
          this.serverless.cli.consoleLog(error.events[error.events.length - 1]
          .executionFailedEventDetails);
        });
      }
      return BbPromise.resolve();
    });
  }
}
module.exports = ServerlessStepFunctions;
