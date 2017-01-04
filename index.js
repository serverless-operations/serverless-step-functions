'use strict';
const BbPromise = require('bluebird');
const path = require('path');
const _ = require('lodash');

class ServerlessStepFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('aws');
    this.awsStateLanguage = {};
    this.functionArns = {};
    const region = this.options.region || 'us-east-1';
    this.iamRoleName = `serverless-step-functions-executerole-${region}`;
    this.iamPolicyName = `serverless-step-functions-executepolicy-${region}`;
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
            "Service": "states.${region}.amazonaws.com"
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
            usage: 'Deploy Step functions',
            lifecycleEvents: [
              'deploy',
            ],
            options: {
              state: {
                usage: 'Name of the State Machine',
                shortcut: 't',
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
                shortcut: 't',
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
                shortcut: 't',
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

  deploy() {
    this.serverless.cli.log(`Start to deploy ${this.options.state} step function...`);
    BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.getStateMachineArn)
    .then(this.getFunctionArns)
    .then(this.compile)
    .then(this.getIamRole)
    .then(this.deleteStateMachine)
    .then(this.createStateMachine);

    return BbPromise.resolve();
  }

  remove() {
    BbPromise.bind(this)
    .then(this.getStateMachineArn)
    .then(this.deleteStateMachine)
    .then(() => {
      this.serverless.cli.log(`Remove ${this.options.state}`);
      return BbPromise.resolve();
    });

    return BbPromise.resolve();
  }

  invoke() {
    BbPromise.bind(this)
    .then(this.getStateMachineArn)
    .then(this.startExecution)
    .then(this.describeExecution);

    return BbPromise.resolve();
  }

  getIamRole() {
    return this.provider.request('IAM',
      'getRole',
      {
        RoleName: this.iamRoleName,
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
      return BbPromise.reject();
    });
  }

  getFunctionArns() {
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      const region = this.options.region || 'us-east-1';
      _.forEach(this.serverless.service.functions, (value, key) => {
        this.functionArns[key]
        = `arn:aws:lambda:${region}:${result.Account}:function:${value.name}`;
      });
      return BbPromise.resolve();
    });
  }

  createIamRole() {
    return this.provider.request('IAM',
      'createRole',
      {
        AssumeRolePolicyDocument: this.assumeRolePolicyDocument,
        RoleName: this.iamRoleName,
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.iamRoleArn = result.Role.Arn;
      return this.provider.request('IAM',
        'createPolicy',
        {
          PolicyDocument: this.iamPolicyStatement,
          PolicyName: this.iamPolicyName,
        },
        this.options.stage,
        this.options.region);
    })
    .then((result) => this.provider.request('IAM',
      'attachRolePolicy',
      {
        PolicyArn: result.Policy.Arn,
        RoleName: this.iamRoleName,
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
      const region = this.options.region || 'us-east-1';
      const stage = this.options.stage || 'dev';
      this.stateMachineArn =
      `arn:aws:states:${region}:${result.Account}:stateMachine:${this.options.state}-${stage}`;
      return BbPromise.resolve();
    });
  }

  yamlParse() {
    const servicePath = this.serverless.config.servicePath;

    if (!servicePath) {
      return BbPromise.resolve();
    }

    let serverlessYmlPath = path.join(servicePath, 'serverless.yml');
    if (!this.serverless.utils.fileExistsSync(serverlessYmlPath)) {
      serverlessYmlPath = path
        .join(this.serverless.config.servicePath, 'serverless.yaml');
    }

    return this.serverless.yamlParser
      .parse(serverlessYmlPath)
      .then((serverlessFileParam) => {
        this.stepFunctions = serverlessFileParam.stepFunctions;
        return BbPromise.resolve();
      });
  }

  compile() {
    if (!this.stepFunctions) {
      return BbPromise.resolve();
    }

    if (typeof this.stepFunctions[this.options.state] === 'undefined') {
      const errorMessage = [
        `Step function "${this.options.state}" is not exists`,
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    _.forEach(this.stepFunctions[this.options.state].States, (value, key) => {
      if (value.Resource && !value.Resource.match(/arn:aws:lambda/)) {
        this.stepFunctions[this.options.state].States[key].Resource
        = this.functionArns[value.Resource];
      }
    });

    this.awsStateLanguage[this.options.state] =
      JSON.stringify(this.stepFunctions[this.options.state]);
    return BbPromise.resolve();
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
    const stage = this.options.stage || 'dev';
    return this.provider.request('StepFunctions',
      'createStateMachine',
      {
        definition: this.awsStateLanguage[this.options.state],
        name: `${this.options.state}-${stage}`,
        roleArn: this.iamRoleArn,
      },
      this.options.stage,
      this.options.region)
    .then(() => {
      this.serverless.cli.consoleLog('');
      this.serverless.cli.log(`Finish to deploy ${this.options.state}-${stage} step function`);
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
        this.serverless.cli.consoleLog(result);
      }
      return BbPromise.resolve();
    });
  }
}
module.exports = ServerlessStepFunctions;
