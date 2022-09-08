'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileRestApi() {
    if (this.serverless.service.provider.apiGateway
      && this.serverless.service.provider.apiGateway.restApiId) {
      return BbPromise.resolve();
    }

    this.apiGatewayRestApiLogicalId = this.provider.naming.getRestApiLogicalId();

    let endpointType = 'EDGE';
    let vpcEndpointIds;

    if (this.serverless.service.provider.endpointType) {
      const validEndpointTypes = ['REGIONAL', 'EDGE', 'PRIVATE'];
      endpointType = this.serverless.service.provider.endpointType;

      if (typeof endpointType !== 'string') {
        throw new this.serverless.classes.Error('endpointType must be a string');
      }

      if (this.serverless.service.provider.vpcEndpointIds) {
        vpcEndpointIds = this.serverless.service.provider.vpcEndpointIds;

        if (endpointType !== 'PRIVATE') {
          throw new Error(
            'VPC endpoint IDs are only available for private APIs',
            'API_GATEWAY_INVALID_VPC_ENDPOINT_IDS_CONFIG',
          );
        }
      }

      if (!_.includes(validEndpointTypes, endpointType.toUpperCase())) {
        const message = 'endpointType must be one of "REGIONAL" or "EDGE" or "PRIVATE". '
                        + `You provided ${endpointType}.`;
        throw new this.serverless.classes.Error(message);
      }
      endpointType = endpointType.toUpperCase();
    }

    const EndpointConfiguration = {
      Types: [endpointType],
    };

    if (vpcEndpointIds) {
      EndpointConfiguration.VpcEndpointIds = vpcEndpointIds;
    }

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
      [this.apiGatewayRestApiLogicalId]: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          Name: this.provider.naming.getApiGatewayName(),
          EndpointConfiguration,
        },
      },
    });

    const resourcePolicy = _.get(this.serverless.service.provider.apiGateway, 'resourcePolicy')
      || this.serverless.service.provider.resourcePolicy;

    if (!_.isEmpty(resourcePolicy)) {
      const policy = {
        Version: '2012-10-17',
        Statement: resourcePolicy,
      };
      _.merge(this.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[this.apiGatewayRestApiLogicalId].Properties, {
        Policy: policy,
      });
    }

    return BbPromise.resolve();
  },
};
