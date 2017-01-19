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
    this.awsStateLanguage = {};
    this.functionArns = {};
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
    this.serverless.cli.log(`Start to deploy ${this.options.state} step function...`);
    return BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.getStateMachineArn)
    .then(this.getFunctionArns)
    .then(this.compile)
    .then(this.getIamRole)
    .then(this.deleteStateMachine)
    .then(this.createStateMachine);
  }

  stateMachineRemove() {
    return BbPromise.bind(this)
    .then(this.deleteIamRole)
    .then(this.getStateMachineArn)
    .then(this.deleteStateMachine)
    .then(() => {
      this.serverless.cli.log(`Remove ${this.options.state}`);
      return BbPromise.resolve();
    });
  }

  stateMachineInvoke() {
    return BbPromise.bind(this)
    .then(this.parseInputdate)
    .then(this.getStateMachineArn)
    .then(this.startExecution)
    .then(this.describeExecution);
  }

  tasksDeploy() {
    // todo
  }

  tasksRemove() {
    // todo
  }

  getIamRoleName() {
    let name = `${this.service}-${this.region}-${this.stage}-${this.options.state}-`;
    name += 'ssf-exerole';
    return name.substr(0, 64);
  }

  getIamPolicyName() {
    let name = `${this.service}-${this.region}-${this.stage}-${this.options.state}-`;
    name += 'ssf-exepolicy';
    return name.substr(0, 64);
  }

  getStateMachineName() {
    return `${this.service}-${this.stage}-${this.options.state}`;
  }

  getIamRole() {
    return this.provider.request('IAM',
      'getRole',
      {
        RoleName: this.getIamRoleName(),
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.iamRoleArn = result.Role.Arn;
      return BbPromise.resolve();
    }).catch((error) => {
      if (error.statusCode === 404) {
        return this.createIamRole();
      }
      throw new this.serverless.classes.Error(error.message);
    });
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

  createIamRole() {
    return this.provider.request('IAM',
      'createRole',
      {
        AssumeRolePolicyDocument: this.assumeRolePolicyDocument,
        RoleName: this.getIamRoleName(),
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.iamRoleArn = result.Role.Arn;
      return this.provider.request('IAM',
        'createPolicy',
        {
          PolicyDocument: this.iamPolicyStatement,
          PolicyName: this.getIamPolicyName(),
        },
        this.options.stage,
        this.options.region);
    })
    .then((result) => this.provider.request('IAM',
      'attachRolePolicy',
      {
        PolicyArn: result.Policy.Arn,
        RoleName: this.getIamRoleName(),
      },
      this.options.stage,
      this.options.region)
    )
    .then(() => BbPromise.resolve());
  }

  deleteIamRole() {
    let policyArn;
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      policyArn = `arn:aws:iam::${result.Account}:policy/${this.getIamPolicyName()}`;

      return this.provider.request('IAM',
        'detachRolePolicy',
        {
          PolicyArn: policyArn,
          RoleName: this.getIamRoleName(),
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
        RoleName: this.getIamRoleName(),
      },
      this.options.stage,
      this.options.region)
    )
    .then(() => BbPromise.resolve());
  }

  getStateMachineArn() {
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.stateMachineArn =
      `arn:aws:states:${this.region}:${result.Account}:stateMachine:${this.getStateMachineName()}`;
      return BbPromise.resolve();
    });
  }

  deleteStateMachine() {
    return this.provider.request('StepFunctions',
      'deleteStateMachine',
      {
        stateMachineArn: this.stateMachineArn,
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve());
  }

  createStateMachine() {
    return this.provider.request('StepFunctions',
      'createStateMachine',
      {
        definition: this.awsStateLanguage[this.options.state],
        name: this.getStateMachineName(),
        roleArn: this.iamRoleArn,
      },
      this.options.stage,
      this.options.region)
    .then(() => {
      this.serverless.cli.consoleLog('');
      this.serverless.cli.log(`Finish to deploy ${this.getStateMachineName()} step function`);
      return BbPromise.resolve();
    }).catch((error) => {
      if (error.message.match(/State Machine is being deleted/)) {
        this.serverless.cli.printDot();
        setTimeout(this.createStateMachine.bind(this), 5000);
      } else {
        throw new this.serverless.classes.Error(error.message);
      }
    });
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
    this.serverless.cli.log(`Start function ${this.options.state}...`);
    return this.provider.request('StepFunctions',
      'startExecution',
      {
        stateMachineArn: this.stateMachineArn,
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
        setTimeout(this.describeExecution.bind(this), 5000);
      } else {
        this.serverless.cli.consoleLog('');
        this.serverless.cli.consoleLog('');
        const msg = 'Execution Result -----------------------------------------';
        this.serverless.cli.consoleLog(chalk.yellow(msg));
        this.serverless.cli.consoleLog('');
        this.serverless.cli.consoleLog(result);

        if (result.status === 'FAILED') {
          return this.getExecutionHistory();
        }
      }
      return BbPromise.resolve();
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
    .then((result) => {
      this.serverless.cli.consoleLog('');
      const msg = 'Error Log ------------------------------------------------';
      this.serverless.cli.consoleLog(chalk.yellow(msg));
      this.serverless.cli.consoleLog('');
      this.serverless.cli.consoleLog(result.events[result.events.length - 1]
      .executionFailedEventDetails);
      return BbPromise.resolve();
    });
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

    this.awsStateLanguage[this.options.state] =
      JSON.stringify(this.serverless.service.stepFunctions[this.options.state]);

    _.forEach(this.functionArns, (value, key) => {
      const regExp = new RegExp(`"Resource":"${key}"`, 'g');
      this.awsStateLanguage[this.options.state] =
        this.awsStateLanguage[this.options.state].replace(regExp, `"Resource":"${value}"`);
    });
    return BbPromise.resolve();
  }
}
module.exports = ServerlessStepFunctions;
