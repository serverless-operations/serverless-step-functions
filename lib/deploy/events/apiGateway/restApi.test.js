'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#compileRestApi()', () => {
  let serverless;
  let serverlessStepFunctions;

  const serviceResourcesAwsResourcesObjectMock = {
    Resources: {
      ApiGatewayRestApi: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          Name: 'dev-new-service',
          EndpointConfiguration: {
            Types: ['EDGE'],
          },
        },
      },
    },
  };

  const serviceResourcesAwsResourcesObjectWithResourcePolicyMock = {
    Resources: {
      ApiGatewayRestApi: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          Name: 'dev-new-service',
          EndpointConfiguration: {
            Types: ['EDGE'],
          },
          Policy: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: 'execute-api:Invoke',
                Resource: ['execute-api:/*/*/*'],
                Condition: {
                  IpAddress: {
                    'aws:SourceIp': ['123.123.123.123'],
                  },
                },
              },
            ],
          },
        },
      },
    },
  };

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless, options));
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.serverless.service.service = 'new-service';
    serverlessStepFunctions.serverless.service.functions = {
      first: {
        events: [
          {
            http: {
              path: 'foo/bar',
              method: 'POST',
            },
          },
        ],
      },
    };
  });

  it('should create a REST API resource', () => serverlessStepFunctions.compileRestApi().then(() => {
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources).to.deep.equal(
      serviceResourcesAwsResourcesObjectMock.Resources,
    );
  }));

  it('should create a REST API resource with resource policy', () => {
    serverlessStepFunctions.serverless.service.provider.resourcePolicy = [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: 'execute-api:Invoke',
        Resource: ['execute-api:/*/*/*'],
        Condition: {
          IpAddress: {
            'aws:SourceIp': ['123.123.123.123'],
          },
        },
      },
    ];
    return serverlessStepFunctions.compileRestApi().then(() => {
      expect(serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources).to.deep.equal(
        serviceResourcesAwsResourcesObjectWithResourcePolicyMock.Resources,
      );
    });
  });

  it('should ignore REST API resource creation if there is predefined restApi config', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway = {
      restApiId: '6fyzt1pfpk',
      restApiRootResourceId: 'z5d4qh4oqi',
    };
    return serverlessStepFunctions.compileRestApi().then(() => {
      expect(serverlessStepFunctions.serverless.service.provider
        .compiledCloudFormationTemplate.Resources).to.deep.equal(
        {},
      );
    });
  });

  it('throw error if endpointType property is not a string', () => {
    serverlessStepFunctions.serverless.service.provider.endpointType = ['EDGE'];
    expect(() => serverlessStepFunctions.compileRestApi()).to.throw(Error);
  });

  it('should compile if endpointType property is REGIONAL', () => {
    serverlessStepFunctions.serverless.service.provider.endpointType = 'REGIONAL';
    expect(() => serverlessStepFunctions.compileRestApi()).to.not.throw(Error);
  });

  it('should compile if endpointType property is PRIVATE', () => {
    serverlessStepFunctions.serverless.service.provider.endpointType = 'PRIVATE';
    expect(() => serverlessStepFunctions.compileRestApi()).to.not.throw(Error);
  });

  it('throw error if endpointType property is not EDGE or REGIONAL', () => {
    serverlessStepFunctions.serverless.service.provider.endpointType = 'Testing';
    expect(() => serverlessStepFunctions.compileRestApi()).to.throw('endpointType must be one of');
  });
});
