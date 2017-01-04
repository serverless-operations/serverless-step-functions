'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('ServerlessStepFunctions', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;

    serverless.service.functions = {
      first: {
        handler: true,
      },
    };
    const options = {
      stage: 'dev',
      region: 'us-east-1',
      function: 'first',
      functionObj: {
        name: 'first',
      },
    };
    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(serverlessStepFunctions.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(serverlessStepFunctions.provider).to.be.instanceof(AwsProvider));

    it('should set the iamRoleName variable', () =>
      expect(serverlessStepFunctions.iamRoleName).to.be
      .equal('serverless-step-functions-executerole-us-east-1'));

    it('should set the iamPolicyName variable', () =>
      expect(serverlessStepFunctions.iamPolicyName).to.be
      .equal('serverless-step-functions-executepolicy-us-east-1'));

    it('should set an empty options object if no options are given', () => {
      const serverlessStepFunctionsWithEmptyOptions = new ServerlessStepFunctions(serverless);

      expect(serverlessStepFunctionsWithEmptyOptions.options).to.deep.equal({});
    });
  });
});
