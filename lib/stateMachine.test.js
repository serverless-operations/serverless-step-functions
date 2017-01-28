'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('stateMachine', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
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
      state: 'hellofunc',
      data: 'inputData',
    };

    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#getStateMachineArn()', () => {
    let getStateMachineStub;
    beforeEach(() => {
      getStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Account: 1234 }));
    });

    it('should getStateMachineStub with correct params'
    , () => serverlessStepFunctions.getStateMachineArn('state')
      .then(() => {
        expect(getStateMachineStub.calledOnce).to.be.equal(true);
        expect(getStateMachineStub.calledWithExactly(
          'STS',
          'getCallerIdentity',
          {},
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.stateMachineArns.state).to.be
        .equal('arn:aws:states:us-east-1:1234:stateMachine:step-functions-dev-state');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#deleteStateMachine()', () => {
    let deleteStateMachineStub;
    beforeEach(() => {
      deleteStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Account: 1234 }));
    });

    it('should deleteStateMachine with correct params'
    , () => serverlessStepFunctions.deleteStateMachine()
      .then(() => {
        expect(deleteStateMachineStub.calledOnce).to.be.equal(true);
        expect(deleteStateMachineStub.calledWithExactly(
          'StepFunctions',
          'deleteStateMachine',
          {
            stateMachineArn: serverlessStepFunctions.stateMachineArn,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#createStateMachine()', () => {
    let createStateMachineStub;
    beforeEach(() => {
      createStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve());
      serverlessStepFunctions.serverless.service.stepFunctions = { state: 'state' };
    });

    it('should createStateMachine with correct params'
    , () => serverlessStepFunctions.createStateMachine('state')
      .then(() => {
        const stage = serverlessStepFunctions.options.stage;
        expect(createStateMachineStub.calledOnce).to.be.equal(true);
        expect(createStateMachineStub.calledWithExactly(
          'StepFunctions',
          'createStateMachine',
          {
            definition: serverlessStepFunctions
            .serverless.service.stepFunctions.state,
            name: `${serverless.service.service}-${stage}-state`,
            roleArn: serverlessStepFunctions.iamRoleArn.state,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#startExecution()', () => {
    let startExecutionStub;
    beforeEach(() => {
      startExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ executionArn: 'executionArn' }));
    });

    it('should startExecution with correct params', () => serverlessStepFunctions.startExecution()
      .then(() => {
        expect(startExecutionStub.calledOnce).to.be.equal(true);
        expect(startExecutionStub.calledWithExactly(
          'StepFunctions',
          'startExecution',
          {
            stateMachineArn: serverlessStepFunctions.stateMachineArn,
            input: serverlessStepFunctions.options.data,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.executionArn).to.be.equal('executionArn');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#describeExecution()', () => {
    let describeExecutionStub;
    it('should describeExecution with correct params', () => {
      describeExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ status: 'SUCCESS' }));

      serverlessStepFunctions.describeExecution()
      .then(() => {
        expect(describeExecutionStub.calledOnce).to.be.equal(true);
        expect(describeExecutionStub.calledWithExactly(
          'StepFunctions',
          'describeExecution',
          {
            executionArn: serverlessStepFunctions.executionArn,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      });
    });
  });

  describe('#getExecutionHistory()', () => {
    let getExecutionHistoryStub;
    beforeEach(() => {
      getExecutionHistoryStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ events: [{ executionFailedEventDetails: 'error' }] }));
    });

    it('should getExecutionHistory with correct params'
    , () => serverlessStepFunctions.getExecutionHistory()
      .then(() => {
        expect(getExecutionHistoryStub.calledOnce).to.be.equal(true);
        expect(getExecutionHistoryStub.calledWithExactly(
          'StepFunctions',
          'getExecutionHistory',
          {
            executionArn: serverlessStepFunctions.executionArn,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#getStateMachineNames()', () => {
    // @todo
  });

  describe('#deleteStateMachines()', () => {
    // @todo
  });

  describe('#createStateMachines()', () => {
    // @todo
  });
});
