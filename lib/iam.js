'use strict';
const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {
  iamRoleArn: {},
  iamPolicyStatement: `{
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
  `,
  assumeRolePolicyDocument: `{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "states.[region].amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  `,
  getIamRoleName(state) {
    let name = `${this.service}-${this.region}-${this.stage}-${state}-`;
    name += 'ssf-exerole';
    return name.substr(0, 64);
  },

  getIamPolicyName(state) {
    let name = `${this.service}-${this.region}-${this.stage}-${state}-`;
    name += 'ssf-exepolicy';
    return name.substr(0, 64);
  },

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
  },

  getIamRoles() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions, (value, key) => {
      promises.push(key);
    });

    return BbPromise.map(promises, (value) => this.getIamRole(value))
    .then(() => BbPromise.resolve());
  },

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
  },

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
  },

  deleteIamRoles() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions, (value, key) => {
      promises.push(key);
    });

    return BbPromise.map(promises, (state) => this.deleteIamRole(state))
    .then(() => BbPromise.resolve());
  },
};
