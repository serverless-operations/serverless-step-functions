'use strict';
const BbPromise = require('bluebird');
const path = require('path');

class AwsStepFunctionsDeploy {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.awsStateLanguage = {};
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
      'deploy:stepf:deploy': this.action.bind(this),
    };
  }

  setStateMachineArn() {
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      const region = this.options.region || 'us-east-1';
      this.stateMachineArn =
      `arn:aws:states:${region}:${result.Account}:stateMachine:${this.options.statemachine}`;
      return BbPromise.resolve();
    });
  }

  action() {
    this.serverless.cli.consoleLog('Start Deploy Step Functions');
    BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.setStateMachineArn)
    .then(this.compile)
    .then(this.deleteStateMachine)
    .then(this.createStateMachine);
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

    if (typeof this.stepFunctions[this.options.statemachine] === 'undefined') {
      const errorMessage = [
        `Step function "${this.options.statemachine}" is not exists`,
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    // @todo get lambda arn from functionname
    this.awsStateLanguage[this.options.statemachine] =
      JSON.stringify(this.stepFunctions[this.options.statemachine]);
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
    return this.provider.request('StepFunctions',
      'createStateMachine',
      {
        definition: this.awsStateLanguage[this.options.statemachine],
        name: this.options.statemachine,
        roleArn: '',
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve())
    .catch((error) => {
      if (error.message.match(/State Machine is being deleted/)) {
        setTimeout(this.createStateMachine.bind(this), 5000);
      }
    });
  }

  deploy() {
    return BbPromise.bind(this)
    .then(this.deleteStateMachine)
    .then(this.createStateMachine);
  }

}
module.exports = AwsStepFunctionsDeploy;
