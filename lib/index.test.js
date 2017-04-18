'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const BbPromise = require('bluebird');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('#index', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.service.service = 'step-functions';
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(serverlessStepFunctions.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(serverlessStepFunctions.provider).to.be.instanceof(AwsProvider));

    it('should have access to the serverless instance', () =>
      expect(serverlessStepFunctions.serverless).to.deep.equal(serverless));

    it('should set the options variable', () =>
      expect(serverlessStepFunctions.options).to.deep.equal({
        stage: 'dev',
        region: 'us-east-1',
      })
    );

    it('should set the region variable', () =>
      expect(serverlessStepFunctions.region).to.be.equal('us-east-1'));

    it('should set the stage variable', () =>
      expect(serverlessStepFunctions.stage).to.be.equal('dev'));

    it('should run invoke:stepf:invoke promise chain in order', () => {
      const invokeStub = sinon
        .stub(serverlessStepFunctions, 'invoke').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['invoke:stepf:invoke']()
        .then(() => {
          expect(invokeStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.invoke.restore();
        });
    });

    it('should run deploy:initialize promise chain in order', () => {
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['deploy:initialize']()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.yamlParse.restore();
        });
    });

    it('should run deploy:compileFunctions promise chain in order', () => {
      const compileIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'compileIamRole').returns(BbPromise.resolve());
      const compileStateMachinesStub = sinon
        .stub(serverlessStepFunctions, 'compileStateMachines').returns(BbPromise.resolve());
      const compileActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'compileActivities').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['deploy:compileFunctions']()
        .then(() => {
          expect(compileIamRoleStub.calledOnce).to.be.equal(true);
          expect(compileStateMachinesStub.calledAfter(compileIamRoleStub)).to.be.equal(true);
          expect(compileActivitiesStub.calledAfter(compileStateMachinesStub)).to.be.equal(true);
          serverlessStepFunctions.compileIamRole.restore();
          serverlessStepFunctions.compileStateMachines.restore();
          serverlessStepFunctions.compileActivities.restore();
        });
    });

    it('should run deploy:compileEvents promise chain in order when http event is empty',
     () => {
       const httpValidateStub = sinon
         .stub(serverlessStepFunctions, 'httpValidate').returns({ events: [] });
       const compileRestApiStub = sinon
         .stub(serverlessStepFunctions, 'compileRestApi').returns(BbPromise.resolve());
       const compileResourcesStub = sinon
         .stub(serverlessStepFunctions, 'compileResources').returns(BbPromise.resolve());
       const compileMethodsStub = sinon
         .stub(serverlessStepFunctions, 'compileMethods').returns(BbPromise.resolve());
       const compileHttpIamRoleStub = sinon
         .stub(serverlessStepFunctions, 'compileHttpIamRole').returns(BbPromise.resolve());
       const compileDeploymentStub = sinon
         .stub(serverlessStepFunctions, 'compileDeployment').returns(BbPromise.resolve());
       return serverlessStepFunctions.hooks['deploy:compileEvents']()
         .then(() => {
           expect(httpValidateStub.calledOnce).to.be.equal(true);
           expect(compileRestApiStub.notCalled).to.be.equal(true);
           expect(compileResourcesStub.notCalled).to.be.equal(true);
           expect(compileMethodsStub.notCalled).to.be.equal(true);
           expect(compileHttpIamRoleStub.notCalled).to.be.equal(true);
           expect(compileDeploymentStub.notCalled).to.be.equal(true);
           serverlessStepFunctions.httpValidate.restore();
           serverlessStepFunctions.compileRestApi.restore();
           serverlessStepFunctions.compileResources.restore();
           serverlessStepFunctions.compileMethods.restore();
           serverlessStepFunctions.compileHttpIamRole.restore();
           serverlessStepFunctions.compileDeployment.restore();
         });
     });

    it('should run deploy:compileEvents promise chain in order',
      () => {
        const httpValidateStub = sinon
          .stub(serverlessStepFunctions, 'httpValidate').returns({ events: [1, 2, 3] });
        const compileRestApiStub = sinon
          .stub(serverlessStepFunctions, 'compileRestApi').returns(BbPromise.resolve());
        const compileResourcesStub = sinon
          .stub(serverlessStepFunctions, 'compileResources').returns(BbPromise.resolve());
        const compileMethodsStub = sinon
          .stub(serverlessStepFunctions, 'compileMethods').returns(BbPromise.resolve());
        const compileHttpIamRoleStub = sinon
          .stub(serverlessStepFunctions, 'compileHttpIamRole').returns(BbPromise.resolve());
        const compileDeploymentStub = sinon
          .stub(serverlessStepFunctions, 'compileDeployment').returns(BbPromise.resolve());
        return serverlessStepFunctions.hooks['deploy:compileEvents']()
          .then(() => {
            expect(httpValidateStub.calledOnce).to.be.equal(true);
            expect(compileRestApiStub.calledOnce).to.be.equal(true);
            expect(compileResourcesStub.calledAfter(compileRestApiStub)).to.be.equal(true);
            expect(compileMethodsStub.calledAfter(compileResourcesStub)).to.be.equal(true);
            expect(compileHttpIamRoleStub.calledAfter(compileMethodsStub)).to.be.equal(true);
            expect(compileDeploymentStub.calledAfter(compileHttpIamRoleStub)).to.be.equal(true);

            serverlessStepFunctions.httpValidate.restore();
            serverlessStepFunctions.compileRestApi.restore();
            serverlessStepFunctions.compileResources.restore();
            serverlessStepFunctions.compileMethods.restore();
            serverlessStepFunctions.compileHttpIamRole.restore();
            serverlessStepFunctions.compileDeployment.restore();
          });
      });
    it('should run after:deploy:deploy promise chain in order', () => {
      const getEndpointInfoStub = sinon
        .stub(serverlessStepFunctions, 'getEndpointInfo').returns(BbPromise.resolve());
      const displayStub = sinon
        .stub(serverlessStepFunctions, 'display').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['after:deploy:deploy']()
        .then(() => {
          expect(getEndpointInfoStub.calledOnce).to.be.equal(true);
          expect(displayStub.calledAfter(getEndpointInfoStub)).to.be.equal(true);
          serverlessStepFunctions.getEndpointInfo.restore();
          serverlessStepFunctions.display.restore();
        });
    });
  });

  describe('#invoke()', () => {
    it('should run promise chain in order', () => {
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const startExecutionStub = sinon
        .stub(serverlessStepFunctions, 'startExecution').returns(BbPromise.resolve());
      const describeExecutionStub = sinon
        .stub(serverlessStepFunctions, 'describeExecution')
        .returns(BbPromise.resolve({ status: 'SUCCEED' }));

      return serverlessStepFunctions.invoke()
        .then(() => {
          expect(getStateMachineArnStub.calledOnce).to.be.equal(true);
          expect(startExecutionStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(describeExecutionStub.calledAfter(startExecutionStub)).to.be.equal(true);

          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.startExecution.restore();
          serverlessStepFunctions.describeExecution.restore();
        });
    });

    it('should run promise chain in order when invocation error occurs', () => {
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const startExecutionStub = sinon
        .stub(serverlessStepFunctions, 'startExecution').returns(BbPromise.resolve());
      const describeExecutionStub = sinon
        .stub(serverlessStepFunctions, 'describeExecution')
        .returns(BbPromise.resolve({ status: 'FAILED' }));
      const getExecutionHistoryStub = sinon
        .stub(serverlessStepFunctions, 'getExecutionHistory').returns(BbPromise.resolve({
          events: [{
            executionFailedEventDetails: '',
          }],
        }));

      return serverlessStepFunctions.invoke()
        .then(() => {
          expect(getStateMachineArnStub.calledOnce).to.be.equal(true);
          expect(startExecutionStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(describeExecutionStub.calledAfter(startExecutionStub)).to.be.equal(true);
          expect(getExecutionHistoryStub.calledAfter(describeExecutionStub)).to.be.equal(true);

          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.startExecution.restore();
          serverlessStepFunctions.describeExecution.restore();
          serverlessStepFunctions.getExecutionHistory.restore();
        });
    });
  });
});
