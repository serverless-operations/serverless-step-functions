'use strict';
const BbPromise = require('bluebird');
const path = require('path');
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
    this.functionArns = {};
    this.iamRoleArn = {};
    this.stateMachineArns = {};
    this.iamPolicyStatement = `{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "lambda:InvokeFunction"
          ],
          "Resource": "*"
        }
      ]
    }
    `;

    this.assumeRolePolicyDocument = `{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": "states.${this.region}.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }
   `;

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

  tasksDeploy() {
    // todo
  }

  tasksRemove() {
    // todo
  }

  getIamRoleName(state) {
    let name = `${this.service}-${this.region}-${this.stage}-${state}-`;
    name += 'ssf-exerole';
    return name.substr(0, 64);
  }

  getIamPolicyName(state) {
    let name = `${this.service}-${this.region}-${this.stage}-${state}-`;
    name += 'ssf-exepolicy';
    return name.substr(0, 64);
  }

  getStateMachineName(state) {
    return `${this.service}-${this.stage}-${state}`;
  }

  getIamRole(state) {
    const stateMachine = state || this.options.state;
    return this.provider.request('IAM',
      'getRole',
      {
        RoleName: this.getIamRoleName(stateMachine),
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.iamRoleArn[stateMachine] = result.Role.Arn;
      return BbPromise.resolve();
    }).catch((error) => {
      if (error.statusCode === 404) {
        return this.createIamRole(stateMachine);
      }
      throw new this.serverless.classes.Error(error.message);
    });
  }

  getIamRoles() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions, (value, key) => {
      promises.push(key);
    });

    return BbPromise.map(promises, (value) => this.getIamRole(value))
    .then(() => BbPromise.resolve());
  }

  getFunctionArns() {
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      _.forEach(this.serverless.service.functions, (value, key) => {
        this.functionArns[key]
        = `arn:aws:lambda:${this.region}:${result.Account}:function:${value.name}`;
      });
      return BbPromise.resolve();
    });
  }

  createIamRole(state) {
    const stateMachine = state || this.options.state;
    return this.provider.request('IAM',
      'createRole',
      {
        AssumeRolePolicyDocument: this.assumeRolePolicyDocument,
        RoleName: this.getIamRoleName(stateMachine),
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.iamRoleArn[stateMachine] = result.Role.Arn;
      return this.provider.request('IAM',
        'createPolicy',
        {
          PolicyDocument: this.iamPolicyStatement,
          PolicyName: this.getIamPolicyName(stateMachine),
        },
        this.options.stage,
        this.options.region);
    })
    .then((result) => this.provider.request('IAM',
      'attachRolePolicy',
      {
        PolicyArn: result.Policy.Arn,
        RoleName: this.getIamRoleName(stateMachine),
      },
      this.options.stage,
      this.options.region)
    )
    .then(() => BbPromise.resolve());
  }

  deleteIamRole(state) {
    const stateMachine = state || this.options.state;
    let policyArn;
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      policyArn = `arn:aws:iam::${result.Account}:policy/${this.getIamPolicyName(stateMachine)}`;

      return this.provider.request('IAM',
        'detachRolePolicy',
        {
          PolicyArn: policyArn,
          RoleName: this.getIamRoleName(stateMachine),
        },
        this.options.stage,
        this.options.region);
    })
    .then(() => this.provider.request('IAM',
      'deletePolicy',
      {
        PolicyArn: policyArn,
      },
      this.options.stage,
      this.options.region)
    )
    .then(() => this.provider.request('IAM',
      'deleteRole',
      {
        RoleName: this.getIamRoleName(stateMachine),
      },
      this.options.stage,
      this.options.region)
    )
    .then(() => BbPromise.resolve())
    .catch((error) => {
      if (error.statusCode === 404) {
        return BbPromise.resolve();
      }
      return BbPromise.reject(error.message);
    });
  }

  deleteIamRoles() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions, (value, key) => {
      promises.push(key);
    });

    return BbPromise.map(promises, (state) => this.deleteIamRole(state))
    .then(() => BbPromise.resolve())
    .catch((error) => {
      if (error.statusCode === 404) {
        return BbPromise.resolve();
      }
      return BbPromise.reject(error.message);
    });
  }

  getStateMachineArn(state) {
    const stateMachine = state || this.options.state;
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.stateMachineArns[stateMachine] =
      `arn:aws:states:${this.region}:${result.Account}:`;
      this.stateMachineArns[stateMachine] +=
      `stateMachine:${this.getStateMachineName(stateMachine)}`;
      return BbPromise.resolve();
    });
  }

  getStateMachineNames() {
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      _.forEach(this.serverless.service.stepFunctions, (value, key) => {
        this.stateMachineArns[key] =
          `arn:aws:states:${this.region}:${result.Account}:`;
        this.stateMachineArns[key] +=
          `stateMachine:${this.getStateMachineName(key)}`;
      });
      return BbPromise.resolve();
    });
  }

  deleteStateMachine(state) {
    const stateMachine = state || this.options.state;
    return this.provider.request('StepFunctions',
      'deleteStateMachine',
      {
        stateMachineArn: this.stateMachineArns[stateMachine],
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve());
  }

  deleteStateMachines() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions, (value, key) => {
      promises.push(key);
    });

    return BbPromise
    .map(promises, (state) => this.deleteStateMachine(state))
    .then(() => BbPromise.resolve());
  }

  createStateMachine(state) {
    const stateMachine = state || this.options.state;
    return this.provider.request('StepFunctions',
      'createStateMachine',
      {
        definition: this.serverless.service.stepFunctions[stateMachine],
        name: this.getStateMachineName(stateMachine),
        roleArn: this.iamRoleArn[stateMachine],
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve())
    .catch((error) => {
      if (error.message.match(/State Machine is being deleted/)) {
        this.serverless.cli.printDot();
        return this.setTimeout()
        .then(() => this.createStateMachine(stateMachine));
      }
      throw new this.serverless.classes.Error(error.message);
    });
  }

  setTimeout() {
    return new BbPromise((resolve) => {
      setTimeout(resolve, 5000);
    });
  }

  createStateMachines() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions, (value, key) => {
      promises.push(key);
    });

    return BbPromise
    .map(promises, (state) => this.createStateMachine(state))
    .then(() => BbPromise.resolve());
  }

  parseInputdate() {
    if (!this.options.data && this.options.path) {
      const absolutePath = path.isAbsolute(this.options.path) ?
        this.options.path :
        path.join(this.serverless.config.servicePath, this.options.path);
      if (!this.serverless.utils.fileExistsSync(absolutePath)) {
        throw new this.serverless.classes.Error('The file you provided does not exist.');
      }
      this.options.data = JSON.stringify(this.serverless.utils.readFileSync(absolutePath));
    }
    return BbPromise.resolve();
  }

  startExecution() {
    return this.provider.request('StepFunctions',
      'startExecution',
      {
        stateMachineArn: this.stateMachineArns[this.options.state],
        input: this.options.data,
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.executionArn = result.executionArn;
      return BbPromise.resolve();
    }).catch((error) => {
      throw new this.serverless.classes.Error(error.message);
    });
  }

  describeExecution() {
    return this.provider.request('StepFunctions',
      'describeExecution',
      {
        executionArn: this.executionArn,
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      if (result.status === 'RUNNING') {
        this.serverless.cli.printDot();
        return this.setTimeout()
        .then(() => this.describeExecution());
      }
      return BbPromise.resolve(result);
    });
  }

  getExecutionHistory() {
    return this.provider.request('StepFunctions',
      'getExecutionHistory',
      {
        executionArn: this.executionArn,
      },
      this.options.stage,
      this.options.region)
    .then((result) => BbPromise.resolve(result));
  }

  yamlParse() {
    const servicePath = this.serverless.config.servicePath;

    if (!servicePath) {
      return BbPromise.resolve();
    }

    const serverlessYmlPath = path.join(servicePath, 'serverless.yml');
    return this.serverless.yamlParser
      .parse(serverlessYmlPath)
      .then((serverlessFileParam) => {
        this.serverless.service.stepFunctions = serverlessFileParam.stepFunctions.stateMachine;
        this.serverless.variables.populateService(this.serverless.pluginManager.cliOptions);
        return BbPromise.resolve();
      });
  }

  compile() {
    if (!this.serverless.service.stepFunctions) {
      const errorMessage = [
        'stepFunctions statement does not exists in serverless.yml',
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    if (typeof this.serverless.service.stepFunctions[this.options.state] === 'undefined') {
      const errorMessage = [
        `Step function "${this.options.state}" is not exists`,
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    this.serverless.service.stepFunctions[this.options.state] =
      JSON.stringify(this.serverless.service.stepFunctions[this.options.state]);
    _.forEach(this.functionArns, (value, key) => {
      const regExp = new RegExp(`"Resource":"${key}"`, 'g');
      this.serverless.service.stepFunctions[this.options.state] =
        this.serverless.service.stepFunctions[this.options.state]
        .replace(regExp, `"Resource":"${value}"`);
    });
    return BbPromise.resolve();
  }

  compileAll() {
    if (!this.serverless.service.stepFunctions) {
      const errorMessage = [
        'stepFunctions statement does not exists in serverless.yml',
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    _.forEach(this.serverless.service.stepFunctions, (stepFunctionObj, stepFunctionKey) => {
      this.serverless.service.stepFunctions[stepFunctionKey] = JSON.stringify(stepFunctionObj);
    });

    _.forEach(this.functionArns, (functionObj, functionKey) => {
      const regExp = new RegExp(`"Resource":"${functionKey}"`, 'g');
      _.forEach(this.serverless.service.stepFunctions, (stepFunctionObj, stepFunctionKey) => {
        this.serverless.service.stepFunctions[stepFunctionKey] =
          this.serverless.service.stepFunctions[stepFunctionKey]
          .replace(regExp, `"Resource":"${functionObj}"`);
      });
    });
    return BbPromise.resolve();
  }
}
module.exports = ServerlessStepFunctions;
