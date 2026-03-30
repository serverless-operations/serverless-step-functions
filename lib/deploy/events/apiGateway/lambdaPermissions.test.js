'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const createServerless = require('../../../test/createServerless');
const ServerlessStepFunctions = require('../../..');

describe('#compileHttpLambdaPermissions()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = createServerless();
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.service.service = 'new-service';
    serverless.service.stepfunctions = {
      stateMachines: {
        first: {
        },
      },
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  it('should not create a Lambda Permission resource when there are no Lambda authorizers', () => {
    serverlessStepFunctions.compileHttpLambdaPermissions().then(() => {
      const resources = serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources;
      const lambdaPermissions = _.values(resources)
        .filter((x) => x.Type === 'AWS::Lambda::Permission');
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
      const lambdaPermissions = _.values(resources)
        .filter((x) => x.Type === 'AWS::Lambda::Permission');
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
      const lambdaPermissions = _.values(resources)
        .filter((x) => x.Type === 'AWS::Lambda::Permission');
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

  it('should create a Lambda Permission resource when there is an ARN authorizer', () => {
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
                'arn:aws:lambda:us-east-1:000000000000:function:remote-authorizer',
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
      const lambdaPermissions = _.values(resources)
        .filter((x) => x.Type === 'AWS::Lambda::Permission');
      expect(lambdaPermissions).to.have.lengthOf(1);
      expect(lambdaPermissions[0]).to.deep.eq({
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: 'arn:aws:lambda:us-east-1:000000000000:function:remote-authorizer',
          Action: 'lambda:InvokeFunction',
          Principal: {
            'Fn::Sub': 'apigateway.${AWS::URLSuffix}',
          },
        },
      });
    });
  });
});
