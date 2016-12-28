'use strict';

class AwsStepFunctionsDeploy {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'deploy:deploy': this.deploy.bind(this),
    };
  }

  deploy() {
    this.serverless.cli.consoleLog('Start Deploy Step Functions');
  }
}
module.exports = AwsStepFunctionsDeploy;
