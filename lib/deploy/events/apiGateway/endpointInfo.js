'use strict';

const BbPromise = require('bluebird');

module.exports = {
  getEndpointInfo() {
    const stackName = this.provider.naming.getStackName(this.options.stage);

    // Get info from CloudFormation Outputs
    return this.provider.request('CloudFormation',
      'describeStacks',
      { StackName: stackName },
      this.options.stage,
      this.options.region)
      .then((result) => {
        if (result) {
          const serviceEndpointOutputRegex = this.provider.naming
            .getServiceEndpointRegex();

          // Endpoints
          result.Stacks[0].Outputs.filter(x => x.OutputKey.match(serviceEndpointOutputRegex))
            .forEach((x) => {
              this.endpointInfo = x.OutputValue;
            });
        }

        return BbPromise.resolve();
      });
  },
};
