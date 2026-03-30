'use strict';

const expect = require('chai').expect;
const createServerless = require('../../../test/createServerless');
const ServerlessStepFunctions = require('../../..');

describe('#methods()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = createServerless();
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    if (!serverless.service.provider.apiGateway) serverless.service.provider.apiGateway = {};
    serverless.service.provider.apiGateway.apiKeys = ['1234567890'];
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {},
      },
    };
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.apiGatewayDeploymentLogicalId = 'ApiGatewayDeploymentTest';
  });

  it('should compile api key resource', () => serverlessStepFunctions.compileApiKeys().then(() => {
    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ].Type,
    ).to.equal('AWS::ApiGateway::ApiKey');

    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ].Properties.Enabled,
    ).to.equal(true);

    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ].Properties.Name,
    ).to.equal('1234567890');

    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ].Properties.StageKeys[0].RestApiId.Ref,
    ).to.equal('ApiGatewayRestApi');

    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ].Properties.StageKeys[0].StageName,
    ).to.equal('dev');

    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ].DependsOn,
    ).to.equal('ApiGatewayDeploymentTest');
  }));

  it('throw error if apiKey property is not an array', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = 2;
    expect(() => serverlessStepFunctions.compileApiKeys()).to.throw(Error);
  });

  it('throw error if an apiKey is not a string or object', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = [2];
    expect(() => serverlessStepFunctions.compileApiKeys()).to.throw(Error);
  });

  it('should compile api key resource when apiKey is an object with name and value', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = [
      { name: 'my-api-key', value: 'my-secret-value' },
    ];
    return serverlessStepFunctions.compileApiKeys().then(() => {
      const resource = serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ];
      expect(resource.Type).to.equal('AWS::ApiGateway::ApiKey');
      expect(resource.Properties.Name).to.equal('my-api-key');
      expect(resource.Properties.Value).to.equal('my-secret-value');
      expect(resource.Properties.Enabled).to.equal(true);
    });
  });

  it('should compile api key resource when apiKey is an object with value only', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = [
      { value: 'my-secret-value' },
    ];
    return serverlessStepFunctions.compileApiKeys().then(() => {
      const resource = serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ];
      expect(resource.Type).to.equal('AWS::ApiGateway::ApiKey');
      expect(resource.Properties.Name).to.equal(undefined);
      expect(resource.Properties.Value).to.equal('my-secret-value');
    });
  });

  it('should compile api key resource when apiKey is an object with name only', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = [
      { name: 'my-api-key' },
    ];
    return serverlessStepFunctions.compileApiKeys().then(() => {
      const resource = serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources[
          serverlessStepFunctions.provider.naming.getApiKeyLogicalId(1)
        ];
      expect(resource.Type).to.equal('AWS::ApiGateway::ApiKey');
      expect(resource.Properties.Name).to.equal('my-api-key');
      expect(resource.Properties.Value).to.equal(undefined);
    });
  });
});
