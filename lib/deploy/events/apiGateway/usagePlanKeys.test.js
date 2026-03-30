'use strict';

const expect = require('chai').expect;
const createServerless = require('../../../test/createServerless');
const ServerlessStepFunctions = require('../../..');

describe('#compileUsagePlanKeys()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = createServerless();
    serverless.service.service = 'first-service';
    serverless.service.provider = {
      name: 'aws',
      apiGateway: { apiKeys: ['1234567890'] },
    };
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.apiGatewayDeploymentLogicalId = 'ApiGatewayDeploymentTest';
    serverlessStepFunctions.apiGatewayUsagePlanLogicalId = 'UsagePlan';
  });

  it('should compile usage plan key resource', () => serverlessStepFunctions.compileUsagePlanKeys()
    .then(() => {
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
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = 2;
    expect(() => serverlessStepFunctions.compileUsagePlanKeys()).to.throw(Error);
  });

  it('throw error if an apiKey is not a string or object', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = [2];
    expect(() => serverlessStepFunctions.compileUsagePlanKeys()).to.throw(Error);
  });

  it('should compile usage plan key resource when apiKey is an object with value only', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = [
      { value: 'myKeyValue' },
    ];
    return serverlessStepFunctions.compileUsagePlanKeys().then(() => {
      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources[
            serverlessStepFunctions.provider.naming.getUsagePlanKeyLogicalId(1)
          ].Type,
      ).to.equal('AWS::ApiGateway::UsagePlanKey');
    });
  });

  it('should compile usage plan key resource when apiKey is an object with name and value', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway.apiKeys = [
      { name: 'myKey', value: 'myKeyValue' },
    ];
    return serverlessStepFunctions.compileUsagePlanKeys().then(() => {
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
    });
  });
});
