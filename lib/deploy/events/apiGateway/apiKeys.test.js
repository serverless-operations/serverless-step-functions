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
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.apiKeys = ['1234567890'];
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
    };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
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
    serverlessStepFunctions.serverless.service.provider.apiKeys = 2;
    expect(() => serverlessStepFunctions.compileApiKeys()).to.throw(Error);
  });

  it('throw error if an apiKey is not a string', () => {
    serverlessStepFunctions.serverless.service.provider.apiKeys = [2];
    expect(() => serverlessStepFunctions.compileApiKeys()).to.throw(Error);
  });
});
