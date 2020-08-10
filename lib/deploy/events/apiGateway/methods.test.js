'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#methods()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };

    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
    };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };

    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {},
      },
    };
    serverlessStepFunctions.apiGatewayResourceLogicalIds = { 'foo/bar': 'apiGatewayResourceLogicalId' };
    serverlessStepFunctions.apiGatewayResourceNames = {
      'foo/bar1': 'apiGatewayResourceNamesFirst',
      'foo/bar2': 'apiGatewayResourceNamesSecond',
    };
    serverlessStepFunctions.pluginhttpValidated = {
      events: [
        {
          stateMachineName: 'first',
          http: {
            path: 'foo/bar1',
            method: 'post',
          },
        },
        {
          stateMachineName: 'first',
          http: {
            path: 'foo/bar2',
            method: 'post',
            private: true,
          },
        },
      ],
    };

    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.apiGatewayResources = {
      'foo/bar1': {
        name: 'First',
        resourceLogicalId: 'ApiGatewayResourceFirst',
      },

      'foo/bar2': {
        name: 'Second',
        resourceLogicalId: 'ApiGatewayResourceSecond',
      },
    };
  });

  describe('#compileMethods()', () => {
    it('should create a method resource', () => serverlessStepFunctions
      .compileMethods().then(() => {
        expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources)
          .to.have.property('ApiGatewayMethodFirstPost');
      }));

    it('should verify if http private parameter is correctly passed to resource',
      () => serverlessStepFunctions
        .compileMethods().then(() => {
          const resources = serverlessStepFunctions
            .serverless.service.provider.compiledCloudFormationTemplate.Resources;

          expect(resources.ApiGatewayMethodFirstPost
            .Properties.ApiKeyRequired).to.eql(false);
          expect(resources.ApiGatewayMethodSecondPost
            .Properties.ApiKeyRequired).to.eql(true);
        }));
  });

  describe('#getMethodIntegration()', () => {
    it('should return a corresponding Integration resource', () => {
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine').Properties)
        .to.have.property('Integration');
    });

    it('should set stateMachinelogical ID to RequestTemplates when customName is not set', () => {
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine').Properties
        .Integration.RequestTemplates['application/json']['Fn::Sub'][1].StateMachineArn.Ref)
        .to.be.equal('StateMachineStepFunctionsStateMachine');
    });

    it('should set custom stateMachinelogical ID to RequestTemplates when customName is set',
      () => {
        const integration = serverlessStepFunctions
          .getMethodIntegration('stateMachine', { name: 'custom' })
          .Properties
          .Integration;
        expect(integration.RequestTemplates['application/json']['Fn::Sub'][1].StateMachineArn.Ref)
          .to.be.equal('Custom');
      });

    it('should set Access-Control-Allow-Origin header when cors is true',
      () => {
        expect(serverlessStepFunctions.getMethodIntegration('stateMachine', 'custom', {
          cors: {
            origins: ['*', 'http://example.com'],
          },
        }).Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin'])
          .to.equal('\'*,http://example.com\'');

        expect(serverlessStepFunctions.getMethodIntegration('stateMachine', 'custom', {
          cors: {
            origin: '*',
          },
        }).Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin'])
          .to.equal('\'*\'');
      });

    it('should change passthroughBehavior and action when action is set',
      () => {
        expect(serverlessStepFunctions.getMethodIntegration('stateMachine', 'custom', {
          action: 'DescribeExecution',
        }).Properties.Integration.PassthroughBehavior)
          .to.equal('WHEN_NO_TEMPLATES');

        expect(serverlessStepFunctions.getMethodIntegration('stateMachine', 'custom', {
          action: 'DescribeExecution',
        }).Properties.Integration.Uri['Fn::Join'][1][4])
          .to.equal(':states:action/DescribeExecution');
      });

    it('should return a custom template for application/json when one is given',
      () => {
        const httpWithResponseTemplate = {
          path: 'foo/bar1',
          method: 'post',
          response: {
            template: {
              'application/json': 'custom template',
            },
          },
        };
        const resource = serverlessStepFunctions
          .getMethodIntegration('stateMachine', undefined, httpWithResponseTemplate);
        const responseTemplates = resource
          .Properties.Integration.IntegrationResponses
          .find(x => x.StatusCode === 200)
          .ResponseTemplates;
        expect(responseTemplates['application/json'])
          .to.be.equal('custom template');
      });

    it('should return custom headers when one is given',
      () => {
        const httpWithResponseHeaders = {
          path: 'foo/bar1',
          method: 'post',
          response: {
            headers: {
              'Content-Type': 'text',
              'X-Application-Id': 'id',
            },
          },
        };
        const resource = serverlessStepFunctions
          .getMethodIntegration('stateMachine', undefined, httpWithResponseHeaders);

        const intResponseParams = resource
          .Properties.Integration.IntegrationResponses
          .find(x => x.StatusCode === 200)
          .ResponseParameters;
        expect(intResponseParams['method.response.header.Content-Type'])
          .to.be.equal('text');
        expect(intResponseParams['method.response.header.X-Application-Id'])
          .to.be.equal('id');
      });
  });

  describe('#getIntegrationRequestTemplates()', () => {
    it('should set stateMachinelogical ID in default templates when customName is not set', () => {
      const requestTemplates = serverlessStepFunctions
        .getIntegrationRequestTemplates('stateMachine');
      expect(requestTemplates['application/json']['Fn::Sub'][1])
        .to.be.deep.equal({
          StateMachineArn: { Ref: 'StateMachineStepFunctionsStateMachine' },
        });
    });

    it('should set custom stateMachinelogical ID in default templates when customName is set',
      () => {
        const requestTemplates = serverlessStepFunctions
          .getIntegrationRequestTemplates('stateMachine', { name: 'custom' });
        expect(requestTemplates['application/json']['Fn::Sub'][1])
          .to.be.deep.equal({
            StateMachineArn: { Ref: 'Custom' },
          });
      });

    it('should return the default template for application/json when one is not given', () => {
      const httpWithoutRequestTemplate = {
        path: 'foo/bar1',
        method: 'post',
        request: {
          template: {
            'application/x-www-form-urlencoded': 'custom template',
          },
        },
      };
      const requestTemplates = serverlessStepFunctions
        .getMethodIntegration('stateMachine', undefined, httpWithoutRequestTemplate)
        .Properties.Integration.RequestTemplates;
      expect(requestTemplates['application/json']['Fn::Sub'][1])
        .to.be.deep.equal({
          StateMachineArn: { Ref: 'StateMachineStepFunctionsStateMachine' },
        });
    });

    it('should return a custom template for application/json when one is given', () => {
      const httpWithRequestTemplate = {
        path: 'foo/bar1',
        method: 'post',
        request: {
          template: {
            'application/json': 'custom template',
          },
        },
      };
      const requestTemplates = serverlessStepFunctions
        .getMethodIntegration('stateMachine', undefined, httpWithRequestTemplate)
        .Properties.Integration.RequestTemplates;
      expect(requestTemplates['application/json'])
        .to.be.equal('custom template');
    });

    it('should return the default for application/x-www-form-urlencoded when one is not given',
      () => {
        const httpWithoutRequestTemplate = {
          path: 'foo/bar1',
          method: 'post',
          request: {
            template: {
              'application/json': 'custom template',
            },
          },
        };
        const requestTemplates = serverlessStepFunctions
          .getMethodIntegration('stateMachine', undefined, httpWithoutRequestTemplate)
          .Properties.Integration.RequestTemplates;
        expect(requestTemplates['application/x-www-form-urlencoded']['Fn::Sub'][1])
          .to.be.deep.equal({
            StateMachineArn: { Ref: 'StateMachineStepFunctionsStateMachine' },
          });
      });

    it('should return a custom template for application/x-www-form-urlencoded when one is given',
      () => {
        const httpWithRequestTemplate = {
          path: 'foo/bar1',
          method: 'post',
          request: {
            template: {
              'application/x-www-form-urlencoded': 'custom template',
            },
          },
        };
        const requestTemplates = serverlessStepFunctions
          .getMethodIntegration('stateMachine', undefined, httpWithRequestTemplate)
          .Properties.Integration.RequestTemplates;
        expect(requestTemplates['application/x-www-form-urlencoded'])
          .to.be.equal('custom template');
      });

    it('should return the LAMBDA_PROXY template if http.request.template is "lambda_proxy"', () => {
      const httpWithRequestTemplate = {
        path: 'foo/bar1',
        method: 'post',
        request: {
          template: 'lambda_proxy',
        },
      };
      const requestTemplates = serverlessStepFunctions
        .getMethodIntegration('stateMachine', undefined, httpWithRequestTemplate)
        .Properties.Integration.RequestTemplates;
      expect(requestTemplates['application/json']['Fn::Sub'][0])
        .to.contain('#set( $body = $input.body )');
      expect(requestTemplates['application/json']['Fn::Sub'][1])
        .to.be.deep.equal({
          StateMachineArn: { Ref: 'StateMachineStepFunctionsStateMachine' },
          AccountId: { Ref: 'AWS::AccountId' },
        });
      expect(requestTemplates['application/x-www-form-urlencoded']['Fn::Sub'][0])
        .to.contain('#define( $body )');
      expect(requestTemplates['application/x-www-form-urlencoded']['Fn::Sub'][1])
        .to.be.deep.equal({
          StateMachineArn: { Ref: 'StateMachineStepFunctionsStateMachine' },
          AccountId: { Ref: 'AWS::AccountId' },
        });
    });
  });

  describe('#buildDefaultRequestTemplate()', () => {
    it('should return the default request template', () => {
      const defaultRequestTemplate = serverlessStepFunctions
        .buildDefaultRequestTemplate('StateMachineStepFunctionsStateMachine');
      expect(defaultRequestTemplate['Fn::Sub'][0])
        .to.contain(
          '#set( $body = $util.escapeJavaScript($input.json(\'$\')).replaceAll("\\\\\'", "\'") )',
        );
      expect(defaultRequestTemplate['Fn::Sub'][0])
        .to.contain(
          '{"input": "$body", "name": "$context.requestId", "stateMachineArn":"${StateMachineArn}"}',
        );
      expect(defaultRequestTemplate['Fn::Sub'][1])
        .to.be.deep.equal({
          StateMachineArn: { Ref: 'StateMachineStepFunctionsStateMachine' },
        });
    });
  });

  describe('#getLambdaProxyRequestTemplates()', () => {
    it('application/json proxy template should not have escaped single quotes', () => {
      const lambdaProxyRequestTemplate = serverlessStepFunctions
        .getLambdaProxyRequestTemplates('stateMachine', undefined);

      // Using negative lookahead, look for escapeJavaScript calls without the
      // required stripping of escaped single quotes after
      const escapeJavascriptPattern = /\$util.escapeJavaScript\("\$\w+"\)/;
      const unescapeSingleQuotesPattern = /\.replaceAll\("\\\\'", *"'"\)/;
      const regExp = new RegExp(`${escapeJavascriptPattern.source}(?!${unescapeSingleQuotesPattern.source})`);
      expect(lambdaProxyRequestTemplate['application/json']['Fn::Sub'][0]).not.to.match(regExp);
    });
  });

  describe('#getMethodResponses()', () => {
    it('should return a corresponding methodResponses resource', () => {
      expect(serverlessStepFunctions.getMethodResponses().Properties)
        .to.have.property('MethodResponses');
    });

    it('should set Access-Control-Allow-Origin header when cors is true',
      () => {
        expect(serverlessStepFunctions.getMethodResponses({
          cors: {
            origins: ['*', 'http://example.com'],
          },
        }).Properties.MethodResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin'])
          .to.equal('\'*,http://example.com\'');

        expect(serverlessStepFunctions.getMethodResponses({
          cors: {
            origin: '*',
          },
        }).Properties.MethodResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin'])
          .to.equal('\'*\'');
      });

    it('should set custom custom headers when one is given',
      () => {
        expect(serverlessStepFunctions.getMethodResponses({
          response: {
            headers: {
              'X-Application-Id': 'id',
            },
          },
        }).Properties.MethodResponses[0]
          .ResponseParameters['method.response.header.X-Application-Id'])
          .to.equal('id');
      });
  });

  describe('#getMethodAuthorization()', () => {
    it('should return properties with AuthorizationType: NONE if no authorizer provided', () => {
      const event = {
        path: 'foo/bar1',
        method: 'post',
      };

      const authorization = serverlessStepFunctions.getMethodAuthorization(event);

      expect(authorization.Properties.AuthorizationType).to.equal('NONE');
      expect(authorization.Properties.AuthorizationScopes).to.equal(undefined);
    });

    it('should return resource properties with AuthorizationType: AWS_IAM', () => {
      const event = {
        authorizer: {
          type: 'AWS_IAM',
          authorizerId: 'foo12345',
        },
      };

      const authorization = serverlessStepFunctions.getMethodAuthorization(event);

      expect(authorization.Properties.AuthorizationType).to.equal('AWS_IAM');
      expect(authorization.Properties.AuthorizationScopes).to.equal(undefined);
    });

    it('should return properties with AuthorizationType: CUSTOM and authotizerId', () => {
      const event = {
        authorizer: {
          type: 'CUSTOM',
          authorizerId: 'foo12345',
        },
      };

      const authorization = serverlessStepFunctions.getMethodAuthorization(event);

      expect(authorization.Properties.AuthorizationType).to.equal('CUSTOM');
      expect(authorization.Properties.AuthorizerId).to.equal('foo12345');
      expect(authorization.Properties.AuthorizationScopes).to.equal(undefined);
    });

    it('should return properties with AuthorizationType: CUSTOM and resource reference', () => {
      const event = {
        authorizer: {
          name: 'authorizer',
          arn: { 'Fn::GetAtt': ['SomeLambdaFunction', 'Arn'] },
          resultTtlInSeconds: 300,
          identitySource: 'method.request.header.Authorization',
        },
      };

      const authorization = serverlessStepFunctions.getMethodAuthorization(event);
      expect(authorization.Properties.AuthorizationType).to.equal('CUSTOM');
      expect(authorization.Properties.AuthorizerId)
        .to.deep.equal({ Ref: 'AuthorizerApiGatewayAuthorizer' });
    });

    it('should return properties with AuthorizationType: COGNITO_USER_POOLS', () => {
      const event = {
        authorizer: {
          name: 'authorizer',
          arn: 'arn:aws:cognito-idp:us-east-1:xxx:userpool/us-east-1_ZZZ',
          scopes: [
            'scope1',
            'scope2',
          ],
        },
      };

      const authorization = serverlessStepFunctions.getMethodAuthorization(event);
      expect(authorization.Properties.AuthorizationType).to.equal('COGNITO_USER_POOLS');
      expect(authorization.Properties.AuthorizerId)
        .to.deep.equal({ Ref: 'AuthorizerApiGatewayAuthorizer' });
      expect(authorization.Properties.AuthorizationScopes)
        .to.deep.equal(['scope1', 'scope2']);
    });

    it('should return properties with AuthorizationType when type is "COGNITO_USER_POOLS"', () => {
      const event = {
        authorizer: {
          type: 'COGNITO_USER_POOLS',
          authorizerId: {
            Ref: 'ApiGatewayAuthorizer',
          },
          scopes: [
            'scope1',
            'scope2',
          ],
        },
      };

      const authorization = serverlessStepFunctions.getMethodAuthorization(event);
      expect(authorization.Properties.AuthorizationType).to.equal('COGNITO_USER_POOLS');
      expect(authorization.Properties.AuthorizerId)
        .to.deep.equal({ Ref: 'ApiGatewayAuthorizer' });
      expect(authorization.Properties.AuthorizationScopes)
        .to.deep.equal(['scope1', 'scope2']);
    });
  });
});
