'use strict';
const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {
  activityArns: {},
  deployedActivities: {},
  getActivityName(name) {
    return `${this.service}-${this.stage}-${name}`;
  },
  createActivity(name) {
    const activity = name || this.options.name;
    return this.provider.request('StepFunctions',
      'createActivity',
      { name: this.getActivityName(activity) },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve());
  },

  createActivities() {
    const promises = [];
    _.forEach(this.deployedActivities, (value, key) => {
      if (value === 'notDeployed') {
        promises.push(key);
      }
    });
    return BbPromise
    .map(promises, (name) => this.createActivity(name))
    .then(() => BbPromise.resolve());
  },

  deleteActivity(name) {
    const activity = name || this.options.name;
    return this.provider.request('StepFunctions',
      'deleteActivity',
      {
        activityArn: this.activityArns[activity],
      },
      this.options.stage,
      this.options.region)
    .then(() => BbPromise.resolve());
  },

  deleteActivities() {
    const promises = [];
    _.forEach(this.deployedActivities, (value, key) => {
      if (value === 'deployed') {
        promises.push(key);
      }
    });
    return BbPromise
    .map(promises, (name) => this.deleteActivity(name))
    .then(() => BbPromise.resolve());
  },

  describeActivity(name) {
    const activity = name || this.options.name;
    return this.provider.request('StepFunctions',
      'describeActivity',
      { activityArn: this.activityArns[activity] },
      this.options.stage,
      this.options.region)
    .then(() => {
      this.deployedActivities[activity] = 'deployed';
      return BbPromise.resolve();
    }).catch(() => {
      this.deployedActivities[activity] = 'notDeployed';
      return BbPromise.resolve();
    });
  },

  describeActivities() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions.activities, (value) => {
      promises.push(value);
    });
    return BbPromise
    .map(promises, (name) => this.describeActivity(name))
    .then(() => BbPromise.resolve());
  },

  checkActivitySettings() {
    if (!this.serverless.service.stepFunctions.activities) {
      const errorMessage = [
        'activities statement does not exists in serverless.yml',
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }
    return BbPromise.resolve();
  },

  checkActivitySetting(name) {
    const activity = name || this.options.name;
    if (this.serverless.service.stepFunctions.activities.indexOf(activity) < 0) {
      const errorMessage = [
        `Activity "${activity}" does not exist in serverless.yml`,
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }
    return BbPromise.resolve();
  },

  getActivityArn(name) {
    const activity = name || this.options.name;
    return this.provider.request('STS',
      'getCallerIdentity',
      {},
      this.options.stage,
      this.options.region)
    .then((result) => {
      this.activityArns[activity] =
      `arn:aws:states:${this.region}:${result.Account}:activity:${this.getActivityName(activity)}`;
      return BbPromise.resolve();
    });
  },

  getActivityArns() {
    const promises = [];
    _.forEach(this.serverless.service.stepFunctions.activities, (value) => {
      promises.push(value);
    });
    return BbPromise
    .map(promises, (name) => this.getActivityArn(name))
    .then(() => BbPromise.resolve());
  },
};
