'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('ServerlessStepFunctions', () => {
  let serverless;
  let provider;
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
    provider = serverless.getProvider('aws');
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(serverlessStepFunctions.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(serverlessStepFunctions.provider).to.be.instanceof(AwsProvider));

    it('should have access to the serverless instance', () =>
      expect(serverlessStepFunctions.serverless).to.deep.equal(serverless));

    it('should set the region variable', () =>
      expect(serverlessStepFunctions.region).to.be.equal(provider.getRegion()));

    it('should set the stage variable', () =>
      expect(serverlessStepFunctions.stage).to.be.equal(provider.getStage()));

    it('should set the assumeRolePolicyDocument variable', () =>
      expect(serverlessStepFunctions.assumeRolePolicyDocument).to.be
      .equal(`{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "states.us-east-1.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  `
));

    it('should run deploy:stepf:deploy promise chain in order', () => {
      const deployStub = sinon
        .stub(serverlessStepFunctions, 'allDeploy').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['deploy:stepf:deploy']()
        .then(() => {
          expect(deployStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.allDeploy.restore();
        });
    });

    it('should run remove:stepf:remove promise chain in order', () => {
      const removeStub = sinon
        .stub(serverlessStepFunctions, 'allRemove').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['remove:stepf:remove']()
        .then(() => {
          expect(removeStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.allRemove.restore();
        });
    });

    it('should run deploy:stepf:statemachines:deploy promise chain in order', () => {
      const deployStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineDeploy').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['deploy:stepf:statemachines:deploy']()
        .then(() => {
          expect(deployStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineDeploy.restore();
        });
    });

    it('should run remove:stepf:statemachines:remove promise chain in order', () => {
      const removeStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineRemove').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['remove:stepf:statemachines:remove']()
        .then(() => {
          expect(removeStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineRemove.restore();
        });
    });

    it('should run invoke:stepf:invoke promise chain in order', () => {
      const invokeStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineInvoke').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['invoke:stepf:invoke']()
        .then(() => {
          expect(invokeStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineInvoke.restore();
        });
    });

    it('should run deploy:stepf:activities:deploy promise chain in order', () => {
      const deployActivityStub = sinon
        .stub(serverlessStepFunctions, 'activityDeploy').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['deploy:stepf:activities:deploy']()
        .then(() => {
          expect(deployActivityStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.activityDeploy.restore();
        });
    });

    it('should run remove:stepf:activities:remove promise chain in order', () => {
      const removeActivityStub = sinon
        .stub(serverlessStepFunctions, 'activityRemove').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['remove:stepf:activities:remove']()
        .then(() => {
          expect(removeActivityStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.activityRemove.restore();
        });
    });

    it('should set an empty options object if no options are given', () => {
      const serverlessStepFunctionsWithEmptyOptions = new ServerlessStepFunctions(serverless);
      expect(serverlessStepFunctionsWithEmptyOptions.options).to.deep.equal({});
    });
  });

  describe('#allDeploy()', () => {
    it('should run promise chain in order', () => {
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const checkActivitySettingsStub = sinon
        .stub(serverlessStepFunctions, 'checkActivitySettings').returns(BbPromise.resolve());
      const getActivityArnsStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArns').returns(BbPromise.resolve());
      const describeActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'describeActivities').returns(BbPromise.resolve());
      const createActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'createActivities').returns(BbPromise.resolve());
      const getStateMachineNamesStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineNames').returns(BbPromise.resolve());
      const getFunctionArnsStub = sinon
        .stub(serverlessStepFunctions, 'getFunctionArns').returns(BbPromise.resolve());
      const compileAllStub = sinon
        .stub(serverlessStepFunctions, 'compileAll').returns(BbPromise.resolve());
      const getIamRolesStub = sinon
        .stub(serverlessStepFunctions, 'getIamRoles').returns(BbPromise.resolve());
      const deleteStateMachinesStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachines').returns(BbPromise.resolve());
      const createStateMachinesStub = sinon
        .stub(serverlessStepFunctions, 'createStateMachines').returns(BbPromise.resolve());

      return serverlessStepFunctions.allDeploy()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(checkActivitySettingsStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getActivityArnsStub.calledAfter(checkActivitySettingsStub)).to.be.equal(true);
          expect(describeActivitiesStub.calledAfter(getActivityArnsStub)).to.be.equal(true);
          expect(createActivitiesStub.calledAfter(describeActivitiesStub)).to.be.equal(true);
          expect(getStateMachineNamesStub.calledAfter(createActivitiesStub)).to.be.equal(true);
          expect(getFunctionArnsStub.calledAfter(getStateMachineNamesStub)).to.be.equal(true);
          expect(compileAllStub.calledAfter(getFunctionArnsStub)).to.be.equal(true);
          expect(getIamRolesStub.calledAfter(compileAllStub)).to.be.equal(true);
          expect(deleteStateMachinesStub.calledAfter(getIamRolesStub)).to.be.equal(true);
          expect(createStateMachinesStub.calledAfter(deleteStateMachinesStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.checkActivitySettings.restore();
          serverlessStepFunctions.getActivityArns.restore();
          serverlessStepFunctions.describeActivities.restore();
          serverlessStepFunctions.createActivities.restore();
          serverlessStepFunctions.getStateMachineNames.restore();
          serverlessStepFunctions.getFunctionArns.restore();
          serverlessStepFunctions.compileAll.restore();
          serverlessStepFunctions.getIamRoles.restore();
          serverlessStepFunctions.deleteStateMachines.restore();
          serverlessStepFunctions.createStateMachines.restore();
        });
    });
  });

  describe('#allRemove()', () => {
    it('should run promise chain in order', () => {
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const deleteIamRolesStub = sinon
        .stub(serverlessStepFunctions, 'deleteIamRoles').returns(BbPromise.resolve());
      const getStateMachineNamesStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineNames').returns(BbPromise.resolve());
      const deleteStateMachinesStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachines').returns(BbPromise.resolve());
      const checkActivitySettingsStub = sinon
        .stub(serverlessStepFunctions, 'checkActivitySettings').returns(BbPromise.resolve());
      const getActivityArnsStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArns').returns(BbPromise.resolve());
      const describeActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'describeActivities').returns(BbPromise.resolve());
      const deleteActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'deleteActivities').returns(BbPromise.resolve());

      return serverlessStepFunctions.allRemove()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(deleteIamRolesStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getStateMachineNamesStub.calledAfter(deleteIamRolesStub)).to.be.equal(true);
          expect(deleteStateMachinesStub.calledAfter(getStateMachineNamesStub)).to.be.equal(true);
          expect(checkActivitySettingsStub.calledAfter(deleteStateMachinesStub)).to.be.equal(true);
          expect(getActivityArnsStub.calledAfter(checkActivitySettingsStub)).to.be.equal(true);
          expect(describeActivitiesStub.calledAfter(getActivityArnsStub)).to.be.equal(true);
          expect(deleteActivitiesStub.calledAfter(describeActivitiesStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.deleteIamRoles.restore();
          serverlessStepFunctions.getStateMachineNames.restore();
          serverlessStepFunctions.deleteStateMachines.restore();
          serverlessStepFunctions.checkActivitySettings.restore();
          serverlessStepFunctions.getActivityArns.restore();
          serverlessStepFunctions.describeActivities.restore();
          serverlessStepFunctions.deleteActivities.restore();
        });
    });
  });

  describe('#stateMachineDeploy()', () => {
    it('should run promise chain in order when name is given', () => {
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const getFunctionArnsStub = sinon
        .stub(serverlessStepFunctions, 'getFunctionArns').returns(BbPromise.resolve());
      const getActivityArnsStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArns').returns(BbPromise.resolve());
      const compileStub = sinon
        .stub(serverlessStepFunctions, 'compile').returns(BbPromise.resolve());
      const getIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'getIamRole').returns(BbPromise.resolve());
      const deleteStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachine').returns(BbPromise.resolve());
      const createStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'createStateMachine').returns(BbPromise.resolve());

      return serverlessStepFunctions.stateMachineDeploy()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getFunctionArnsStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(getActivityArnsStub.calledAfter(getFunctionArnsStub)).to.be.equal(true);
          expect(compileStub.calledAfter(getActivityArnsStub)).to.be.equal(true);
          expect(getIamRoleStub.calledAfter(compileStub)).to.be.equal(true);
          expect(deleteStateMachineStub.calledAfter(getIamRoleStub)).to.be.equal(true);
          expect(createStateMachineStub.calledAfter(deleteStateMachineStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.getFunctionArns.restore();
          serverlessStepFunctions.getActivityArns.restore();
          serverlessStepFunctions.compile.restore();
          serverlessStepFunctions.getIamRole.restore();
          serverlessStepFunctions.deleteStateMachine.restore();
          serverlessStepFunctions.createStateMachine.restore();
        });
    });
  });

  it('should run promise chain in order when name is not given', () => {
    serverlessStepFunctions.options.name = null;
    const yamlParseStub = sinon
      .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
    const getStateMachineNamesStub = sinon
      .stub(serverlessStepFunctions, 'getStateMachineNames').returns(BbPromise.resolve());
    const getFunctionArnsStub = sinon
      .stub(serverlessStepFunctions, 'getFunctionArns').returns(BbPromise.resolve());
    const compileAllStub = sinon
      .stub(serverlessStepFunctions, 'compileAll').returns(BbPromise.resolve());
    const getIamRolesStub = sinon
      .stub(serverlessStepFunctions, 'getIamRoles').returns(BbPromise.resolve());
    const deleteStateMachinesStub = sinon
      .stub(serverlessStepFunctions, 'deleteStateMachines').returns(BbPromise.resolve());
    const createStateMachinesStub = sinon
      .stub(serverlessStepFunctions, 'createStateMachines').returns(BbPromise.resolve());

    return serverlessStepFunctions.stateMachineDeploy()
      .then(() => {
        expect(yamlParseStub.calledOnce).to.be.equal(true);
        expect(getStateMachineNamesStub.calledAfter(yamlParseStub)).to.be.equal(true);
        expect(getFunctionArnsStub.calledAfter(getStateMachineNamesStub)).to.be.equal(true);
        expect(compileAllStub.calledAfter(getFunctionArnsStub)).to.be.equal(true);
        expect(getIamRolesStub.calledAfter(compileAllStub)).to.be.equal(true);
        expect(deleteStateMachinesStub.calledAfter(getIamRolesStub)).to.be.equal(true);
        expect(createStateMachinesStub.calledAfter(deleteStateMachinesStub)).to.be.equal(true);

        serverlessStepFunctions.yamlParse.restore();
        serverlessStepFunctions.getStateMachineNames.restore();
        serverlessStepFunctions.getFunctionArns.restore();
        serverlessStepFunctions.compileAll.restore();
        serverlessStepFunctions.getIamRoles.restore();
        serverlessStepFunctions.deleteStateMachines.restore();
        serverlessStepFunctions.createStateMachines.restore();
      });
  });

  describe('#stateMachineRemove()', () => {
    it('should run promise chain in order when name is given', () => {
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const deleteIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'deleteIamRole').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const deleteStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachine').returns(BbPromise.resolve());

      return serverlessStepFunctions.stateMachineRemove()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(deleteIamRoleStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(deleteIamRoleStub)).to.be.equal(true);
          expect(deleteStateMachineStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.deleteIamRole.restore();
          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.deleteStateMachine.restore();
        });
    });

    it('should run promise chain in order when name is not given', () => {
      serverlessStepFunctions.options.name = null;
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const deleteIamRolesStub = sinon
        .stub(serverlessStepFunctions, 'deleteIamRoles').returns(BbPromise.resolve());
      const getStateMachineNamesStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineNames').returns(BbPromise.resolve());
      const deleteStateMachinesStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachines').returns(BbPromise.resolve());

      return serverlessStepFunctions.stateMachineRemove()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(deleteIamRolesStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getStateMachineNamesStub.calledAfter(deleteIamRolesStub)).to.be.equal(true);
          expect(deleteStateMachinesStub.calledAfter(getStateMachineNamesStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.deleteIamRoles.restore();
          serverlessStepFunctions.getStateMachineNames.restore();
          serverlessStepFunctions.deleteStateMachines.restore();
        });
    });
  });

  describe('#stateMachineInvoke()', () => {
    it('should run promise chain in order', () => {
      const parseInputdateStub = sinon
        .stub(serverlessStepFunctions, 'parseInputdate').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const startExecutionStub = sinon
        .stub(serverlessStepFunctions, 'startExecution').returns(BbPromise.resolve());
      const describeExecutionStub = sinon
        .stub(serverlessStepFunctions, 'describeExecution')
        .returns(BbPromise.resolve({ status: 'SUCCEED' }));

      return serverlessStepFunctions.stateMachineInvoke()
        .then(() => {
          expect(parseInputdateStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(parseInputdateStub)).to.be.equal(true);
          expect(startExecutionStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(describeExecutionStub.calledAfter(startExecutionStub)).to.be.equal(true);

          serverlessStepFunctions.parseInputdate.restore();
          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.startExecution.restore();
          serverlessStepFunctions.describeExecution.restore();
        });
    });

    it('should run promise chain in order when invocation error occurs', () => {
      const parseInputdateStub = sinon
        .stub(serverlessStepFunctions, 'parseInputdate').returns(BbPromise.resolve());
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

      return serverlessStepFunctions.stateMachineInvoke()
        .then(() => {
          expect(parseInputdateStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(parseInputdateStub)).to.be.equal(true);
          expect(startExecutionStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(describeExecutionStub.calledAfter(startExecutionStub)).to.be.equal(true);
          expect(getExecutionHistoryStub.calledAfter(describeExecutionStub)).to.be.equal(true);

          serverlessStepFunctions.parseInputdate.restore();
          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.startExecution.restore();
          serverlessStepFunctions.describeExecution.restore();
          serverlessStepFunctions.getExecutionHistory.restore();
        });
    });
  });

  describe('#activityDeploy()', () => {
    it('should run promise chain in order when name is given with notDeployed', () => {
      serverlessStepFunctions.deployedActivities.hellofunc = 'notDeployed';
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const checkActivitySettingStub = sinon
        .stub(serverlessStepFunctions, 'checkActivitySetting').returns(BbPromise.resolve());
      const getActivityArnStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArn').returns(BbPromise.resolve());
      const describeActivityStub = sinon
        .stub(serverlessStepFunctions, 'describeActivity').returns(BbPromise.resolve());
      const createActivityStub = sinon
        .stub(serverlessStepFunctions, 'createActivity').returns(BbPromise.resolve());

      return serverlessStepFunctions.activityDeploy()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(checkActivitySettingStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getActivityArnStub.calledAfter(checkActivitySettingStub)).to.be.equal(true);
          expect(describeActivityStub.calledAfter(getActivityArnStub)).to.be.equal(true);
          expect(createActivityStub.calledAfter(describeActivityStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.checkActivitySetting.restore();
          serverlessStepFunctions.getActivityArn.restore();
          serverlessStepFunctions.describeActivity.restore();
          serverlessStepFunctions.createActivity.restore();
        });
    });

    it('should run promise chain in order when name is given with deployed', () => {
      serverlessStepFunctions.deployedActivities.hellofunc = 'deployed';
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const checkActivitySettingStub = sinon
        .stub(serverlessStepFunctions, 'checkActivitySetting').returns(BbPromise.resolve());
      const getActivityArnStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArn').returns(BbPromise.resolve());
      const describeActivityStub = sinon
        .stub(serverlessStepFunctions, 'describeActivity').returns(BbPromise.resolve());
      const createActivityStub = sinon
        .stub(serverlessStepFunctions, 'createActivity').returns(BbPromise.resolve());

      return serverlessStepFunctions.activityDeploy()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(checkActivitySettingStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getActivityArnStub.calledAfter(checkActivitySettingStub)).to.be.equal(true);
          expect(describeActivityStub.calledAfter(getActivityArnStub)).to.be.equal(true);
          expect(createActivityStub.calledAfter(describeActivityStub)).to.be.equal(false);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.checkActivitySetting.restore();
          serverlessStepFunctions.getActivityArn.restore();
          serverlessStepFunctions.describeActivity.restore();
          serverlessStepFunctions.createActivity.restore();
        });
    });

    it('should run promise chain in order when name is not given', () => {
      serverlessStepFunctions.options.name = null;
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const checkActivitySettingsStub = sinon
        .stub(serverlessStepFunctions, 'checkActivitySettings').returns(BbPromise.resolve());
      const getActivityArnsStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArns').returns(BbPromise.resolve());
      const describeActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'describeActivities').returns(BbPromise.resolve());
      const createActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'createActivities').returns(BbPromise.resolve());

      return serverlessStepFunctions.activityDeploy()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(checkActivitySettingsStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getActivityArnsStub.calledAfter(checkActivitySettingsStub)).to.be.equal(true);
          expect(describeActivitiesStub.calledAfter(getActivityArnsStub)).to.be.equal(true);
          expect(createActivitiesStub.calledAfter(describeActivitiesStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.checkActivitySettings.restore();
          serverlessStepFunctions.getActivityArns.restore();
          serverlessStepFunctions.describeActivities.restore();
          serverlessStepFunctions.createActivities.restore();
        });
    });
  });

  describe('#activityDeploy()', () => {
    it('should run promise chain in order when name is given with deployed', () => {
      serverlessStepFunctions.deployedActivities.hellofunc = 'deployed';
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const checkActivitySettingStub = sinon
        .stub(serverlessStepFunctions, 'checkActivitySetting').returns(BbPromise.resolve());
      const getActivityArnStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArn').returns(BbPromise.resolve());
      const describeActivityStub = sinon
        .stub(serverlessStepFunctions, 'describeActivity').returns(BbPromise.resolve());
      const deleteActivityStub = sinon
        .stub(serverlessStepFunctions, 'deleteActivity').returns(BbPromise.resolve());

      return serverlessStepFunctions.activityRemove()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(checkActivitySettingStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getActivityArnStub.calledAfter(checkActivitySettingStub)).to.be.equal(true);
          expect(describeActivityStub.calledAfter(getActivityArnStub)).to.be.equal(true);
          expect(deleteActivityStub.calledAfter(describeActivityStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.checkActivitySetting.restore();
          serverlessStepFunctions.getActivityArn.restore();
          serverlessStepFunctions.describeActivity.restore();
          serverlessStepFunctions.deleteActivity.restore();
        });
    });

    it('should run promise chain in order when name is given with notDeployed', () => {
      serverlessStepFunctions.deployedActivities.hellofunc = 'notDeployed';
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const checkActivitySettingStub = sinon
        .stub(serverlessStepFunctions, 'checkActivitySetting').returns(BbPromise.resolve());
      const getActivityArnStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArn').returns(BbPromise.resolve());
      const describeActivityStub = sinon
        .stub(serverlessStepFunctions, 'describeActivity').returns(BbPromise.resolve());
      const deleteActivityStub = sinon
        .stub(serverlessStepFunctions, 'deleteActivity').returns(BbPromise.resolve());

      return serverlessStepFunctions.activityRemove()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(checkActivitySettingStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getActivityArnStub.calledAfter(checkActivitySettingStub)).to.be.equal(true);
          expect(describeActivityStub.calledAfter(getActivityArnStub)).to.be.equal(true);
          expect(deleteActivityStub.calledAfter(describeActivityStub)).to.be.equal(false);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.checkActivitySetting.restore();
          serverlessStepFunctions.getActivityArn.restore();
          serverlessStepFunctions.describeActivity.restore();
          serverlessStepFunctions.deleteActivity.restore();
        });
    });

    it('should run promise chain in order when name is not given', () => {
      serverlessStepFunctions.options.name = null;
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const checkActivitySettingsStub = sinon
        .stub(serverlessStepFunctions, 'checkActivitySettings').returns(BbPromise.resolve());
      const getActivityArnsStub = sinon
        .stub(serverlessStepFunctions, 'getActivityArns').returns(BbPromise.resolve());
      const describeActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'describeActivities').returns(BbPromise.resolve());
      const deleteActivitiesStub = sinon
        .stub(serverlessStepFunctions, 'deleteActivities').returns(BbPromise.resolve());

      return serverlessStepFunctions.activityRemove()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(checkActivitySettingsStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getActivityArnsStub.calledAfter(checkActivitySettingsStub)).to.be.equal(true);
          expect(describeActivitiesStub.calledAfter(getActivityArnsStub)).to.be.equal(true);
          expect(deleteActivitiesStub.calledAfter(describeActivitiesStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.checkActivitySettings.restore();
          serverlessStepFunctions.getActivityArns.restore();
          serverlessStepFunctions.describeActivities.restore();
          serverlessStepFunctions.deleteActivities.restore();
        });
    });
  });
});

