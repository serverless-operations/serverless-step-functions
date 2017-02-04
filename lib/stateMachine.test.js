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
      name: 'hellofunc',
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

    it('should getStateMachineStub when correct params is not given'
    , () => serverlessStepFunctions.getStateMachineArn()
      .then(() => {
        expect(getStateMachineStub.calledOnce).to.be.equal(true);
        expect(getStateMachineStub.calledWithExactly(
          'STS',
          'getCallerIdentity',
          {},
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.stateMachineArns.hellofunc).to.be
        .equal('arn:aws:states:us-east-1:1234:stateMachine:step-functions-dev-hellofunc');
        serverlessStepFunctions.provider.request.restore();
      })
    );

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
            stateMachineArn: serverlessStepFunctions.stateMachineArns.hellofunc,
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
      serverless.service.stepFunctions = { name: 'state' };
    });

    it('should createStateMachine when correct params is not given'
    , () => serverlessStepFunctions.createStateMachine()
      .then(() => {
        const stage = serverlessStepFunctions.options.stage;
        expect(createStateMachineStub.calledOnce).to.be.equal(true);
        expect(createStateMachineStub.calledWithExactly(
          'StepFunctions',
          'createStateMachine',
          {
            definition: serverlessStepFunctions
            .serverless.service.stepFunctions.hellofunc,
            name: `${serverless.service.service}-${stage}-hellofunc`,
            roleArn: serverlessStepFunctions.iamRoleArn.hellofunc,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );

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

    it('should throw error when createStateMachineStub throw error', () => {
      serverlessStepFunctions.provider.request.restore();
      createStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.reject(new Error('some error')));

      serverlessStepFunctions.createStateMachine().catch((error) => {
        expect(error.message).to.be.equal('some error');
        serverlessStepFunctions.provider.request.restore();
      });
    });

    it('should do setTimeout when createStateMachineStub throw a certain error',
      () => {
        serverlessStepFunctions.provider.request.restore();
        createStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
          .returns(BbPromise.reject(new Error('some State Machine is being deleted error')));
        const setTimeoutStub = sinon.stub(serverlessStepFunctions, 'setTimeout')
          .returns(BbPromise.reject());

        serverlessStepFunctions.createStateMachine().catch(() => {
          expect(createStateMachineStub.calledOnce).to.be.equal(true);
          expect(setTimeoutStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.provider.request.restore();
          serverlessStepFunctions.setTimeout.restore();
        });
      });
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
            stateMachineArn: serverlessStepFunctions.stateMachineArns.hellofunc,
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

    it('should do describeExecution once when status is RUNNING', () => {
      describeExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(BbPromise.resolve({ status: 'RUNNING' }));
      const setTimeoutStub = sinon.stub(serverlessStepFunctions, 'setTimeout')
        .returns(BbPromise.reject());

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
        expect(setTimeoutStub.calledOnce).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
        serverlessStepFunctions.setTimeout.restore();
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
    let getStateMachineNamesStub;
    beforeEach(() => {
      serverless.service.stepFunctions = {
        helloHello: 'value',
      };
      getStateMachineNamesStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Account: 1234 }));
    });

    it('should getStateMachineNames with correct params'
    , () => serverlessStepFunctions.getStateMachineNames()
      .then(() => {
        expect(getStateMachineNamesStub.calledOnce).to.be.equal(true);
        expect(getStateMachineNamesStub.calledWithExactly(
          'STS',
          'getCallerIdentity',
          {},
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);

        expect(serverlessStepFunctions.stateMachineArns.helloHello).to.be
        .equal('arn:aws:states:us-east-1:1234:stateMachine:step-functions-dev-helloHello');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#deleteStateMachines()', () => {
    let deleteStateMachineStub;
    beforeEach(() => {
      serverless.service.stepFunctions = {
        helloHello: 'value',
        hogeHoge: 'value',
      };
      deleteStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachine').returns(BbPromise.resolve());
    });

    it('should deleteStateMachines with correct params'
    , () => serverlessStepFunctions.deleteStateMachines()
      .then(() => {
        expect(deleteStateMachineStub.calledTwice).to.be.equal(true);
        serverlessStepFunctions.deleteStateMachine.restore();
      })
    );
  });

  describe('#createStateMachines()', () => {
    let createStateMachineStub;
    beforeEach(() => {
      serverless.service.stepFunctions = {
        helloHello: 'value',
        hogeHoge: 'value',
        sssss: 'value',
      };
      createStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'createStateMachine').returns(BbPromise.resolve());
    });

    it('should createStateMachines with correct params'
    , () => serverlessStepFunctions.createStateMachines()
      .then(() => {
        expect(createStateMachineStub.calledThrice).to.be.equal(true);
        serverlessStepFunctions.createStateMachine.restore();
      })
    );
  });
});
