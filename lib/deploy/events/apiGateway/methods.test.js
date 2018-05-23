'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#methods()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
    };

    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {},
      },
    };
    serverlessStepFunctions.apiGatewayResourceLogicalIds
      = { 'foo/bar': 'apiGatewayResourceLogicalId' };
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
          },
        },
        {
          stateMachineName: 'first',
          http: {
            path: 'foo/bar2',
            method: 'post',
            private: true,
          },
        },
      ],
    };
  });

  describe('#compileMethods()', () => {
    it('should create a method resource', () => serverlessStepFunctions
      .compileMethods().then(() => {
        expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources)
          .to.have.property('ApiGatewayMethodapiGatewayResourceNamesFirstPost');
      })
    );

    it('should verify if http private parameter is correctly passed to resource',
      () => serverlessStepFunctions
        .compileMethods().then(() => {
          const resources = serverlessStepFunctions
            .serverless.service.provider.compiledCloudFormationTemplate.Resources;

          expect(resources.ApiGatewayMethodapiGatewayResourceNamesFirstPost
            .Properties.ApiKeyRequired).to.eql(false);
          expect(resources.ApiGatewayMethodapiGatewayResourceNamesSecondPost
            .Properties.ApiKeyRequired).to.eql(true);
        })
    );
  });

  describe('#getMethodIntegration()', () => {
    it('should return a corresponding Integration resource', () => {
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine').Properties)
        .to.have.property('Integration');
    });

    // Remove these 2 specs
    it('should set stateMachinelogical ID to RequestTemplates when customName is not set', () => {
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine').Properties
        .Integration.RequestTemplates['application/json']['Fn::Join'][1][2].Ref)
        .to.be.equal('StateMachineStepFunctionsStateMachine');
    });

    it('should set custom stateMachinelogical ID to RequestTemplates when customName is set',
    () => {
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine', 'custom').Properties
        .Integration.RequestTemplates['application/json']['Fn::Join'][1][2].Ref)
        .to.be.equal('Custom');
    });

    it('should set Access-Control-Allow-Origin header when cors is true',
    () => {
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine', 'custom', {
        cors: {
          origins: ['*', 'http://example.com'],
        },
      }).Properties.Integration.IntegrationResponses[0]
      .ResponseParameters['method.response.header.Access-Control-Allow-Origin'])
      .to.equal('\'*,http://example.com\'');

      expect(serverlessStepFunctions.getMethodIntegration('stateMachine', 'custom', {
        cors: {
          origin: '*',
        },
      }).Properties.Integration.IntegrationResponses[0]
      .ResponseParameters['method.response.header.Access-Control-Allow-Origin'])
      .to.equal('\'*\'');
    });
  });

  describe('#getIntegrationRequestTemplates()', () => {
    it('should set stateMachinelogical ID in default templates when customName is not set', () => {
      expect(serverlessStepFunctions.getIntegrationRequestTemplates('stateMachine')
        ['application/json']['Fn::Join'][1][2].Ref)
        .to.be.equal('StateMachineStepFunctionsStateMachine');
    });

    it('should set custom stateMachinelogical ID in default templates when customName is set',
    () => {
      expect(serverlessStepFunctions.getIntegrationRequestTemplates('stateMachine', 'custom')
        ['application/json']['Fn::Join'][1][2].Ref)
        .to.be.equal('Custom');
    });

    it('should return the default template for application/json when one is not given', () => {
      const http_without_request_template = {
        path: 'foo/bar1',
        method: 'post',
        request: {
          template: {
            'application/x-www-form-urlencoded': 'custom template'
          }
        }
      }
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine', undefined, http_without_request_template)
        .Properties.Integration.RequestTemplates['application/json']['Fn::Join'][1][2].Ref)
        .to.be.equal('StateMachineStepFunctionsStateMachine');
    });

    it('should return a custom template for application/json when one is given', () => {
      const http_with_request_template = {
        path: 'foo/bar1',
        method: 'post',
        request: {
          template: {
            'application/json': 'custom template'
          }
        }
      }
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine', undefined, http_with_request_template)
        .Properties.Integration.RequestTemplates['application/json'])
        .to.be.equal('custom template');
    });

    it('should return the default template for application/x-www-form-urlencoded when one is not given', () => {
      const http_without_request_template = {
        path: 'foo/bar1',
        method: 'post',
        request: {
          template: {
            'application/json': 'custom template'
          }
        }
      }
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine', undefined, http_without_request_template)
        .Properties.Integration.RequestTemplates['application/x-www-form-urlencoded']['Fn::Join'][1][2].Ref)
        .to.be.equal('StateMachineStepFunctionsStateMachine');
    });

    it('should return a custom template for application/x-www-form-urlencoded when one is given', () => {
      const http_with_request_template = {
        path: 'foo/bar1',
        method: 'post',
        request: {
          template: {
            'application/x-www-form-urlencoded': 'custom template'
          }
        }
      }
      expect(serverlessStepFunctions.getMethodIntegration('stateMachine', undefined, http_with_request_template)
        .Properties.Integration.RequestTemplates['application/x-www-form-urlencoded'])
        .to.be.equal('custom template');
    });
  });

  describe('#getMethodResponses()', () => {
    it('should return a corresponding methodResponses resource', () => {
      expect(serverlessStepFunctions.getMethodResponses().Properties)
        .to.have.property('MethodResponses');
    });

    it('should set Access-Control-Allow-Origin header when cors is true',
    () => {
      expect(serverlessStepFunctions.getMethodResponses({
        cors: {
          origins: ['*', 'http://example.com'],
        },
      }).Properties.MethodResponses[0]
      .ResponseParameters['method.response.header.Access-Control-Allow-Origin'])
      .to.equal('\'*,http://example.com\'');

      expect(serverlessStepFunctions.getMethodResponses({
        cors: {
          origin: '*',
        },
      }).Properties.MethodResponses[0]
      .ResponseParameters['method.response.header.Access-Control-Allow-Origin'])
      .to.equal('\'*\'');
    });
  });
});
