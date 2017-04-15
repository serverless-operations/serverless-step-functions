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
          AuthorizationType: 'NONE',
          ResourceId: resourceId,
          RestApiId: { Ref: this.apiGatewayRestApiLogicalId },
        },
      };

      _.merge(template,
        this.getMethodIntegration(event.stateMachineName),
        this.getMethodResponses()
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

  getMethodIntegration(stateMachineName) {
    const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName);
    const apiToStepFunctionsIamRoleLogicalId = this.getApiToStepFunctionsIamRoleLogicalId();
    const integration = {
      IntegrationHttpMethod: 'POST',
      Type: 'AWS',
      Credentials: {
        'Fn::GetAtt': [
          `${apiToStepFunctionsIamRoleLogicalId}`,
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
        'application/x-www-form-urlencoded': {
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
          SelectionPattern: 200,
          ResponseParameters: {},
          ResponseTemplates: {},
        },
        {
          StatusCode: 400,
          SelectionPattern: 400,
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

  getMethodResponses() {
    return {
      Properties: {
        MethodResponses: [
          {
            ResponseParameters: {},
            ResponseModels: {},
            StatusCode: 200,
          },
          {
            ResponseParameters: {},
            ResponseModels: {},
            StatusCode: 400,
          },
        ],
      },
    };
  },
};
