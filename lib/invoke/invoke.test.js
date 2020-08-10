'use strict';

const expect = require('chai').expect;
const os = require('os');
const crypto = require('crypto');
const BbPromise = require('bluebird');
const sinon = require('sinon');
const path = require('path');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const CLI = require('serverless/lib/classes/CLI');
const ServerlessStepFunctions = require('./../index');

describe('invoke', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.cli = new CLI(serverless);
    serverless.service.service = 'new-service';
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    const options = {
      stage: 'dev',
      region: 'us-east-1',
      name: 'myStateMachine',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          define: 'my-define',
        },
      },
    };
  });

  describe('#getStateMachineArn()', () => {
    let getStateMachineStub;

    it('should return arn when correct params given',
      () => {
        getStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
          .returns(BbPromise.resolve({
            Stacks: [
              {
                Outputs: [
                  {
                    OutputKey: 'MyStateMachineStepFunctionsStateMachineArn',
                    OutputValue: 'arn:aws:states:us-east-1:xxxx',
                    Description: 'Current StateMachine Arn',
                  },
                ],
              },
            ],
          }));

        serverlessStepFunctions.getStateMachineArn()
          .then(() => {
            expect(getStateMachineStub.calledOnce).to.be.equal(true);
            expect(getStateMachineStub.calledWithExactly(
              'CloudFormation',
              'describeStacks',
              { StackName: 'new-service-dev' },
              serverlessStepFunctions.options.stage,
              serverlessStepFunctions.options.region,
            )).to.be.equal(true);
            expect(serverlessStepFunctions.stateMachineArn).to.be
              .equal('arn:aws:states:us-east-1:xxxx');
            serverlessStepFunctions.provider.request.restore();
          });
      });

    it('should return arn when correct params given with specifing name statement in serverless.yml',
      () => {
        getStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
          .returns(BbPromise.resolve({
            Stacks: [
              {
                Outputs: [
                  {
                    OutputKey: 'StatemachinenameArn',
                    OutputValue: 'arn:aws:states:us-east-1:xxxx',
                    Description: 'Current StateMachine Arn',
                  },
                ],
              },
            ],
          }));

        serverless.service.stepFunctions = {
          stateMachines: {
            myStateMachine: {
              name: 'statemachinename',
              definition: 'definition1',
            },
          },
        };

        serverlessStepFunctions.getStateMachineArn()
          .then(() => {
            expect(getStateMachineStub.calledOnce).to.be.equal(true);
            expect(getStateMachineStub.calledWithExactly(
              'CloudFormation',
              'describeStacks',
              { StackName: 'new-service-dev' },
              serverlessStepFunctions.options.stage,
              serverlessStepFunctions.options.region,
            )).to.be.equal(true);
            expect(serverlessStepFunctions.stateMachineArn).to.be
              .equal('arn:aws:states:us-east-1:xxxx');
            serverlessStepFunctions.provider.request.restore();
          });
      });

    it('should throw error if correct params is not given',
      () => {
        getStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
          .returns(BbPromise.resolve({
            Stacks: [
              {
                Outputs: [
                  {
                    OutputKey: 'SomeStepFunctionsStateMachineArn',
                    OutputValue: 'arn:aws:states:us-east-1:xxxx',
                    Description: 'Current StateMachine Arn',
                  },
                ],
              },
            ],
          }));

        serverlessStepFunctions.getStateMachineArn()
          .catch((error) => {
            expect(getStateMachineStub.calledOnce).to.be.equal(true);
            expect(getStateMachineStub.calledWithExactly(
              'CloudFormation',
              'describeStacks',
              { StackName: 'new-service-dev' },
              serverlessStepFunctions.options.stage,
              serverlessStepFunctions.options.region,
            )).to.be.equal(true);
            expect(error.message).to.be
              .equal('"myStateMachine" stateMachine does not exists.');
          });
        serverlessStepFunctions.provider.request.restore();
      });

    it('should throw error if describeStacks returns empty',
      () => {
        getStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
          .returns(BbPromise.resolve(false));

        serverlessStepFunctions.getStateMachineArn('state')
          .catch((error) => {
            expect(getStateMachineStub.calledOnce).to.be.equal(true);
            expect(getStateMachineStub.calledWithExactly(
              'CloudFormation',
              'describeStacks',
              { StackName: 'new-service-dev' },
              serverlessStepFunctions.options.stage,
              serverlessStepFunctions.options.region,
            )).to.be.equal(true);
            expect(error.message).to.be
              .equal('"myStateMachine" stateMachine does not exists.');
          });
        serverlessStepFunctions.provider.request.restore();
      });
  });

  describe('#startExecution()', () => {
    let startExecutionStub;
    beforeEach(() => {
      serverlessStepFunctions.stateMachineArn = 'my-arn';
    });

    it('should startExecution with correct params', () => {
      startExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(BbPromise.resolve({ executionArn: 'executionArn' }));
      serverlessStepFunctions.startExecution()
        .then(() => {
          expect(startExecutionStub.calledOnce).to.be.equal(true);
          expect(startExecutionStub.calledWithExactly(
            'StepFunctions',
            'startExecution',
            {
              stateMachineArn: serverlessStepFunctions.stateMachineArn,
            },
            serverlessStepFunctions.options.stage,
            serverlessStepFunctions.options.region,
          )).to.be.equal(true);
          expect(serverlessStepFunctions.executionArn).to.be.equal('executionArn');
          serverlessStepFunctions.provider.request.restore();
        });
    });

    it('should startExecution with data option', () => {
      startExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(BbPromise.resolve({ executionArn: 'executionArn' }));
      serverlessStepFunctions.options.data = '{"foo":"bar"}';
      return serverlessStepFunctions.startExecution()
        .then(() => {
          expect(startExecutionStub.calledOnce).to.be.equal(true);
          expect(startExecutionStub.calledWithExactly(
            'StepFunctions',
            'startExecution',
            {
              stateMachineArn: serverlessStepFunctions.stateMachineArn,
              input: '{"foo":"bar"}',
            },
            serverlessStepFunctions.options.stage,
            serverlessStepFunctions.options.region,
          )).to.be.equal(true);
          expect(serverlessStepFunctions.executionArn).to.be.equal('executionArn');
          serverlessStepFunctions.provider.request.restore();
        });
    });

    it('should startExecution with path option', () => {
      startExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(BbPromise.resolve({ executionArn: 'executionArn' }));
      serverless.config.servicePath = path.join(os.tmpdir(),
        'tmpdirs-serverless', 'serverless', crypto.randomBytes(8).toString('hex'));
      const data = {
        testProp: 'testValue',
      };
      const dataFile = path.join(serverless.config.servicePath, 'data.json');
      serverless.utils.writeFileSync(dataFile, JSON.stringify(data));
      serverlessStepFunctions.options.path = dataFile;

      return serverlessStepFunctions.startExecution()
        .then(() => {
          expect(startExecutionStub.calledOnce).to.be.equal(true);
          expect(startExecutionStub.calledWithExactly(
            'StepFunctions',
            'startExecution',
            {
              stateMachineArn: serverlessStepFunctions.stateMachineArn,
              input: '{"testProp":"testValue"}',
            },
            serverlessStepFunctions.options.stage,
            serverlessStepFunctions.options.region,
          )).to.be.equal(true);
          expect(serverlessStepFunctions.executionArn).to.be.equal('executionArn');
          serverlessStepFunctions.provider.request.restore();
        });
    });

    it('should throw error that the specified file with path option does not be found', () => {
      startExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(BbPromise.resolve({ executionArn: 'executionArn' }));
      serverless.config.servicePath = path.join(os.tmpdir(),
        'tmpdirs-serverless', 'serverless', crypto.randomBytes(8).toString('hex'));
      const data = {
        testProp: 'testValue',
      };
      const dataFile = path.join(serverless.config.servicePath, 'data.json');
      serverless.utils.writeFileSync(dataFile, JSON.stringify(data));
      serverlessStepFunctions.options.path = 'data2.json';

      expect(() => serverlessStepFunctions.startExecution()).to.throw(Error);
    });

    it('should throw error if startExecution fail', () => {
      startExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(BbPromise.reject(new Error('error')));

      return serverlessStepFunctions.startExecution()
        .catch((error) => {
          expect(startExecutionStub.calledOnce).to.be.equal(true);
          expect(startExecutionStub.calledWithExactly(
            'StepFunctions',
            'startExecution',
            {
              stateMachineArn: serverlessStepFunctions.stateMachineArn,
            },
            serverlessStepFunctions.options.stage,
            serverlessStepFunctions.options.region,
          )).to.be.equal(true);
          expect(error.message).to.be.equal('error');
          serverlessStepFunctions.provider.request.restore();
        });
    });
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
            serverlessStepFunctions.options.region,
          )).to.be.equal(true);
          serverlessStepFunctions.provider.request.restore();
        });
    });

    it('should do describeExecution once when status is RUNNING', () => {
      describeExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request');
      describeExecutionStub.onCall(0).returns(BbPromise.resolve({ status: 'RUNNING' }));
      describeExecutionStub.onCall(1).returns(BbPromise.resolve({ status: 'SUCCESS' }));
      const setTimeoutStub = sinon.stub(serverlessStepFunctions, 'setTimeout')
        .returns(BbPromise.resolve());

      serverlessStepFunctions.describeExecution()
        .then(() => {
          expect(describeExecutionStub.calledTwice).to.be.equal(true);
          expect(describeExecutionStub.calledWithExactly(
            'StepFunctions',
            'describeExecution',
            {
              executionArn: serverlessStepFunctions.executionArn,
            },
            serverlessStepFunctions.options.stage,
            serverlessStepFunctions.options.region,
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

    it('should getExecutionHistory with correct params',
      () => serverlessStepFunctions.getExecutionHistory()
        .then(() => {
          expect(getExecutionHistoryStub.calledOnce).to.be.equal(true);
          expect(getExecutionHistoryStub.calledWithExactly(
            'StepFunctions',
            'getExecutionHistory',
            {
              executionArn: serverlessStepFunctions.executionArn,
            },
            serverlessStepFunctions.options.stage,
            serverlessStepFunctions.options.region,
          )).to.be.equal(true);
          serverlessStepFunctions.provider.request.restore();
        }));
  });

  describe('#setTimeout()', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers(new Date(Date.UTC(2016, 9, 1)).getTime());
    });

    afterEach(() => {
      clock.restore();
    });

    it('should do settimeout', () => {
      serverlessStepFunctions.setTimeout().then(result => expect(result).to.be.undefined);
      clock.tick(5000);
    });
  });
});
