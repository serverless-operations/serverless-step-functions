'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

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
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  it('should create an IAM Role resource when there are no iamRole overrides', () => {
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

    serverlessStepFunctions
      .compileHttpIamRole().then(() => {
        expect(
          serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
            .Resources.ApigatewayToStepFunctionsRole.Type,
        ).to.equal('AWS::IAM::Role');
      });
  });

  it('should create an IAM Role resource when at least one event has no iamRole override', () => {
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
            iamRole: 'arn:aws:iam::12345567890:role/test',
          },
        },
      ],
    };

    serverlessStepFunctions
      .compileHttpIamRole().then(() => {
        expect(
          serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
            .Resources.ApigatewayToStepFunctionsRole.Type,
        ).to.equal('AWS::IAM::Role');
      });
  });

  it('should not create an IAM Role resource when all events have iamRole override', () => {
    serverlessStepFunctions.pluginhttpValidated = {
      events: [
        {
          stateMachineName: 'first',
          http: {
            path: 'foo/bar1',
            method: 'post',
            iamRole: 'arn:aws:iam::12345567890:role/test1',
          },
        },
        {
          stateMachineName: 'first',
          http: {
            path: 'foo/bar2',
            method: 'post',
            iamRole: 'arn:aws:iam::12345567890:role/test2',
          },
        },
      ],
    };

    serverlessStepFunctions
      .compileHttpIamRole().then(() => {
        const resources = serverlessStepFunctions.serverless.service.provider
          .compiledCloudFormationTemplate.Resources;
        expect(resources).to.not.haveOwnProperty('ApigatewayToStepFunctionsRole');
      });
  });

  it('Should add DescribeExecution action when it is assigned in config', () => {
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
            action: 'DescribeExecution',
          },
        },
      ],
    };

    serverlessStepFunctions
      .compileHttpIamRole().then(() => {
        const properties = serverlessStepFunctions.serverless.service.provider
          .compiledCloudFormationTemplate.Resources.ApigatewayToStepFunctionsRole.Properties;
        expect(properties.Policies[0].PolicyDocument.Statement[0].Action)
          .to.deep.equal(['states:StartExecution', 'states:DescribeExecution']);
      });
  });

  it('Should not add DescribeExecution action when it is not assigned in config', () => {
    serverlessStepFunctions.pluginhttpValidated = {
      events: [
        {
          stateMachineName: 'first',
          http: {
            path: 'foo/bar1',
            method: 'post',
          },
        },
      ],
    };

    serverlessStepFunctions
      .compileHttpIamRole().then(() => {
        const properties = serverlessStepFunctions.serverless.service.provider
          .compiledCloudFormationTemplate.Resources.ApigatewayToStepFunctionsRole.Properties;
        expect(properties.Policies[0].PolicyDocument.Statement[0].Action)
          .to.deep.equal(['states:StartExecution']);
      });
  });
});
