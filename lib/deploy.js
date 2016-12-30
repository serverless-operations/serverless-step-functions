'use strict';
const BbPromise = require('bluebird');
const path = require('path');
const _ = require('lodash');

module.exports = {
  deploy() {
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
    BbPromise.bind(this)
    .then(this.yamlParse)
    .then(this.getStateMachineArn)
    .then(this.getFunctionArns)
    .then(this.compile)
    .then(this.getIamRole)
    .then(this.deleteStateMachine)
    .then(this.createStateMachine);

    return BbPromise.resolve();
  },

  getIamRole() {
    return this.provider.request('IAM',
      'getRole',
      {
        RoleName: 'StatesExecutionRole-us-east-1',
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
  },

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
  },

  createIamRole() {
    return this.provider.request('IAM',
      'createRole',
      {
        AssumeRolePolicyDocument: this.iamPolicyStatement,
        RoleName: this.iamRoleName,
      },
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.iamRoleArn = result.Role.Arn;
      return BbPromise.resolve();
    });
  },

  getStateMachineArn() {
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
  },

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
  },

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

    _.forEach(this.stepFunctions[this.options.statemachine].States, (value, key) => {
      if (value.Resource && !value.Resource.match(/arn:aws:lambda/)) {
        this.stepFunctions[this.options.statemachine].States[key].Resource
        = this.functionArns[value.Resource];
      }
    });

    this.awsStateLanguage[this.options.statemachine] =
      JSON.stringify(this.stepFunctions[this.options.statemachine]);
    return BbPromise.resolve();
  },

  deleteStateMachine() {
    return this.provider.request('StepFunctions',
      'deleteStateMachine',
      {
        stateMachineArn: this.stateMachineArn,
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve());
  },

  createStateMachine() {
    return this.provider.request('StepFunctions',
      'createStateMachine',
      {
        definition: this.awsStateLanguage[this.options.statemachine],
        name: this.options.statemachine,
        roleArn: this.iamRoleArn,
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve())
    .catch((error) => {
      if (error.message.match(/State Machine is being deleted/)) {
        setTimeout(this.createStateMachine.bind(this), 5000);
      }
    });
  },
};
