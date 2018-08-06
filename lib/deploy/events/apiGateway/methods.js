'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const awsArnRegExs = require('../../../utils/arnRegularExpressions');

module.exports = {

  compileMethods() {
    this.apiGatewayMethodLogicalIds = [];
    this.pluginhttpValidated.events.forEach((event) => {
      const resourceId = this.getResourceId(event.http.path);
      const resourceName = this.getResourceName(event.http.path);
      const stateMachineObj = this.getStateMachine(event.stateMachineName);

      const template = {
        Type: 'AWS::ApiGateway::Method',
        Properties: {
          HttpMethod: event.http.method.toUpperCase(),
          RequestParameters: {},
          AuthorizationType: 'NONE',
          ApiKeyRequired: Boolean(event.http.private),
          ResourceId: resourceId,
          RestApiId: this.provider.getApiGatewayRestApiId(),
        },
      };

      _.merge(template,
        this.getMethodIntegration(event.stateMachineName, stateMachineObj, event.http),
        this.getMethodResponses(event.http),
        this.getMethodAuthorization(event.http)
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

  getMethodIntegration(stateMachineName, stateMachineObj, http) {
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
      RequestTemplates: this.getIntegrationRequestTemplates(
        stateMachineName,
        stateMachineObj,
        http
      ),
    };

    const integrationResponse = {
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

    if (http && http.cors) {
      let origin = http.cors.origin;
      if (http.cors.origins && http.cors.origins.length) {
        origin = http.cors.origins.join(',');
      }

      integrationResponse.IntegrationResponses.forEach((val, i) => {
        integrationResponse.IntegrationResponses[i].ResponseParameters = {
          'method.response.header.Access-Control-Allow-Origin': `'${origin}'`,
        };
      });
    }

    _.merge(integration, integrationResponse);

    return {
      Properties: {
        Integration: integration,
      },
    };
  },

  getIntegrationRequestTemplates(stateMachineName, stateMachineObj, http) {
    const defaultRequestTemplates = this.getDefaultRequestTemplates(
      stateMachineName,
      stateMachineObj
    );
    return Object.assign(
      defaultRequestTemplates,
      _.get(http, ['request', 'template'])
    );
  },

  getDefaultRequestTemplates(stateMachineName, stateMachineObj) {
    const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName, stateMachineObj);
    return {
      'application/json': this.buildDefaultRequestTemplate(stateMachineLogicalId),
      'application/x-www-form-urlencoded': this.buildDefaultRequestTemplate(stateMachineLogicalId),
    };
  },

  buildDefaultRequestTemplate(stateMachineLogicalId) {
    return {
      'Fn::Join': [
        '', [
          // eslint-disable-next-line max-len
          "#set( $body = $util.escapeJavaScript($input.json('$')).replaceAll(\"\\\\'\", \"'\") ) \n\n",
          '{"input": "$body","name": "$context.requestId","stateMachineArn":"',
          {
            Ref: `${stateMachineLogicalId}`,
          },
          '"}',
        ],
      ],
    };
  },

  getMethodResponses(http) {
    const methodResponse = {
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

    if (http && http.cors) {
      let origin = http.cors.origin;
      if (http.cors.origins && http.cors.origins.length) {
        origin = http.cors.origins.join(',');
      }

      methodResponse.Properties.MethodResponses.forEach((val, i) => {
        methodResponse.Properties.MethodResponses[i].ResponseParameters = {
          'method.response.header.Access-Control-Allow-Origin': `'${origin}'`,
        };
      });
    }

    return methodResponse;
  },

  getMethodAuthorization(http) {
    if (_.get(http, 'authorizer.type') === 'AWS_IAM') {
      return {
        Properties: {
          AuthorizationType: 'AWS_IAM',
        },
      };
    }

    if (http.authorizer) {
      if (http.authorizer.type && http.authorizer.authorizerId) {
        return {
          Properties: {
            AuthorizationType: http.authorizer.type,
            AuthorizerId: http.authorizer.authorizerId,
          },
        };
      }

      const authorizerLogicalId = this.provider.naming
        .getAuthorizerLogicalId(http.authorizer.name || http.authorizer);

      let authorizationType;
      const authorizerArn = http.authorizer.arn;
      if (typeof authorizerArn === 'string'
        && awsArnRegExs.cognitoIdpArnExpr.test(authorizerArn)) {
        authorizationType = 'COGNITO_USER_POOLS';
      } else {
        authorizationType = 'CUSTOM';
      }

      return {
        Properties: {
          AuthorizationType: authorizationType,
          AuthorizerId: { Ref: authorizerLogicalId },
        },
        DependsOn: authorizerLogicalId,
      };
    }

    return {
      Properties: {
        AuthorizationType: 'NONE',
      },
    };
  },
};
