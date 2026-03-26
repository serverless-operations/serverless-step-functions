'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileApiKeys() {
    const apiKeys = _.get(this.serverless.service.provider.apiGateway, 'apiKeys')
      || this.serverless.service.provider.apiKeys;
    if (apiKeys) {
      if (!Array.isArray(apiKeys)) {
        throw new this.serverless.classes.Error('apiKeys property must be an array');
      }

      _.forEach(apiKeys, (apiKey, i) => {
        const apiKeyNumber = i + 1;

        if (typeof apiKey !== 'string' && typeof apiKey !== 'object') {
          throw new this.serverless.classes.Error('API Keys must be strings or objects');
        }

        const apiKeyName = typeof apiKey === 'object' ? apiKey.name : apiKey;
        const apiKeyValue = typeof apiKey === 'object' ? apiKey.value : undefined;

        const apiKeyLogicalId = this.provider.naming
          .getApiKeyLogicalId(apiKeyNumber);

        const properties = {
          Enabled: true,
          Name: apiKeyName,
          StageKeys: [{
            RestApiId: { Ref: this.apiGatewayRestApiLogicalId },
            StageName: this.provider.getStage(),
          }],
        };

        if (apiKeyValue !== undefined) {
          properties.Value = apiKeyValue;
        }

        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
          [apiKeyLogicalId]: {
            Type: 'AWS::ApiGateway::ApiKey',
            Properties: properties,
            DependsOn: this.apiGatewayDeploymentLogicalId,
          },
        });
      });
    }
    return BbPromise.resolve();
  },
};
