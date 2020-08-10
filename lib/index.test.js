'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const BbPromise = require('bluebird');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const CLI = require('serverless/lib/classes/CLI');
const chalk = require('chalk');
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
    serverless.configSchemaHandler = {
    // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.cli = new CLI(serverless);
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(serverlessStepFunctions.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () => expect(serverlessStepFunctions.provider).to.be.instanceof(AwsProvider));

    it('should have access to the serverless instance', () => expect(serverlessStepFunctions.serverless).to.deep.equal(serverless));

    it('should set the options variable', () => expect(serverlessStepFunctions.options).to.deep.equal({
      stage: 'dev',
      region: 'us-east-1',
    }));

    it('should set the region variable', () => expect(serverlessStepFunctions.region).to.be.equal('us-east-1'));

    it('should set the stage variable', () => expect(serverlessStepFunctions.stage).to.be.equal('dev'));

    it('should run invoke:stepf:invoke promise chain in order', () => {
      const invokeStub = sinon
        .stub(serverlessStepFunctions, 'invoke').returns(BbPromise.resolve());
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['invoke:stepf:invoke']()
        .then(() => {
          expect(invokeStub.calledOnce).to.be.equal(true);
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.invoke.restore();
        });
    });

    it('should run package:initialize promise chain in order', () => {
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['package:initialize']()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.yamlParse.restore();
        });
    });

    it('should run package:compileFunctions promise chain in order', () => {
      const compileIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'compileIamRole').returns(BbPromise.resolve());
      const compileStateMachinesStub = sinon
        .stub(serverlessStepFunctions, 'compileStateMachines').returns(BbPromise.resolve());
      const compileActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'compileActivities').returns(BbPromise.resolve());
      const compileAlarmsStub = sinon
        .stub(serverlessStepFunctions, 'compileAlarms').returns(BbPromise.resolve());
      const compileNotificationsStub = sinon
        .stub(serverlessStepFunctions, 'compileNotifications').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['package:compileFunctions']()
        .then(() => {
          expect(compileIamRoleStub.calledOnce).to.be.equal(true);
          expect(compileStateMachinesStub.calledAfter(compileIamRoleStub)).to.be.equal(true);
          expect(compileActivitiesStub.calledAfter(compileStateMachinesStub)).to.be.equal(true);
          expect(compileAlarmsStub.calledAfter(compileActivitiesStub)).to.be.equal(true);
          expect(compileNotificationsStub.calledAfter(compileAlarmsStub)).to.be.equal(true);
          serverlessStepFunctions.compileIamRole.restore();
          serverlessStepFunctions.compileStateMachines.restore();
          serverlessStepFunctions.compileActivities.restore();
          serverlessStepFunctions.compileAlarms.restore();
          serverlessStepFunctions.compileNotifications.restore();
        });
    });

    it('should run package:compileEvents promise chain in order when http event is empty',
      () => {
        const compileScheduledEventsStub = sinon
          .stub(serverlessStepFunctions, 'compileScheduledEvents').returns(BbPromise.resolve());
        const compileCloudWatchEventEventsStub = sinon
          .stub(serverlessStepFunctions, 'compileCloudWatchEventEvents')
          .returns(BbPromise.resolve());
        const httpValidateStub = sinon
          .stub(serverlessStepFunctions, 'httpValidate').returns({ events: [] });
        const compileRestApiStub = sinon
          .stub(serverlessStepFunctions, 'compileRestApi').returns(BbPromise.resolve());
        const compileResourcesStub = sinon
          .stub(serverlessStepFunctions, 'compileResources').returns(BbPromise.resolve());
        const compileMethodsStub = sinon
          .stub(serverlessStepFunctions, 'compileMethods').returns(BbPromise.resolve());
        const compileAuthorizersStub = sinon
          .stub(serverlessStepFunctions, 'compileAuthorizers').returns(BbPromise.resolve());
        const compileHttpLambdaPermissions = sinon
          .stub(serverlessStepFunctions, 'compileHttpLambdaPermissions')
          .returns(BbPromise.resolve());
        const compileCorsStub = sinon
          .stub(serverlessStepFunctions, 'compileCors').returns(BbPromise.resolve());
        const compileHttpIamRoleStub = sinon
          .stub(serverlessStepFunctions, 'compileHttpIamRole').returns(BbPromise.resolve());
        const compileDeploymentStub = sinon
          .stub(serverlessStepFunctions, 'compileDeployment').returns(BbPromise.resolve());
        const compileApiKeysStub = sinon
          .stub(serverlessStepFunctions, 'compileApiKeys').returns(BbPromise.resolve());
        const compileUsagePlanStub = sinon
          .stub(serverlessStepFunctions, 'compileUsagePlan').returns(BbPromise.resolve());
        const compileUsagePlanKeysStub = sinon
          .stub(serverlessStepFunctions, 'compileUsagePlanKeys').returns(BbPromise.resolve());
        return serverlessStepFunctions.hooks['package:compileEvents']()
          .then(() => {
            expect(compileScheduledEventsStub.calledOnce).to.be.equal(true);
            expect(compileCloudWatchEventEventsStub.calledOnce).to.be.equal(true);
            expect(httpValidateStub.calledOnce).to.be.equal(true);
            expect(compileRestApiStub.notCalled).to.be.equal(true);
            expect(compileResourcesStub.notCalled).to.be.equal(true);
            expect(compileMethodsStub.notCalled).to.be.equal(true);
            expect(compileAuthorizersStub.notCalled).to.be.equal(true);
            expect(compileHttpLambdaPermissions.notCalled).to.be.equal(true);
            expect(compileCorsStub.notCalled).to.be.equal(true);
            expect(compileHttpIamRoleStub.notCalled).to.be.equal(true);
            expect(compileDeploymentStub.notCalled).to.be.equal(true);
            expect(compileApiKeysStub.notCalled).to.be.equal(true);
            expect(compileUsagePlanStub.notCalled).to.be.equal(true);
            expect(compileUsagePlanKeysStub.notCalled).to.be.equal(true);
            serverlessStepFunctions.compileScheduledEvents.restore();
            serverlessStepFunctions.compileCloudWatchEventEvents.restore();
            serverlessStepFunctions.httpValidate.restore();
            serverlessStepFunctions.compileRestApi.restore();
            serverlessStepFunctions.compileResources.restore();
            serverlessStepFunctions.compileMethods.restore();
            serverlessStepFunctions.compileAuthorizers.restore();
            serverlessStepFunctions.compileHttpLambdaPermissions.restore();
            serverlessStepFunctions.compileCors.restore();
            serverlessStepFunctions.compileHttpIamRole.restore();
            serverlessStepFunctions.compileDeployment.restore();
            serverlessStepFunctions.compileApiKeys.restore();
            serverlessStepFunctions.compileUsagePlan.restore();
            serverlessStepFunctions.compileUsagePlanKeys.restore();
          });
      });

    it('should run package:compileEvents promise chain in order',
      () => {
        const compileScheduledEventsStub = sinon
          .stub(serverlessStepFunctions, 'compileScheduledEvents').returns(BbPromise.resolve());
        const compileCloudWatchEventEventsStub = sinon
          .stub(serverlessStepFunctions, 'compileCloudWatchEventEvents')
          .returns(BbPromise.resolve());
        const httpValidateStub = sinon
          .stub(serverlessStepFunctions, 'httpValidate').returns({ events: [1, 2, 3] });
        const compileRestApiStub = sinon
          .stub(serverlessStepFunctions, 'compileRestApi').returns(BbPromise.resolve());
        const compileResourcesStub = sinon
          .stub(serverlessStepFunctions, 'compileResources').returns(BbPromise.resolve());
        const compileMethodsStub = sinon
          .stub(serverlessStepFunctions, 'compileMethods').returns(BbPromise.resolve());
        const compileAuthorizersStub = sinon
          .stub(serverlessStepFunctions, 'compileAuthorizers').returns(BbPromise.resolve());
        const compileCorsStub = sinon
          .stub(serverlessStepFunctions, 'compileCors').returns(BbPromise.resolve());
        const compileHttpIamRoleStub = sinon
          .stub(serverlessStepFunctions, 'compileHttpIamRole').returns(BbPromise.resolve());
        const compileDeploymentStub = sinon
          .stub(serverlessStepFunctions, 'compileDeployment').returns(BbPromise.resolve());
        const compileApiKeysStub = sinon
          .stub(serverlessStepFunctions, 'compileApiKeys').returns(BbPromise.resolve());
        const compileUsagePlanStub = sinon
          .stub(serverlessStepFunctions, 'compileUsagePlan').returns(BbPromise.resolve());
        const compileUsagePlanKeysStub = sinon
          .stub(serverlessStepFunctions, 'compileUsagePlanKeys').returns(BbPromise.resolve());
        return serverlessStepFunctions.hooks['package:compileEvents']()
          .then(() => {
            expect(compileScheduledEventsStub.calledOnce).to.be.equal(true);
            expect(compileCloudWatchEventEventsStub.calledOnce).to.be.equal(true);
            expect(httpValidateStub.calledOnce).to.be.equal(true);
            expect(compileRestApiStub.calledOnce).to.be.equal(true);
            expect(compileResourcesStub.calledAfter(compileRestApiStub)).to.be.equal(true);
            expect(compileMethodsStub.calledAfter(compileResourcesStub)).to.be.equal(true);
            expect(compileAuthorizersStub.calledAfter(compileResourcesStub)).to.be.equal(true);
            expect(compileCorsStub.calledAfter(compileMethodsStub)).to.be.equal(true);
            expect(compileHttpIamRoleStub.calledAfter(compileCorsStub)).to.be.equal(true);
            expect(compileDeploymentStub.calledAfter(compileHttpIamRoleStub)).to.be.equal(true);
            expect(compileApiKeysStub.calledAfter(compileDeploymentStub)).to.be.equal(true);
            expect(compileUsagePlanStub.calledAfter(compileApiKeysStub)).to.be.equal(true);
            expect(compileUsagePlanKeysStub.calledAfter(compileUsagePlanStub)).to.be.equal(true);

            serverlessStepFunctions.compileScheduledEvents.restore();
            serverlessStepFunctions.compileCloudWatchEventEvents.restore();
            serverlessStepFunctions.httpValidate.restore();
            serverlessStepFunctions.compileRestApi.restore();
            serverlessStepFunctions.compileResources.restore();
            serverlessStepFunctions.compileMethods.restore();
            serverlessStepFunctions.compileAuthorizers.restore();
            serverlessStepFunctions.compileHttpIamRole.restore();
            serverlessStepFunctions.compileDeployment.restore();
            serverlessStepFunctions.compileApiKeys.restore();
            serverlessStepFunctions.compileUsagePlan.restore();
            serverlessStepFunctions.compileUsagePlanKeys.restore();
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

  describe('#deploy()', () => {
    let consoleLogStub;

    beforeEach(() => {
      consoleLogStub = sinon.stub(serverless.cli, 'consoleLog').returns();
      serverlessStepFunctions.endpointInfo = 'https://example.com';
    });

    afterEach(() => {
      serverlessStepFunctions.serverless.cli.consoleLog.restore();
    });

    it('should not display endpoints if http event not given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {};
      const expectedMessage = '';
      const message = serverlessStepFunctions.display();
      expect(consoleLogStub.calledOnce).to.equal(false);
      expect(message).to.equal(expectedMessage);
    });

    it('should display endpoints if http event given as object', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine: {
            define: 'my-define',
            events: [
              {
                http: {
                  path: 'foo/bar',
                  method: 'post',
                },
              },
            ],
          },
        },
      };
      let expectedMessage = '';
      expectedMessage += `${chalk.yellow.underline('Serverless StepFunctions OutPuts')}\n`;
      expectedMessage += `${chalk.yellow('endpoints:')}`;
      expectedMessage += '\n  POST - https://example.com/foo/bar';
      expectedMessage += '\n';
      const message = serverlessStepFunctions.display();
      expect(consoleLogStub.calledOnce).to.equal(true);
      expect(message).to.equal(expectedMessage);
    });

    it('should display endpoints if http event given as string', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine: {
            define: 'my-define',
            events: [
              {
                http: 'post foo/bar',
              },
            ],
          },
        },
      };
      let expectedMessage = '';
      expectedMessage += `${chalk.yellow.underline('Serverless StepFunctions OutPuts')}\n`;
      expectedMessage += `${chalk.yellow('endpoints:')}`;
      expectedMessage += '\n  POST - https://example.com/foo/bar';
      expectedMessage += '\n';
      const message = serverlessStepFunctions.display();
      expect(consoleLogStub.calledOnce).to.equal(true);
      expect(message).to.equal(expectedMessage);
    });

    it('should display endpoints if http event given with path as slash', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine: {
            define: 'my-define',
            events: [
              {
                http: 'post /',
              },
            ],
          },
        },
      };
      let expectedMessage = '';
      expectedMessage += `${chalk.yellow.underline('Serverless StepFunctions OutPuts')}\n`;
      expectedMessage += `${chalk.yellow('endpoints:')}`;
      expectedMessage += '\n  POST - https://example.com';
      expectedMessage += '\n';
      const message = serverlessStepFunctions.display();
      expect(consoleLogStub.calledOnce).to.equal(true);
      expect(message).to.equal(expectedMessage);
    });

    it('should display endpoints if events given as object', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine: {
            define: 'my-define',
            events: {},
          },
        },
      };
      const expectedMessage = '';
      const message = serverlessStepFunctions.display();
      expect(consoleLogStub.calledOnce).to.equal(false);
      expect(message).to.equal(expectedMessage);
    });

    it('should display endpoints if http event does not exists', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine: {
            define: 'my-define',
            events: [
              {
                foo: 'bar',
              },
            ],
          },
        },
      };
      const expectedMessage = '';
      const message = serverlessStepFunctions.display();
      expect(consoleLogStub.calledOnce).to.equal(false);
      expect(message).to.equal(expectedMessage);
    });
  });
});
