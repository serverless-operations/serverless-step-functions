'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#methods()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
    };

    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {},
      },
    };
    serverlessStepFunctions.apiGatewayResourceLogicalIds = {
      'users/create': 'ApiGatewayResourceUsersCreate',
      'users/list': 'ApiGatewayResourceUsersList',
      'users/update': 'ApiGatewayResourceUsersUpdate',
      'users/delete': 'ApiGatewayResourceUsersDelete',
      'users/any': 'ApiGatewayResourceUsersAny',
    };
    serverlessStepFunctions.apiGatewayResourceNames = {
      'users/create': 'UsersCreate',
      'users/list': 'UsersList',
      'users/update': 'UsersUpdate',
      'users/delete': 'UsersDelete',
      'users/any': 'UsersAny',
    };
    serverlessStepFunctions.pluginhttpValidated = {};
  });

  it('should create preflight method for CORS enabled resource', () => {
    serverlessStepFunctions.pluginhttpValidated.corsPreflight = {
      'users/update': {
        origin: 'http://example.com',
        headers: ['*'],
        methods: ['OPTIONS', 'PUT'],
        allowCredentials: false,
      },
      'users/create': {
        origins: ['*', 'http://example.com'],
        headers: ['*'],
        methods: ['OPTIONS', 'POST'],
        allowCredentials: true,
      },
      'users/delete': {
        origins: ['*'],
        headers: ['CustomHeaderA', 'CustomHeaderB'],
        methods: ['OPTIONS', 'DELETE'],
        allowCredentials: false,
      },
      'users/any': {
        origins: ['http://example.com'],
        headers: ['*'],
        methods: ['OPTIONS', 'ANY'],
        allowCredentials: false,
      },
    };
    return serverlessStepFunctions.compileCors().then(() => {
      // users/create
      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersCreateOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin']
      ).to.equal('\'*,http://example.com\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersCreateOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Headers']
      ).to.equal('\'*\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersCreateOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Methods']
      ).to.equal('\'OPTIONS,POST\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersCreateOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Credentials']
      ).to.equal('\'true\'');

      // users/update
      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersUpdateOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin']
      ).to.equal('\'http://example.com\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersUpdateOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Methods']
      ).to.equal('\'OPTIONS,PUT\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersUpdateOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Credentials']
      ).to.equal('\'false\'');

      // users/delete
      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersDeleteOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin']
      ).to.equal('\'*\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersDeleteOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Headers']
      ).to.equal('\'CustomHeaderA,CustomHeaderB\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersDeleteOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Methods']
      ).to.equal('\'OPTIONS,DELETE\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersDeleteOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Credentials']
      ).to.equal('\'false\'');

      // users/any
      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersAnyOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Origin']
      ).to.equal('\'http://example.com\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersAnyOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Headers']
      ).to.equal('\'*\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersAnyOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Methods']
      ).to.equal('\'OPTIONS,DELETE,GET,HEAD,PATCH,POST,PUT\'');

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApiGatewayMethodUsersAnyOptions
          .Properties.Integration.IntegrationResponses[0]
          .ResponseParameters['method.response.header.Access-Control-Allow-Credentials']
      ).to.equal('\'false\'');
    });
  });
});
