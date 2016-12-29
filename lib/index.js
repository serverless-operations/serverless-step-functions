'use strict';
const BbPromise = require('bluebird');
const path = require('path');
const _ = require('lodash');

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
              'deploy'
            ],
            options: {
              statemachine: {
                usage: 'Name of the State Machine',
                shortcut: 'sm',
                required: true,
              }
            }
          }
        }
      }
    };

    this.hooks = {
      'deploy:stepf:deploy': this.action.bind(this),
    };
  }

  action() {
    this.serverless.cli.consoleLog('Start Deploy Step Functions');
    BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.compile)
    .then(this.deploy);
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
       throw new this.serverless.classes
       .Error(errorMessage);
    }

    //@todo get lambda arn from functionname
    this.awsStateLanguage[this.options.statemachine] = JSON.stringify(this.stepFunctions[this.options.statemachine]);
    return BbPromise.resolve();
  }

  deploy() {
    let stateMachineArn;

    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      const region = this.options.region || 'us-east-1';
      stateMachineArn = `arn:aws:states:${region}:${result.Account}:stateMachine:${this.options.statemachine}`;
    }).then((result) => {
      return this.provider.request('StepFunctions',
        'describeStateMachine',
        {
          stateMachineArn
        },
        this.options.stage,
        this.options.region);
    }).then((result) => {
    console.log(result)
      return this.provider.request('StepFunctions',
        'deleteStateMachine',
        {
          stateMachineArn
        },
        this.options.stage,
        this.options.region);

    }).then((result) => {
      return this.provider.request('StepFunctions',
        'createStateMachine',
        {
          definition: this.awsStateLanguage[this.options.statemachine],
          name: this.options.statemachine,
          roleArn: ''
        },
        this.options.stage,
        this.options.region)
    }).catch((error) => {
      console.log(error);
    });
  }

}
module.exports = AwsStepFunctionsDeploy;
