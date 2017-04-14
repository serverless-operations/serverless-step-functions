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
        },
      },
    },
  };

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.service.service = 'new-service';
    serverless.service.stepfunctions = {
      stateMachines: {
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
      },
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  it('should create a REST API resource', () => serverlessStepFunctions
    .compileRestApi().then(() => {
      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources
      ).to.deep.equal(
        serviceResourcesAwsResourcesObjectMock.Resources
      );
    })
  );
});
