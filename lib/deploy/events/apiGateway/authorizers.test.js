'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider');
const ServerlessStepFunctions = require('./../../../index');

describe('#compileAuthorizers()', () => {
  let awsCompileApigEvents;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    const serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.service = 'first-service';
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    awsCompileApigEvents = new ServerlessStepFunctions(serverless, options);
    awsCompileApigEvents.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    awsCompileApigEvents.validated = {};
  });

  it('should create an authorizer with minimal configuration', () => {
    awsCompileApigEvents.validated.events = [
      {
        http: {
          path: 'users/create',
          method: 'POST',
          authorizer: {
            name: 'authorizer',
            arn: { 'Fn::GetAtt': ['SomeLambdaFunction', 'Arn'] },
            resultTtlInSeconds: 300,
            identitySource: 'method.request.header.Authorization',
          },
        },
      },
    ];

    return awsCompileApigEvents.compileAuthorizers().then(() => {
      const resource = awsCompileApigEvents.serverless.service.provider
        .compiledCloudFormationTemplate.Resources.AuthorizerApiGatewayAuthorizer;

      expect(resource.Type).to.equal('AWS::ApiGateway::Authorizer');
      expect(resource.Properties.AuthorizerResultTtlInSeconds).to.equal(300);
      expect(resource.Properties.AuthorizerUri).to.deep.equal({
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':apigateway:',
            { Ref: 'AWS::Region' },
            ':lambda:path/2015-03-31/functions/',
            { 'Fn::GetAtt': ['SomeLambdaFunction', 'Arn'] },
            '/invocations',
          ],
        ],
      });
      expect(resource.Properties.IdentitySource).to.equal('method.request.header.Authorization');
      expect(resource.Properties.IdentityValidationExpression).to.equal(undefined);
      expect(resource.Properties.Name).to.equal('authorizer');
      expect(resource.Properties.RestApiId.Ref).to.equal('ApiGatewayRestApi');
      expect(resource.Properties.Type).to.equal('TOKEN');
    });
  });

  it('should create an authorizer with provided configuration', () => {
    awsCompileApigEvents.validated.events = [
      {
        http: {
          path: 'users/create',
          method: 'POST',
          authorizer: {
            name: 'authorizer',
            arn: 'foo',
            resultTtlInSeconds: 500,
            identitySource: 'method.request.header.Custom',
            identityValidationExpression: 'regex',
          },
        },
      },
    ];

    return awsCompileApigEvents.compileAuthorizers().then(() => {
      const resource = awsCompileApigEvents.serverless.service.provider
        .compiledCloudFormationTemplate.Resources.AuthorizerApiGatewayAuthorizer;

      expect(resource.Type).to.equal('AWS::ApiGateway::Authorizer');
      expect(resource.Properties.AuthorizerUri).to.deep.equal({
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':apigateway:',
            { Ref: 'AWS::Region' },
            ':lambda:path/2015-03-31/functions/',
            'foo',
            '/invocations',
          ],
        ],
      });
      expect(resource.Properties.AuthorizerResultTtlInSeconds).to.equal(500);
      expect(resource.Properties.IdentitySource).to.equal('method.request.header.Custom');
      expect(resource.Properties.IdentityValidationExpression).to.equal('regex');
      expect(resource.Properties.Name).to.equal('authorizer');
      expect(resource.Properties.RestApiId.Ref).to.equal('ApiGatewayRestApi');
      expect(resource.Properties.Type).to.equal('TOKEN');
    });
  });

  it('should apply optional provided type value to Authorizer Type', () => {
    awsCompileApigEvents.validated.events = [
      {
        http: {
          path: 'users/create',
          method: 'POST',
          authorizer: {
            name: 'authorizer',
            arn: 'foo',
            resultTtlInSeconds: 500,
            identityValidationExpression: 'regex',
            type: 'request',
          },
        },
      },
    ];

    return awsCompileApigEvents.compileAuthorizers().then(() => {
      const resource = awsCompileApigEvents.serverless.service.provider
        .compiledCloudFormationTemplate.Resources.AuthorizerApiGatewayAuthorizer;

      expect(resource.Type).to.equal('AWS::ApiGateway::Authorizer');
      expect(resource.Properties.Type).to.equal('REQUEST');
    });
  });

  it('should apply TOKEN as authorizer Type when not given a type value', () => {
    awsCompileApigEvents.validated.events = [
      {
        http: {
          path: 'users/create',
          method: 'POST',
          authorizer: {
            name: 'authorizer',
            arn: 'foo',
            resultTtlInSeconds: 500,
            identityValidationExpression: 'regex',
          },
        },
      },
    ];

    return awsCompileApigEvents.compileAuthorizers().then(() => {
      const resource = awsCompileApigEvents.serverless.service.provider
        .compiledCloudFormationTemplate.Resources
        .AuthorizerApiGatewayAuthorizer;

      expect(resource.Type).to.equal('AWS::ApiGateway::Authorizer');
      expect(resource.Properties.Type).to.equal('TOKEN');
    });
  });

  it('should create a valid cognito user pool authorizer', () => {
    awsCompileApigEvents.validated.events = [
      {
        http: {
          path: 'users/create',
          method: 'POST',
          authorizer: {
            name: 'authorizer',
            arn: 'arn:aws:cognito-idp:us-east-1:xxx:userpool/us-east-1_ZZZ',
          },
        },
      },
    ];

    return awsCompileApigEvents.compileAuthorizers().then(() => {
      const resource = awsCompileApigEvents.serverless.service.provider
        .compiledCloudFormationTemplate.Resources
        .AuthorizerApiGatewayAuthorizer;

      expect(resource.Properties.Name).to.equal('authorizer');

      expect(resource.Properties.ProviderARNs[0]).to.equal(
        'arn:aws:cognito-idp:us-east-1:xxx:userpool/us-east-1_ZZZ',
      );

      expect(resource.Properties.Type).to.equal('COGNITO_USER_POOLS');
    });
  });

  it('should create a valid cognito user pool authorizer using Fn::GetAtt', () => {
    awsCompileApigEvents.validated.events = [
      {
        http: {
          path: 'users/create',
          method: 'POST',
          authorizer: {
            name: 'authorizer',
            type: 'COGNITO_USER_POOLS',
            arn: {
              'Fn::GetAtt': ['CognitoUserPool', 'Arn'],
            },
          },
        },
      },
    ];

    return awsCompileApigEvents.compileAuthorizers().then(() => {
      const resource = awsCompileApigEvents.serverless.service.provider
        .compiledCloudFormationTemplate.Resources
        .AuthorizerApiGatewayAuthorizer;

      expect(resource.Properties.Name).to.equal('authorizer');

      expect(resource.Properties.ProviderARNs[0]).to.deep.equal({
        'Fn::GetAtt': ['CognitoUserPool', 'Arn'],
      });

      expect(resource.Properties.Type).to.equal('COGNITO_USER_POOLS');
    });
  });
});
