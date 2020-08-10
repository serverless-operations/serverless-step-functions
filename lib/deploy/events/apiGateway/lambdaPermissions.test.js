'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#compileHttpLambdaPermissions()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.service.service = 'new-service';
    serverless.service.stepfunctions = {
      stateMachines: {
        first: {
        },
      },
    };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  it('should not create a Lambda Permission resource when there are no Lambda authorizers', () => {
    serverlessStepFunctions.compileHttpLambdaPermissions().then(() => {
      const resources = serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources;
      const lambdaPermissions = _.values(resources).filter(x => x.Type === 'AWS::Lambda::Permission');
      expect(lambdaPermissions).to.have.lengthOf(0);
    });
  });

  it('should create a Lambda Permission resource when there is a TOKEN authorizer', () => {
    serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.HelloApiGatewayAuthorizer = {
        Type: 'AWS::ApiGateway::Authorizer',
        Properties: {
          AuthorizerResultTtlInSeconds: 300,
          IdentitySource: 'method.request.header.Authorization',
          Name: 'hello',
          RestApiId: {
            Ref: 'ApiGatewayRestApi',
          },
          AuthorizerUri: {
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
                ':lambda:path/2015-03-31/functions/',
                {
                  'Fn::GetAtt': [
                    'HelloLambdaFunction',
                    'Arn',
                  ],
                },
                '/invocations',
              ],
            ],
          },
          Type: 'TOKEN',
        },
      };

    serverlessStepFunctions.compileHttpLambdaPermissions().then(() => {
      const resources = serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources;
      const lambdaPermissions = _.values(resources).filter(x => x.Type === 'AWS::Lambda::Permission');
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0]).to.deep.eq({
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: {
            'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'],
          },
          Action: 'lambda:InvokeFunction',
          Principal: {
            'Fn::Sub': 'apigateway.${AWS::URLSuffix}',
          },
        },
      });
    });
  });

  it('should create a Lambda Permission resource when there is a CUSTOM authorizer', () => {
    serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources.HelloApiGatewayAuthorizer = {
        Type: 'AWS::ApiGateway::Authorizer',
        Properties: {
          AuthorizerResultTtlInSeconds: 300,
          IdentitySource: 'method.request.header.Authorization',
          Name: 'hello',
          RestApiId: {
            Ref: 'ApiGatewayRestApi',
          },
          AuthorizerUri: {
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
                ':lambda:path/2015-03-31/functions/',
                {
                  'Fn::GetAtt': [
                    'HelloLambdaFunction',
                    'Arn',
                  ],
                },
                '/invocations',
              ],
            ],
          },
          Type: 'CUSTOM',
        },
      };

    serverlessStepFunctions.compileHttpLambdaPermissions().then(() => {
      const resources = serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources;
      const lambdaPermissions = _.values(resources).filter(x => x.Type === 'AWS::Lambda::Permission');
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0]).to.deep.eq({
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: {
            'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'],
          },
          Action: 'lambda:InvokeFunction',
          Principal: {
            'Fn::Sub': 'apigateway.${AWS::URLSuffix}',
          },
        },
      });
    });
  });
});
