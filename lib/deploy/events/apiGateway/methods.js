'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const awsArnRegExs = require('../../../utils/arnRegularExpressions');

const LAMBDA_PROXY_REQUEST_TEMPLATE = `
  #define( $loop )
  {
    #foreach($key in $map.keySet())
      #set( $k = $util.escapeJavaScript($key) )
      #set( $v = $util.escapeJavaScript($map.get($key)).replaceAll("\\\\'", "'") )
      "$k":
        #if ("$v" == "")
          null
        #else
          "$v"
        #end
        #if( $foreach.hasNext ) , #end
    #end
  }
  #end
  #define( $smInput )
  {
    "resource": "$context.resourcePath",
    "path": "$context.path",
    "httpMethod": "$context.httpMethod",
    #set( $map = $input.params().header )
    "headers": $loop,

    #if ($input.params().querystring.size() == 0)
    "queryStringParameters": null,
    #else
    #set( $map = $input.params().querystring )
    "queryStringParameters": $loop,
    #end

    #if ($input.params().path.size() == 0)
    "pathParameters": null,
    #else
    #set( $map = $input.params().path )
    "pathParameters": $loop,
    #end

    #if ($stageVariables.size() == 0)
    "stageVariables": null,
    #else
    #set( $map = $stageVariables )
    "stageVariables": $loop,
    #end

    "requestContext": {
      "resourceId": "$context.resourceId",
      "resourcePath": "$context.resourcePath",
      "httpMethod": "$context.httpMethod",
      "extendedRequestId": "$context.extendedRequestId",
      "requestTime": "$context.requestTime",
      "path": "$context.path",
      "accountId": "\${AccountId}",
      "protocol": "$context.protocol",
      "stage": "$context.stage",
      "domainPrefix": "$context.domainPrefix",
      "requestTimeEpoch": $context.requestTimeEpoch,
      "requestId": "$context.requestId",
      #set( $map = $context.identity )
      "identity": $loop,
      "domainName": "$context.domainName",
      #set( $map = $context.authorizer )
      "authorizer": $loop,
      "apiId": "$context.apiId"
    },
    "body": "$util.escapeJavaScript("$body").replaceAll("\\\\'", "'")",
    "isBase64Encoded": false
  }
  #end
  {
    "input": "$util.escapeJavaScript("$smInput").replaceAll("\\\\'", "'")",
    "name":"$context.requestId",
    "stateMachineArn":"\${StateMachineArn}"
  }`;

const LAMBDA_PROXY_JSON_REQUEST_TEMPLATE = `
  #set( $body = $input.body )
  ${LAMBDA_PROXY_REQUEST_TEMPLATE}`;

