'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');

module.exports = {

  compileMethods() {
    this.apiGatewayMethodLogicalIds = [];

    this.pluginhttpValidated.events.forEach((event) => {
      const resourceId = this.getResourceId(event.http.path);
      const resourceName = this.getResourceName(event.http.path);
      const requestParameters = (event.http.request && event.http.request.parameters) || {};

      const template = {
        Type: 'AWS::ApiGateway::Method',
        Properties: {
          HttpMethod: event.http.method.toUpperCase(),
          RequestParameters: requestParameters,
          ResourceId: resourceId,
          RestApiId: { Ref: this.apiGatewayRestApiLogicalId },
        },
      };

      if (event.http.private) {
        template.Properties.ApiKeyRequired = true;
      }

      _.merge(template,
        this.getMethodIntegration(event.http, event.stateMachineName)
//        this.getMethodResponses(event.http)
      );

      const methodLogicalId = this.provider.naming
        .getMethodLogicalId(resourceName, event.http.method);

      this.apiGatewayMethodLogicalIds.push(methodLogicalId);

      _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources, {
        [methodLogicalId]: template,
      });
    });

    return BbPromise.resolve();
  },

  getMethodIntegration(http, stateMachineName) {
    const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName);
    const integration = {
      IntegrationHttpMethod: 'POST',
      Type: 'AWS',
      Credentials: {
        'Fn::GetAtt': [
          'APIAssumeRolePolicyDocument',
          'Arn',
        ],
      },
      Uri: {
        'Fn::Join': [
          '',
          [
            'arn:aws:apigateway:',
            {
              Ref: 'AWS::Region',
            },
            ':states:action/StartExecution',
          ],
        ],
      },
      PassthroughBehavior: 'NEVER',
      RequestTemplates: {
        'application/json': {
          'Fn::Join': [
            '', [
              "#set( $body = $util.escapeJavaScript($input.json('$')) ) \n\n",
              '{"input": "$body","name": "$context.requestId","stateMachineArn":"',
              {
                Ref: `${stateMachineLogicalId}`,
              },
              '"}',
            ],
          ],
        },
      },
      IntegrationResponses: [
        {
          StatusCode: 200,
          SelectionPattern: '',
          ResponseParameters: {},
          ResponseTemplates: {},
        },
        {
          StatusCode: 400,
          SelectionPattern: '[\\s\\S]*\\[400\\][\\s\\S]*',
          ResponseParameters: {},
          ResponseTemplates: {},
        },
      ],
    };

    return {
      Properties: {
        Integration: integration,
      },
    };
  },
};
