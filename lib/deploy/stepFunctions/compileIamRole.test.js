'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../index');

describe('stateMachine', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };

    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  describe('#compileIamRole()', () => {
    it('should do nothing when role property exists in all statmachine properties', () => {
      serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine1: {
            definition: 'definition',
            role: 'role',
          },
          myStateMachine2: {
            definition: 'definition',
            role: 'role',
          },
        },
      };

      serverlessStepFunctions.compileIamRole();
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
      ).to.deep.equal({});
    });

    it('should create corresponding resources when role property are not given', () => {
      serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine1: {
            definition: 'definition',
            role: 'role',
          },
          myStateMachine2: {
            definition: 'definition',
          },
        },
      };

      serverlessStepFunctions.compileIamRole();
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.IamRoleStateMachineExecution.Type
      ).to.equal('AWS::IAM::Role');
    });
  });
});
