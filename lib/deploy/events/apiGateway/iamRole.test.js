'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');
const path = require('path');

describe('#compileHttpIamRole()', () => {
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

  it('should create a IAM Role resource', () => serverlessStepFunctions
    .compileHttpIamRole().then(() => {
      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources.ApigatewayToStepFunctionsRole.Type
      ).to.equal('AWS::IAM::Role');
    })
  );
});
