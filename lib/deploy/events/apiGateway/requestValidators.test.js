'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider');
const ServerlessStepFunctions = require('../../../index');

describe('#requestValidator()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };

    serverless = new Serverless();
    serverless.service.service = 'step-functions';
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {
        ApiGatewayMethodFirstPost: {
          Properties: {},
        },
      },
    };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };

    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.apiGatewayResourceNames = {
      'foo/bar1': 'apiGatewayResourceNamesFirst',
      'foo/bar2': 'apiGatewayResourceNamesSecond',
    };
    serverlessStepFunctions.pluginhttpValidated = {
      events: [
        {
          stateMachineName: 'first',
          http: {
            path: 'foo/bar1',
            method: 'post',
            request: {
              schemas: {
                'application/json': {
                  name: 'StartExecutionSchema',
                  schema: {},
                },
              },
            },
          },
        },
        {
          stateMachineName: 'second',
          http: {
            path: 'foo/bar2',
            method: 'post',
            private: true,
          },
        },
      ],
    };
    serverlessStepFunctions.apiGatewayResources = {
      'foo/bar1': {
        name: 'First',
        resourceLogicalId: 'ApiGatewayResourceFirst',
      },

      'foo/bar2': {
        name: 'Second',
        resourceLogicalId: 'ApiGatewayResourceSecond',
      },
    };
  });

  describe('#compileRequestValidators()', () => {
    it('should process schema from http event request schemas', () => serverlessStepFunctions
      .compileRequestValidators().then(() => {
        expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources)
          .to.have.property('ApiGatewayMethodFirstPostApplicationJsonModel');

        expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources)
          .to.have.property('ApiGatewayStepfunctionsRequestValidator');
      }));
  });
});
