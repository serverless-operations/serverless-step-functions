'use strict';

const expect = require('chai').expect;
const createServerless = require('../../../test/createServerless');
const ServerlessStepFunctions = require('../../..');

describe('#requestValidator()', () => {
  let serverless;
  let serverlessStepFunctions;

  function setup(events, providerApiGateway) {
    const options = { stage: 'dev', region: 'us-east-1' };

    serverless = createServerless();
    serverless.service.service = 'step-functions';
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {
        ApiGatewayMethodFirstPost: { Properties: {} },
        ApiGatewayMethodSecondPost: { Properties: {} },
      },
    };

    if (providerApiGateway) {
      serverless.service.provider.apiGateway = providerApiGateway;
    }

    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.apiGatewayResourceNames = {
      'foo/bar1': 'apiGatewayResourceNamesFirst',
      'foo/bar2': 'apiGatewayResourceNamesSecond',
    };
    serverlessStepFunctions.apiGatewayResources = {
      'foo/bar1': { name: 'First', resourceLogicalId: 'ApiGatewayResourceFirst' },
      'foo/bar2': { name: 'Second', resourceLogicalId: 'ApiGatewayResourceSecond' },
    };
    serverlessStepFunctions.pluginhttpValidated = { events };
  }

  function getResources() {
    return serverlessStepFunctions.serverless.service.provider
      .compiledCloudFormationTemplate.Resources;
  }

  describe('#compileRequestValidators()', () => {
    it('should create a model and validator for a schema object with explicit schema property', () => {
      setup([{
        stateMachineName: 'first',
        http: {
          path: 'foo/bar1',
          method: 'post',
          request: {
            schemas: {
              'application/json': {
                name: 'StartExecutionSchema',
                schema: { type: 'object' },
              },
            },
          },
        },
      }]);

      return serverlessStepFunctions.compileRequestValidators().then(() => {
        const resources = getResources();
        expect(resources).to.have.property('ApiGatewayMethodFirstPostApplicationJsonModel');
        expect(resources).to.have.property('ApiGatewayStepfunctionsRequestValidator');
        const model = resources.ApiGatewayMethodFirstPostApplicationJsonModel;
        expect(model.Properties.Name).to.equal('StartExecutionSchema');
        expect(model.Properties.Schema).to.deep.equal({ type: 'object' });
      });
    });

    it('should use the whole object as schema when schema object has no explicit schema property', () => {
      const implicitSchema = { type: 'object', properties: { id: { type: 'string' } } };
      setup([{
        stateMachineName: 'first',
        http: {
          path: 'foo/bar1',
          method: 'post',
          request: {
            schemas: {
              'application/json': implicitSchema,
            },
          },
        },
      }]);

      return serverlessStepFunctions.compileRequestValidators().then(() => {
        const resources = getResources();
        expect(resources).to.have.property('ApiGatewayMethodFirstPostApplicationJsonModel');
        const model = resources.ApiGatewayMethodFirstPostApplicationJsonModel;
        expect(model.Properties.Schema).to.deep.equal(implicitSchema);
        expect(model.Properties.Name).to.equal(undefined);
      });
    });

    it('should use a plain string as schema definition when schemaConfig is a string not referencing a provider model', () => {
      setup([{
        stateMachineName: 'first',
        http: {
          path: 'foo/bar1',
          method: 'post',
          request: {
            schemas: {
              'application/json': 'arn:aws:apigateway:us-east-1::/restapis/foo/models/bar',
            },
          },
        },
      }]);

      return serverlessStepFunctions.compileRequestValidators().then(() => {
        const resources = getResources();
        expect(resources).to.have.property('ApiGatewayMethodFirstPostApplicationJsonModel');
        const model = resources.ApiGatewayMethodFirstPostApplicationJsonModel;
        expect(model.Properties.Schema).to.equal('arn:aws:apigateway:us-east-1::/restapis/foo/models/bar');
      });
    });

    it('should not create a validator when no schemas are defined on the event', () => {
      setup([{
        stateMachineName: 'first',
        http: {
          path: 'foo/bar1',
          method: 'post',
        },
      }]);

      return serverlessStepFunctions.compileRequestValidators().then(() => {
        const resources = getResources();
        expect(resources).to.not.have.property('ApiGatewayStepfunctionsRequestValidator');
      });
    });
  });

  describe('#createProviderModel()', () => {
    it('should create a model resource using a provider-level schema reference', () => {
      setup(
        [{
          stateMachineName: 'first',
          http: {
            path: 'foo/bar1',
            method: 'post',
            request: {
              schemas: {
                'application/json': 'CreateRequest',
              },
            },
          },
        }],
        {
          request: {
            schemas: {
              CreateRequest: {
                schema: { type: 'object' },
              },
            },
          },
        },
      );

      return serverlessStepFunctions.compileRequestValidators().then(() => {
        const resources = getResources();
        expect(resources).to.have.property('ApiGatewayCreateRequestModel');
        const model = resources.ApiGatewayCreateRequestModel;
        expect(model.Properties.Schema).to.deep.equal({ type: 'object' });
        expect(model.Properties.ContentType).to.equal('application/json');
      });
    });

    it('should set Name on provider model when schemaConfig.name is present', () => {
      setup(
        [{
          stateMachineName: 'first',
          http: {
            path: 'foo/bar1',
            method: 'post',
            request: { schemas: { 'application/json': 'CreateRequest' } },
          },
        }],
        {
          request: {
            schemas: {
              CreateRequest: {
                name: 'MyModel',
                schema: { type: 'object' },
              },
            },
          },
        },
      );

      return serverlessStepFunctions.compileRequestValidators().then(() => {
        const model = getResources().ApiGatewayCreateRequestModel;
        expect(model.Properties.Name).to.equal('MyModel');
      });
    });

    it('should set Description on provider model when schemaConfig.description is present', () => {
      setup(
        [{
          stateMachineName: 'first',
          http: {
            path: 'foo/bar1',
            method: 'post',
            request: { schemas: { 'application/json': 'CreateRequest' } },
          },
        }],
        {
          request: {
            schemas: {
              CreateRequest: {
                description: 'Request payload for create',
                schema: { type: 'object' },
              },
            },
          },
        },
      );

      return serverlessStepFunctions.compileRequestValidators().then(() => {
        const model = getResources().ApiGatewayCreateRequestModel;
        expect(model.Properties.Description).to.equal('Request payload for create');
      });
    });

    it('should use the whole schemaConfig as definition when no schema property is present', () => {
      const rawSchema = { type: 'object', properties: { id: { type: 'string' } } };
      setup(
        [{
          stateMachineName: 'first',
          http: {
            path: 'foo/bar1',
            method: 'post',
            request: { schemas: { 'application/json': 'CreateRequest' } },
          },
        }],
        {
          request: {
            schemas: {
              CreateRequest: rawSchema,
            },
          },
        },
      );

      return serverlessStepFunctions.compileRequestValidators().then(() => {
        const model = getResources().ApiGatewayCreateRequestModel;
        expect(model.Properties.Schema).to.deep.equal(rawSchema);
      });
    });
  });
});
