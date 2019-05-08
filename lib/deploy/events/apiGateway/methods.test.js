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

    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {},
      },
    };
    serverlessStepFunctions.apiGatewayResourceLogicalIds
      = { 'foo/bar': 'apiGatewayResourceLogicalId' };
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
      })
    );

    it('should verify if http private parameter is correctly passed to resource',
      () => serverlessStepFunctions
        .compileMethods().then(() => {
          const resources = serverlessStepFunctions
            .serverless.service.provider.compiledCloudFormationTemplate.Resources;

          expect(resources.ApiGatewayMethodFirstPost
            .Properties.ApiKeyRequired).to.eql(false);
          expect(resources.ApiGatewayMethodSecondPost
            .Properties.ApiKeyRequired).to.eql(true);
        })
    );
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
  });

  describe('#getMethodAuthorization()', () => {
    it('should return properties with AuthorizationType: NONE if no authorizer provided', () => {
      const event = {
        path: 'foo/bar1',
        method: 'post',
      };

      expect(serverlessStepFunctions.getMethodAuthorization(event)
              .Properties.AuthorizationType).to.equal('NONE');
    });

    it('should return resource properties with AuthorizationType: AWS_IAM', () => {
      const event = {
        authorizer: {
          type: 'AWS_IAM',
          authorizerId: 'foo12345',
        },
      };

      expect(serverlessStepFunctions.getMethodAuthorization(event)
              .Properties.AuthorizationType).to.equal('AWS_IAM');
    });

    it('should return properties with AuthorizationType: CUSTOM and authotizerId', () => {
      const event = {
        authorizer: {
          type: 'CUSTOM',
          authorizerId: 'foo12345',
        },
      };

      expect(serverlessStepFunctions.getMethodAuthorization(event)
              .Properties.AuthorizationType).to.equal('CUSTOM');
      expect(serverlessStepFunctions.getMethodAuthorization(event)
              .Properties.AuthorizerId).to.equal('foo12345');
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

      const autorization = serverlessStepFunctions.getMethodAuthorization(event);
      expect(autorization.Properties.AuthorizationType)
              .to.equal('CUSTOM');

      expect(autorization.Properties.AuthorizerId)
              .to.deep.equal({ Ref: 'AuthorizerApiGatewayAuthorizer' });
    });

    it('should return properties with AuthorizationType: COGNITO_USER_POOLS', () => {
      const event = {
        authorizer: {
          name: 'authorizer',
          arn: 'arn:aws:cognito-idp:us-east-1:xxx:userpool/us-east-1_ZZZ',
        },
      };

      const autorization = serverlessStepFunctions.getMethodAuthorization(event);
      expect(autorization.Properties.AuthorizationType)
              .to.equal('COGNITO_USER_POOLS');
      expect(autorization.Properties.AuthorizerId)
              .to.deep.equal({ Ref: 'AuthorizerApiGatewayAuthorizer' });
    });
  });
});
