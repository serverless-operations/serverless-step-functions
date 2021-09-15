'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileUsagePlan() {
    const usagePlan = _.get(this.serverless.service.provider.apiGateway, 'usagePlan')
      || this.serverless.service.provider.usagePlan;
    if (usagePlan
      || _.get(this.serverless.service.provider.apiGateway, 'apiKeys')
      || this.serverless.service.provider.apiKeys) {
      this.apiGatewayUsagePlanLogicalId = this.provider.naming.getUsagePlanLogicalId();
      _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
        [this.apiGatewayUsagePlanLogicalId]: {
          Type: 'AWS::ApiGateway::UsagePlan',
          DependsOn: this.apiGatewayDeploymentLogicalId,
          Properties: {
            ApiStages: [
              {
                ApiId: {
                  Ref: this.apiGatewayRestApiLogicalId,
                },
                Stage: this.provider.getStage(),
              },
            ],
            Description: `Usage plan for ${this.serverless.service.service} ${
              this.provider.getStage()} stage`,
            UsagePlanName: `${this.serverless.service.service}-${
              this.provider.getStage()}`,
          },
        },
      });
      if (_.has(usagePlan, 'quota') && usagePlan.quota !== null) {
        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
          [this.apiGatewayUsagePlanLogicalId]: {
            Properties: {
              Quota: _.merge(
                { Limit: usagePlan.quota.limit },
                { Offset: usagePlan.quota.offset },
                { Period: usagePlan.quota.period },
              ),
            },
          },
        });
      }
      if (_.has(usagePlan, 'throttle') && usagePlan.throttle !== null) {
        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
          [this.apiGatewayUsagePlanLogicalId]: {
            Properties: {
              Throttle: _.merge(
                { BurstLimit: usagePlan.throttle.burstLimit },
                { RateLimit: usagePlan.throttle.rateLimit },
              ),
            },
          },
        });
      }
    }
    return BbPromise.resolve();
  },
};
