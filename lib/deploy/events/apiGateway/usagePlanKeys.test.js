'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#compileUsagePlanKeys()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless, options));
    serverless.service.service = 'first-service';
    serverless.service.provider = {
      name: 'aws',
      apiKeys: ['1234567890'],
    };
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.apiGatewayDeploymentLogicalId = 'ApiGatewayDeploymentTest';
    serverlessStepFunctions.apiGatewayUsagePlanLogicalId = 'UsagePlan';
  });

  it('should compile usage plan key resource', () => serverlessStepFunctions.compileUsagePlanKeys().then(() => {
    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getUsagePlanKeyLogicalId(1)
        ].Type,
    ).to.equal('AWS::ApiGateway::UsagePlanKey');

    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getUsagePlanKeyLogicalId(1)
        ].Properties.KeyId.Ref,
    ).to.equal('ApiGatewayApiKey1');

    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getUsagePlanKeyLogicalId(1)
        ].Properties.KeyType,
    ).to.equal('API_KEY');

    expect(
      serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources[
          serverlessStepFunctions.provider.naming.getUsagePlanKeyLogicalId(1)
        ].Properties.UsagePlanId.Ref,
    ).to.equal('UsagePlan');
  }));

  it('throw error if apiKey property is not an array', () => {
    serverlessStepFunctions.serverless.service.provider.apiKeys = 2;
    expect(() => serverlessStepFunctions.compileUsagePlanKeys()).to.throw(Error);
  });

  it('throw error if an apiKey is not a string', () => {
    serverlessStepFunctions.serverless.service.provider.apiKeys = [2];
    expect(() => serverlessStepFunctions.compileUsagePlanKeys()).to.throw(Error);
  });
});
