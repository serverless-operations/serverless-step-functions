'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider');
const ServerlessStepFunctions = require('./index');

describe('#yamlParse', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless({
      configuration: {
        service: 'test',
        provider: 'aws',
      },
      serviceDir: __dirname,
      configurationFilename: 'serverless.yml',
      isConfigurationResolved: true,
      hasResovledCommandsExternally: true,
      isTelemetryReportedExternally: true,
      commands: ['info'],
      options: {},
    });
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  describe('#yamlParse()', () => {
    it('should default to dev when stage and provider are not defined', () => {
      serverlessStepFunctions.serverless.pluginManager.cliOptions.stage = null;
      serverlessStepFunctions.serverless.service.provider = null;
      serverlessStepFunctions.yamlParse();
      expect(serverless.pluginManager.cliOptions.stage).to.be.equal('dev');
    });

    it('should default to us-east-1 when region and provider are not defined', () => {
      serverlessStepFunctions.serverless.pluginManager.cliOptions.region = null;
      serverlessStepFunctions.serverless.service.provider = null;
      serverlessStepFunctions.yamlParse();
      expect(serverless.pluginManager.cliOptions.region).to.be.equal('us-east-1');
    });

    it('should not default to dev when stage is defined', () => {
      serverlessStepFunctions.serverless.pluginManager.cliOptions.stage = 'my-stage';
      serverlessStepFunctions.yamlParse();
      expect(serverless.pluginManager.cliOptions.stage).to.be.equal('my-stage');
    });

    it('should not default to us-east-1 when region is defined', () => {
      serverlessStepFunctions.serverless.pluginManager.cliOptions.region = 'my-region';
      serverlessStepFunctions.yamlParse();
      expect(serverless.pluginManager.cliOptions.region).to.be.equal('my-region');
    });

    it('should create empty object when stepfunctions param are not given', () => {
      serverlessStepFunctions.yamlParse();
      expect(serverless.service.stepFunctions.stateMachines).to.be.deep.equal({});
      expect(serverless.service.stepFunctions.activities).to.be.deep.equal([]);
    });
  });

  describe('#getAllStateMachines()', () => {
    it('should throw error if atateMachines are not object', () => {
      serverless.service.stepFunctions = {
        stateMachines: 'aaa',
      };
      expect(() => serverlessStepFunctions.getAllStateMachines()).to.throw(Error);

      serverless.service.stepFunctions = {
        stateMachines: ['aaa', 'bbb'],
      };
      expect(() => serverlessStepFunctions.getAllStateMachines()).to.throw(Error);
    });

    it('should return statemachine names as array', () => {
      serverless.service.stepFunctions = {
        stateMachines: {
          aaa: {},
          bbb: {},
        },
      };
      expect(serverlessStepFunctions.getAllStateMachines()[0]).to.be.equal('aaa');
      expect(serverlessStepFunctions.getAllStateMachines()[1]).to.be.equal('bbb');
    });
  });

  describe('#getStateMachine()', () => {
    beforeEach(() => {
      serverless.service.stepFunctions = {
        stateMachines: {
          aaa: {
            definition: 'definition1',
          },
        },
      };
    });

    it('should return statemachine object', () => {
      expect(serverlessStepFunctions.getStateMachine('aaa').definition).to.be.equal('definition1');
    });

    it('should throw error if the statemachine does not exists', () => {
      expect(() => serverlessStepFunctions.getStateMachine('bbb').definition).to.throw(Error);
    });
  });

  describe('#isStateMachines()', () => {
    it('should return true if the statemachines exists', () => {
      serverless.service.stepFunctions = {
        stateMachines: {
          aaa: {
            definition: 'definition1',
          },
        },
      };
      expect(serverlessStepFunctions.isStateMachines()).to.be.equal(true);
    });

    it('should return false if the stepfunctions does not exists', () => {
      expect(serverlessStepFunctions.isStateMachines()).to.be.equal(false);
    });

    it('should return false if the stameMachines does not exists', () => {
      serverless.service.stepFunctions = {};
      expect(serverlessStepFunctions.isStateMachines()).to.be.equal(false);
    });

    it('should return false if the stameMachines is empty object', () => {
      serverless.service.stepFunctions = {
        stateMachines: {},
      };
      expect(serverlessStepFunctions.isStateMachines()).to.be.equal(false);
    });
  });

  describe('#getAllActivities()', () => {
    it('should throw error if activities are not array', () => {
      serverless.service.stepFunctions = {
        activities: 'aaa',
      };
      expect(() => serverlessStepFunctions.getAllActivities()).to.throw(Error);

      serverless.service.stepFunctions = {
        activities: { aaa: 'aaa' },
      };
      expect(() => serverlessStepFunctions.getAllActivities()).to.throw(Error);
    });

    it('should return activity names as array', () => {
      serverless.service.stepFunctions = {
        activities: ['aaa', 'bbb'],
      };
      expect(serverlessStepFunctions.getAllActivities()[0]).to.be.equal('aaa');
      expect(serverlessStepFunctions.getAllActivities()[1]).to.be.equal('bbb');
    });
  });

  describe('#getActivity()', () => {
    beforeEach(() => {
      serverless.service.stepFunctions = {
        activities: ['aaa'],
      };
    });

    it('should return activity name', () => {
      expect(serverlessStepFunctions.getActivity('aaa')).to.be.equal('aaa');
    });

    it('should throw error if the activity does not exists', () => {
      expect(() => serverlessStepFunctions.getActivity('bbb').definition).to.throw(Error);
    });
  });

  describe('#isActivities()', () => {
    it('should return true if the activities exists', () => {
      serverless.service.stepFunctions = {
        activities: ['aaa'],
      };
      expect(serverlessStepFunctions.isActivities()).to.be.equal(true);
    });

    it('should return false if the stepfunctions does not exists', () => {
      expect(serverlessStepFunctions.isActivities()).to.be.equal(false);
    });

    it('should return false if the activities does not exists', () => {
      serverless.service.stepFunctions = {};
      expect(serverlessStepFunctions.isActivities()).to.be.equal(false);
    });

    it('should return false if the activities is empty array', () => {
      serverless.service.stepFunctions = {
        activities: [],
      };
      expect(serverlessStepFunctions.isActivities()).to.be.equal(false);
    });
  });
});
