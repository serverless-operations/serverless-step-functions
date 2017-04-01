'use strict';
const stateMachine = require('./stateMachine');
const activity = require('./activity');
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
      activity,
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
            usage: 'Deploy the State Machine Step functions',
            lifecycleEvents: [
              'deploy',
            ],
            options: {
              stage: {
                usage: 'Stage of the service',
                shortcut: 's',
              },
              region: {
                usage: 'Region of the service',
                shortcut: 'r',
              },
            },
            commands: {
              activities: {
                usage: 'Deploy Step function Tasks',
                lifecycleEvents: [
                  'deploy',
                ],
                options: {
                  name: {
                    usage: 'Name of the Task',
                    shortcut: 'n',
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
              statemachines: {
                usage: 'Deploy Step function StateMachines',
                lifecycleEvents: [
                  'deploy',
                ],
                options: {
                  name: {
                    usage: 'Name of StateMachine',
                    shortcut: 'n',
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
              stage: {
                usage: 'Stage of the service',
                shortcut: 's',
              },
              region: {
                usage: 'Region of the service',
                shortcut: 'r',
              },
            },
            commands: {
              activities: {
                usage: 'Remove Step function Tasks',
                lifecycleEvents: [
                  'remove',
                ],
                options: {
                  name: {
                    usage: 'Name of the Task',
                    shortcut: 'n',
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
              statemachines: {
                usage: 'Remove Step function StateMachines',
                lifecycleEvents: [
                  'remove',
                ],
                options: {
                  name: {
                    usage: 'Name of StateMachine',
                    shortcut: 'n',
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
              name: {
                usage: 'Name of the State Machine',
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
      'deploy:stepf:deploy': () => BbPromise.bind(this)
        .then(this.allDeploy),
      'remove:stepf:remove': () => BbPromise.bind(this)
        .then(this.allRemove),
      'deploy:stepf:statemachines:deploy': () => BbPromise.bind(this)
        .then(this.stateMachineDeploy),
      'remove:stepf:statemachines:remove': () => BbPromise.bind(this)
        .then(this.stateMachineRemove),
      'invoke:stepf:invoke': () => BbPromise.bind(this)
        .then(this.stateMachineInvoke),
      'deploy:stepf:activities:deploy': () => BbPromise.bind(this)
        .then(this.activityDeploy),
      'remove:stepf:activities:remove': () => BbPromise.bind(this)
        .then(this.activityRemove),
    };
  }

  allDeploy() {
    this.serverless.cli.log('Start to deploy for all stateMachies and activities...');
    return BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.getActivityArns)
    .then(this.describeActivities)
    .then(this.createActivities)
    .then(this.getStateMachineNames)
    .then(this.getFunctionArns)
    .then(this.compileAll)
    .then(this.getIamRoles)
    .then(this.deleteStateMachines)
    .then(this.createStateMachines)
    .then(() => {
      this.serverless.cli.consoleLog('');
      this.serverless.cli.log('Deployed all stateMachies and activities\n');
      let message = '';
      message += `${chalk.yellow.underline('Service Information')}\n`;
      message += `${chalk.yellow('service:')} ${this.service}\n`;
      message += `${chalk.yellow('stage:')} ${this.stage}\n`;
      message += `${chalk.yellow('region:')} ${this.region}\n\n`;
      message += `${chalk.yellow.underline('State Machine Information')}\n`;
      _.forEach(this.stateMachineArns, (arn, name) => {
        message += `${chalk.yellow(name)}${chalk.yellow(':')} ${arn}\n`;
      });
      message += '\n';
      message += `${chalk.yellow.underline('Deployed Activity ARNs')}\n`;
      _.forEach(this.activityArns, (value, key) => {
        message += `${chalk.yellow(key)}${chalk.yellow(':')} `;
        message += `${value}\n`;
      });
      this.serverless.cli.consoleLog(message);
      return BbPromise.resolve();
    });
  }

  allRemove() {
    this.serverless.cli.log('Start to remove for all statemachies and activities...');
    return BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.deleteIamRoles)
    .then(this.getStateMachineNames)
    .then(this.deleteStateMachines)
    .then(this.getActivityArns)
    .then(this.describeActivities)
    .then(this.deleteActivities)
    .then(() => {
      this.serverless.cli.log('Removed for all statemachies and activities...');
    });
  }

  activityDeploy() {
    if (this.options.name) {
      this.serverless.cli.log(`Start to deploy ${this.options.name} activity...`);
      return BbPromise.bind(this)
      .then(this.yamlParse)
      .then(this.checkActivitySetting)
      .then(this.getActivityArn)
      .then(this.describeActivity)
      .then(() => {
        if (this.deployedActivities[this.options.name] === 'notDeployed') {
          return BbPromise.bind(this)
          .then(this.createActivity)
          .then(() => {
            this.serverless.cli.log('Finished to deploy');
            let message = '';
            message += `${chalk.yellow.underline('Service Information')}\n`;
            message += `${chalk.yellow('service:')} ${this.service}\n`;
            message += `${chalk.yellow('stage:')} ${this.stage}\n`;
            message += `${chalk.yellow('region:')} ${this.region}\n\n`;
            message += `${chalk.yellow.underline('Deployed Activity ARN')}\n`;
            message += `${chalk.yellow(this.options.name)}${chalk.yellow(':')} `;
            message += `${this.activityArns[this.options.name]}\n`;
            this.serverless.cli.consoleLog(message);
            return BbPromise.resolve();
          });
        }
        this.serverless.cli.log(`${this.options.name} activity have already deployed`);
        return BbPromise.resolve();
      });
    }
    this.serverless.cli.log('Start to deploy all activities...');
    return BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.checkActivitySettings)
    .then(this.getActivityArns)
    .then(this.describeActivities)
    .then(this.createActivities)
    .then(() => {
      this.serverless.cli.log('Finish to deploy');
      let message = '';
      message += `${chalk.yellow.underline('Service Information')}\n`;
      message += `${chalk.yellow('service:')} ${this.service}\n`;
      message += `${chalk.yellow('stage:')} ${this.stage}\n`;
      message += `${chalk.yellow('region:')} ${this.region}\n\n`;
      message += `${chalk.yellow.underline('Deployed Activity ARNs')}\n`;
      _.forEach(this.activityArns, (value, key) => {
        message += `${chalk.yellow(key)}${chalk.yellow(':')} `;
        message += `${value}\n`;
      });

      this.serverless.cli.consoleLog(message);
      return BbPromise.resolve();
    });
  }

  activityRemove() {
    if (this.options.name) {
      this.serverless.cli.log(`Start to remove ${this.options.name} activity...`);
      return BbPromise.bind(this)
      .then(this.yamlParse)
      .then(this.checkActivitySetting)
      .then(this.getActivityArn)
      .then(this.describeActivity)
      .then(() => {
        if (this.deployedActivities[this.options.name] === 'deployed') {
          return BbPromise.bind(this)
          .then(this.deleteActivity)
          .then(() => {
            this.serverless.cli.log('Finished to remove');
          });
        }
        this.serverless.cli.log(`${this.options.name} activity is not deployed`);
        return BbPromise.resolve();
      });
    }
    this.serverless.cli.log('Start to remove all activities...');
    return BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.checkActivitySettings)
    .then(this.getActivityArns)
    .then(this.describeActivities)
    .then(this.deleteActivities)
    .then(() => {
      this.serverless.cli.log('Removed all activities');
      return BbPromise.resolve();
    });
  }

  stateMachineDeploy() {
    if (this.options.name) {
      this.serverless.cli.log(`Start to deploy ${this.options.name} step function...`);
      return BbPromise.bind(this)
      .then(this.yamlParse)
      .then(this.getStateMachineArn)
      .then(this.getFunctionArns)
      .then(this.getActivityArns)
      .then(this.compile)
      .then(this.getIamRole)
      .then(this.deleteStateMachine)
      .then(this.createStateMachine)
      .then(() => {
        this.serverless.cli.consoleLog('');
        this.serverless.cli.log(`Finish deployment of the ${this.options.name} step function`);
        let message = '';
        message += `${chalk.yellow.underline('Service Information')}\n`;
        message += `${chalk.yellow('service:')} ${this.service}\n`;
        message += `${chalk.yellow('stage:')} ${this.stage}\n`;
        message += `${chalk.yellow('region:')} ${this.region}\n\n`;
        message += `${chalk.yellow.underline('State Machine Information')}\n`;
        message += `${chalk.yellow(this.options.name)}${chalk.yellow(':')} `;
        message += `${this.stateMachineArns[this.options.name]}\n`;
        this.serverless.cli.consoleLog(message);
        return BbPromise.resolve();
      });
    }
    this.serverless.cli.log('Start deployment of all Step function StateMachines...');
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
      this.serverless.cli.log('Finished to deploy all stateMachines');
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
    if (this.options.name) {
      return BbPromise.bind(this)
      .then(this.yamlParse)
      .then(this.deleteIamRole)
      .then(this.getStateMachineArn)
      .then(this.deleteStateMachine)
      .then(() => {
        this.serverless.cli.log(`Remove ${this.options.name}`);
        return BbPromise.resolve();
      });
    }
    return BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.deleteIamRoles)
    .then(this.getStateMachineNames)
    .then(this.deleteStateMachines)
    .then(() => {
      this.serverless.cli.log('Removed all stateMachines');
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
          process.exitCode = 1;
        });
      }
      return BbPromise.resolve();
    });
  }
}
module.exports = ServerlessStepFunctions;
