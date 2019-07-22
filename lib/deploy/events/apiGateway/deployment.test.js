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
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.apiGatewayMethodLogicalIds = ['method-dependency1', 'method-dependency2'];
  });

  it('should create a deployment resource', () => serverlessStepFunctions
    .compileDeployment().then(() => {
      const apiGatewayDeploymentLogicalId = Object
        .keys(serverlessStepFunctions.serverless.service.provider
          .compiledCloudFormationTemplate.Resources)[0];

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

  it('should add service endpoint output', () => serverlessStepFunctions.compileDeployment().then(() => {
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