const LAMBDA_PROXY_FORM_URL_ENCODED_REQUEST_TEMPLATE = `
  #define( $body )
    {
    #foreach( $token in $input.path('$').split('&') )
      #set( $keyVal = $token.split('=') )
      #set( $keyValSize = $keyVal.size() )
      #if( $keyValSize >= 1 )
        #set( $key = $util.escapeJavaScript($util.urlDecode($keyVal[0])) )
        #if( $keyValSize >= 2 )
          #set($val = $util.escapeJavaScript($util.urlDecode($keyVal[1])).replaceAll("\\\\'","'"))
        #else
          #set( $val = '' )
        #end
        "$key": "$val"#if($foreach.hasNext),#end
      #end
    #end
    }
  #end
  ${LAMBDA_PROXY_REQUEST_TEMPLATE}`;

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
        this.getMethodAuthorization(event.http));

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
    const defaultIamRoleLogicalId = this.getApiToStepFunctionsIamRoleLogicalId();
    const defaultIamRole = {
      'Fn::GetAtt': [
        `${defaultIamRoleLogicalId}`,
        'Arn',
      ],
    };
    const iamRole = _.get(http, 'iamRole', defaultIamRole);
    let integrationAction = ':states:action/StartExecution';
    let passthroughBehavior = 'NEVER';
    if (http && http.action) {
      integrationAction = `:states:action/${http.action}`;
      passthroughBehavior = 'WHEN_NO_TEMPLATES';
    }

    const integration = {
      IntegrationHttpMethod: 'POST',
      Type: 'AWS',
      Credentials: iamRole,
      Uri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':apigateway:',
            {
              Ref: 'AWS::Region',
            },
            integrationAction,
          ],
        ],
      },
      PassthroughBehavior: passthroughBehavior,
      RequestTemplates: this.getIntegrationRequestTemplates(
        stateMachineName,
        stateMachineObj,
        http,
      ),
    };

    const responseParams = _.mapKeys(
      _.get(http, 'response.headers', {}),
      (value, key) => `method.response.header.${key}`,
    );
    const responseTemplates = _.get(http, 'response.template', {});

    const integrationResponse = {
      IntegrationResponses: [
        {
          StatusCode: 200,
          SelectionPattern: 200,
          ResponseParameters: responseParams,
          ResponseTemplates: responseTemplates,
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
        integrationResponse.IntegrationResponses[i]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin'] = `'${origin}'`;
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
    const defaultTemplate = this.getDefaultRequestTemplates(
      stateMachineName,
      stateMachineObj,
    );

    if (_.has(http, 'request.template')) {
      // lambda_proxy template
      if (http.request.template === 'lambda_proxy') {
        return this.getLambdaProxyRequestTemplates(
          stateMachineName,
          stateMachineObj,
        );
      }
      // custom template (Object.assign is because the custom template might cover both
      // JSON and form-url content-types)
      return Object.assign(
        defaultTemplate,
        http.request.template,
      );
    }

    if (_.has(http, 'action')) {
      // no template if some action was defined.
      return {};
    }

    // default template
    return defaultTemplate;
  },

  getLambdaProxyRequestTemplates(stateMachineName, stateMachineObj) {
    const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName, stateMachineObj);
    return {
      'application/json': this.buildLambdaProxyReqTemplate(
        LAMBDA_PROXY_JSON_REQUEST_TEMPLATE,
        stateMachineLogicalId,
      ),
      'application/x-www-form-urlencoded': this.buildLambdaProxyReqTemplate(
        LAMBDA_PROXY_FORM_URL_ENCODED_REQUEST_TEMPLATE,
        stateMachineLogicalId,
      ),
    };
  },

  buildLambdaProxyReqTemplate(template, stateMachineLogicalId) {
    return {
      'Fn::Sub': [
        template,
        {
          StateMachineArn: { Ref: stateMachineLogicalId },
          AccountId: { Ref: 'AWS::AccountId' },
        },
      ],
    };
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
      'Fn::Sub': [
        `
#set( $body = $util.escapeJavaScript($input.json('$')).replaceAll("\\\\'", "'") )
{"input": "$body", "name": "$context.requestId", "stateMachineArn":"\${StateMachineArn}"}`,
        { StateMachineArn: { Ref: stateMachineLogicalId } },
      ],
    };
  },

  getMethodResponses(http) {
    const responseParams = _.mapKeys(
      _.get(http, 'response.headers', {}),
      (value, key) => `method.response.header.${key}`,
    );
    const methodResponse = {
      Properties: {
        MethodResponses: [
          {
            ResponseParameters: responseParams,
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
        methodResponse.Properties.MethodResponses[i]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin'] = `'${origin}'`;
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
            AuthorizationScopes: http.authorizer.scopes,
          },
        };
      }

      const authorizerLogicalId = this.provider.naming
        .getAuthorizerLogicalId(http.authorizer.name || http.authorizer);

      let authorizationType;
      let authorizationScopes;
      const authorizerArn = http.authorizer.arn;
      if (typeof authorizerArn === 'string'
        && awsArnRegExs.cognitoIdpArnExpr.test(authorizerArn)) {
        authorizationType = 'COGNITO_USER_POOLS';
        authorizationScopes = http.authorizer.scopes;
      } else {
        authorizationType = 'CUSTOM';
      }

      return {
        Properties: {
          AuthorizationType: authorizationType,
          AuthorizerId: { Ref: authorizerLogicalId },
          AuthorizationScopes: authorizationScopes,
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
