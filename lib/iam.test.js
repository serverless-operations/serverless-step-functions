'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('iam', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.stepFunctions = {};
    serverless.service.functions = {
      first: {
        handler: true,
        name: 'first',
      },
    };

    const options = {
      stage: 'dev',
      region: 'us-east-1',
      function: 'first',
      functionObj: {
        name: 'first',
      },
      name: 'hellofunc',
      data: 'inputData',
    };

    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#getIamRoleName', () => {
    it('should return IamRoleName', () => {
      expect(serverlessStepFunctions.getIamRoleName('state'))
      .to.be.equal('step-functions-us-east-1-dev-state-ssf-exerole');
    });
  });

  describe('#getIamPolicyName', () => {
    it('should return IamPolicyName', () => {
      expect(serverlessStepFunctions.getIamPolicyName('state'))
      .to.be.equal('step-functions-us-east-1-dev-state-ssf-exepolicy');
    });
  });

  describe('#getIamRole()', () => {
    let getRoleStub;
    beforeEach(() => {
      getRoleStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Role: { Arn: 'roleArn' } }));
    });

    it('should getIamRole with correct params', () => serverlessStepFunctions.getIamRole('state')
      .then(() => {
        expect(getRoleStub.calledOnce).to.be.equal(true);
        expect(getRoleStub.calledWithExactly(
          'IAM',
          'getRole',
          {
            RoleName: 'step-functions-us-east-1-dev-state-ssf-exerole',
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.iamRoleArn.state).to.be.equal('roleArn');
        serverlessStepFunctions.provider.request.restore();
      })
    );

    it('should createRole when statusCode is 404', () => {
      serverlessStepFunctions.provider.request.restore();
      const getRoleErrorStub = sinon.stub(serverlessStepFunctions.provider, 'request')
       .returns(BbPromise.reject({ statusCode: 404 }));
      const createIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'createIamRole').returns(BbPromise.resolve());

      serverlessStepFunctions.getIamRole().catch(() => {
        expect(createIamRoleStub.calledOnce).to.be.equal(true);
        expect(getRoleErrorStub.calledOnce).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
        serverlessStepFunctions.createIamRole.restore();
      });
    });

    it('should throw error when statusCode is not 404', () => {
      serverlessStepFunctions.provider.request.restore();
      const getRoleErrorStub = sinon.stub(serverlessStepFunctions.provider, 'request')
       .returns(BbPromise.reject({ statusCode: 502 }));

      serverlessStepFunctions.getIamRole().catch((error) => {
        expect(getRoleErrorStub.calledOnce).to.be.equal(true);
        expect(error.name).to.be.equal('ServerlessError');
        serverlessStepFunctions.provider.request.restore();
      });
    });
  });

  describe('#createIamRole()', () => {
    let createIamRoleStub;
    beforeEach(() => {
      createIamRoleStub = sinon.stub(serverlessStepFunctions.provider, 'request');
      createIamRoleStub.onFirstCall().returns(BbPromise.resolve({ Role: { Arn: 'roleArn' } }));
      createIamRoleStub.onSecondCall().returns(BbPromise.resolve({ Policy: { Arn: 'policyArn' } }));
      createIamRoleStub.onThirdCall().returns(BbPromise.resolve());
    });

    it('should createIamRole with correct params', () => serverlessStepFunctions.createIamRole()
      .then(() => {
        expect(createIamRoleStub.calledThrice).to.be.equal(true);
        expect(createIamRoleStub.args[0][0]).to.be.equal('IAM');
        expect(createIamRoleStub.args[0][1]).to.be.equal('createRole');
        expect(createIamRoleStub.args[1][0]).to.be.equal('IAM');
        expect(createIamRoleStub.args[1][1]).to.be.equal('createPolicy');
        expect(createIamRoleStub.args[2][0]).to.be.equal('IAM');
        expect(createIamRoleStub.args[2][1]).to.be.equal('attachRolePolicy');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#deleteIamRole()', () => {
    let deleteIamRoleStub;
    beforeEach(() => {
      deleteIamRoleStub = sinon.stub(serverlessStepFunctions.provider, 'request');
      deleteIamRoleStub.onFirstCall().returns(BbPromise.resolve({ Account: 1234 }));
      deleteIamRoleStub.onSecondCall().returns(BbPromise.resolve());
      deleteIamRoleStub.onThirdCall().returns(BbPromise.resolve());
      deleteIamRoleStub.onCall(4).returns(BbPromise.resolve());
    });

    it('should deleteIamRole with correct params', () => serverlessStepFunctions.deleteIamRole()
      .then(() => {
        expect(deleteIamRoleStub.callCount).to.be.equal(4);
        expect(deleteIamRoleStub.args[0][0]).to.be.equal('STS');
        expect(deleteIamRoleStub.args[0][1]).to.be.equal('getCallerIdentity');
        expect(deleteIamRoleStub.args[1][0]).to.be.equal('IAM');
        expect(deleteIamRoleStub.args[1][1]).to.be.equal('detachRolePolicy');
        expect(deleteIamRoleStub.args[2][0]).to.be.equal('IAM');
        expect(deleteIamRoleStub.args[2][1]).to.be.equal('deletePolicy');
        expect(deleteIamRoleStub.args[3][0]).to.be.equal('IAM');
        expect(deleteIamRoleStub.args[3][1]).to.be.equal('deleteRole');
        serverlessStepFunctions.provider.request.restore();
      })
    );

    it('should deleteIamRole when 404 error', () => {
      serverlessStepFunctions.provider.request.restore();
      deleteIamRoleStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.reject({ statusCode: 404 }));
      serverlessStepFunctions.deleteIamRole()
      .then(() => {
        expect(deleteIamRoleStub.callCount).to.be.equal(1);
        serverlessStepFunctions.provider.request.restore();
      });
    });

    it('should other when other error', () => {
      serverlessStepFunctions.provider.request.restore();
      deleteIamRoleStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.reject({ statusCode: 500 }));
      serverlessStepFunctions.deleteIamRole()
      .catch(() => {
        expect(deleteIamRoleStub.callCount).to.be.equal(1);
        serverlessStepFunctions.provider.request.restore();
      });
    });
  });

  describe('#getIamRoles()', () => {
    let getIamRoleStub;
    beforeEach(() => {
      serverless.service.stepFunctions.stateMachines = {
        helloHello: 'value',
        hogeHoge: 'value',
        sssss: 'value',
      };
      getIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'getIamRole').returns(BbPromise.resolve());
    });

    it('should getIamRoles with correct params'
    , () => serverlessStepFunctions.getIamRoles()
      .then(() => {
        expect(getIamRoleStub.calledThrice).to.be.equal(true);
        serverlessStepFunctions.getIamRole.restore();
      })
    );
  });

  describe('#deleteIamRoles()', () => {
    let deleteIamRoleStub;
    beforeEach(() => {
      serverless.service.stepFunctions.stateMachines = {
        helloHello: 'value',
        hogeHoge: 'value',
      };
      deleteIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'deleteIamRole').returns(BbPromise.resolve());
    });

    it('should deleteIamRoles with correct params'
    , () => serverlessStepFunctions.deleteIamRoles()
      .then(() => {
        expect(deleteIamRoleStub.calledTwice).to.be.equal(true);
        serverlessStepFunctions.deleteIamRole.restore();
      })
    );
  });
});
