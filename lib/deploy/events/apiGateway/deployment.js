'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileDeployment() {
    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    const logicalIds = Object.keys(resources);
    const logicalIdFromStack = logicalIds.find(
      id => resources[id].Type === 'AWS::ApiGateway::Deployment',
    );
    const defaultLogicalId = this.provider.naming
      .generateApiGatewayDeploymentLogicalId(this.serverless.instanceId);

    this.apiGatewayDeploymentLogicalId = logicalIdFromStack || defaultLogicalId;

    if (logicalIdFromStack) {
      resources[logicalIdFromStack].DependsOn = resources[logicalIdFromStack]
        .DependsOn.concat(this.apiGatewayMethodLogicalIds);
    } else {
      _.merge(resources, {
        [this.apiGatewayDeploymentLogicalId]: {
          Type: 'AWS::ApiGateway::Deployment',
          Properties: {
            RestApiId: this.provider.getApiGatewayRestApiId(),
            StageName: this.options.stage,
          },
          DependsOn: this.apiGatewayMethodLogicalIds,
        },
      });
    }

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Outputs, {
      ServiceEndpoint: {
        Description: 'URL of the service endpoint',
        Value: {
          'Fn::Join': ['',
            [
              'https://',
              this.provider.getApiGatewayRestApiId(),
              '.execute-api.',
              { Ref: 'AWS::Region' },
              '.',
              { Ref: 'AWS::URLSuffix' },
              `/${this.provider.getStage()}`,
            ],
          ],
        },
      },
    });
    return BbPromise.resolve();
  },
};
