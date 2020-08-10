'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#compileDeployment()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.instanceId = '1234';
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.apiGatewayMethodLogicalIds = ['method-dependency1', 'method-dependency2'];
  });

  describe('when there are no API Gateway deployment resource', () => {
    it('should create a deployment resource', () => serverlessStepFunctions
      .compileDeployment().then(() => {
        const apiGatewayDeploymentLogicalId = Object
          .keys(serverlessStepFunctions.serverless.service.provider
            .compiledCloudFormationTemplate.Resources)[0];

        // eslint-disable-next-line no-unused-expressions
        expect(apiGatewayDeploymentLogicalId.endsWith('1234')).to.be.true;
        expect(
          serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
            .Resources[apiGatewayDeploymentLogicalId],
        ).to.deep.equal({
          Type: 'AWS::ApiGateway::Deployment',
          DependsOn: ['method-dependency1', 'method-dependency2'],
          Properties: {
            RestApiId: { Ref: serverlessStepFunctions.apiGatewayRestApiLogicalId },
            StageName: 'dev',
          },
        });
      }));

    it('should add service endpoint output', () => serverlessStepFunctions
      .compileDeployment().then(() => {
        expect(
          serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
            .Outputs.ServiceEndpoint,
        ).to.deep.equal({
          Description: 'URL of the service endpoint',
          Value: {
            'Fn::Join': [
              '',
              [
                'https://',
                { Ref: serverlessStepFunctions.apiGatewayRestApiLogicalId },
                '.execute-api.',
                { Ref: 'AWS::Region' },
                '.',
                { Ref: 'AWS::URLSuffix' },
                '/dev',
              ],
            ],
          },
        });
      }));
  });

  describe('when there is an existing API Gateway deployment resource', () => {
    beforeEach(() => {
      serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources.ApiGatewayDeployment1234 = {
          Type: 'AWS::ApiGateway::Deployment',
          Properties: {
            RestApiId: {
              Ref: 'ApiGatewayRestApi',
            },
            StageName: 'dev',
          },
          DependsOn: [
            'ApiGatewayMethodGet',
            'ApiGatewayMethodPost',
          ],
        };
    });

    it('should append to existing deployment resource', () => serverlessStepFunctions
      .compileDeployment().then(() => {
        const resourceKeys = Object
          .keys(serverlessStepFunctions.serverless.service.provider
            .compiledCloudFormationTemplate.Resources);
        expect(resourceKeys).to.have.length(1);

        const apiGatewayDeploymentLogicalId = resourceKeys[0];

        expect(apiGatewayDeploymentLogicalId).to.equal('ApiGatewayDeployment1234');
        expect(
          serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
            .Resources[apiGatewayDeploymentLogicalId],
        ).to.deep.equal({
          Type: 'AWS::ApiGateway::Deployment',
          Properties: {
            RestApiId: { Ref: serverlessStepFunctions.apiGatewayRestApiLogicalId },
            StageName: 'dev',
          },
          DependsOn: [
            'ApiGatewayMethodGet',
            'ApiGatewayMethodPost',
            'method-dependency1',
            'method-dependency2',
          ],
        });
      }));
  });
});
