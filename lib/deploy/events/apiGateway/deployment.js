'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileDeployment() {
    this.apiGatewayDeploymentLogicalId = this.provider.naming
      .generateApiGatewayDeploymentLogicalId();

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
      [this.apiGatewayDeploymentLogicalId]: {
        Type: 'AWS::ApiGateway::Deployment',
        Properties: {
          RestApiId: this.provider.getApiGatewayRestApiId(),
          StageName: this.options.stage,
        },
        DependsOn: this.apiGatewayMethodLogicalIds,
      },
    });

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Outputs, {
      ServiceEndpoint: {
        Description: 'URL of the service endpoint',
        Value: {
          'Fn::Join': ['',
            [
              'https://',
              this.provider.getApiGatewayRestApiId(),
              `.execute-api.${this.options.region}.`,
              { Ref: 'AWS::URLSuffix' },
              `/${this.options.stage}`,
            ],
          ],
        },
      },
    });
    return BbPromise.resolve();
  },
};
