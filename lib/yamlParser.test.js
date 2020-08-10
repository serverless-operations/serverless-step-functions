'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const path = require('path');
const BbPromise = require('bluebird');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('#yamlParse', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
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
    let yamlParserStub;
    let populateServiceStub;
    let yamlObjectParserStub;
    beforeEach(() => {
      populateServiceStub = sinon.stub(serverlessStepFunctions.serverless.variables,
        'populateService').returns(BbPromise.resolve());
      yamlObjectParserStub = sinon.stub(serverlessStepFunctions.serverless.variables,
        'populateObject').returns(BbPromise.resolve({
        stepFunctions: {
          stateMachines: 'stepFunctions',
          activities: 'my-activity',
        },
      }));
      yamlParserStub = sinon.stub(serverlessStepFunctions.serverless.yamlParser, 'parse')
        .returns(BbPromise.resolve({
          stepFunctions: {
            stateMachines: 'stepFunctions',
            activities: 'my-activity',
          },
        }));
      serverlessStepFunctions.serverless.config.servicePath = 'servicePath';
    });

    afterEach(() => {
      serverlessStepFunctions.serverless.yamlParser.parse.restore();
      serverlessStepFunctions.serverless.variables.populateService.restore();
      serverlessStepFunctions.serverless.variables.populateObject.restore();
    });

    it('should default to dev when stage and provider are not defined', () => {
      serverlessStepFunctions.serverless.pluginManager.cliOptions.stage = null;
      serverlessStepFunctions.serverless.service.provider = null;
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(serverless.pluginManager.cliOptions.stage).to.be.equal('dev');
        });
    });

    it('should default to us-east-1 when region and provider are not defined', () => {
      serverlessStepFunctions.serverless.pluginManager.cliOptions.region = null;
      serverlessStepFunctions.serverless.service.provider = null;
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(serverless.pluginManager.cliOptions.region).to.be.equal('us-east-1');
        });
    });

    it('should not default to dev when stage is defined', () => {
      serverlessStepFunctions.serverless.pluginManager.cliOptions.stage = 'my-stage';
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(serverless.pluginManager.cliOptions.stage).to.be.equal('my-stage');
        });
    });

    it('should not default to us-east-1 when region is defined', () => {
      serverlessStepFunctions.serverless.pluginManager.cliOptions.region = 'my-region';
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(serverless.pluginManager.cliOptions.region).to.be.equal('my-region');
        });
    });

    it('should throw error if servicePath is not given', () => {
      serverlessStepFunctions.serverless.config.servicePath = null;
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(yamlParserStub.calledOnce).to.be.equal(false);
          expect(yamlObjectParserStub.calledOnce).to.be.equal(false);
          expect(populateServiceStub.calledOnce).to.be.equal(false);
        expect(serverless.service.stepFunctions).to.be.undefined; // eslint-disable-line
        });
    });

    it('should create corresponding when stepfunctions param are given', () => {
      serverlessStepFunctions.serverless.variables.populateObject.restore();
      yamlObjectParserStub = sinon.stub(serverlessStepFunctions.serverless.variables,
        'populateObject').returns(BbPromise.resolve({
        stepFunctions: {
          stateMachines: 'stepFunctions',
          activities: 'my-activity',
        },
      }));
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(yamlParserStub.calledOnce).to.be.equal(true);
          expect(yamlObjectParserStub.calledOnce).to.be.equal(true);
          expect(populateServiceStub.calledOnce).to.be.equal(true);
          expect(serverless.service.stepFunctions.stateMachines).to.be.equal('stepFunctions');
          expect(serverless.service.stepFunctions.activities).to.be.equal('my-activity');
        });
    });

    it('should be able to load from a js file', () => {
      serverless.config.serverless.service.serviceFilename = 'serverless.js';
      const requireFileStub = sinon.stub(serverlessStepFunctions, 'loadFromRequiredFile')
        .returns(BbPromise.resolve({
          stepFunctions: {
            stateMachines: 'stepFunctions',
            activities: 'my-activity',
          },
        }));
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(requireFileStub.calledOnce).to.be.equal(true);
          expect(serverless.service.stepFunctions.stateMachines).to.be.equal('stepFunctions');
          expect(serverless.service.stepFunctions.activities).to.be.equal('my-activity');
        });
    });

    it('should be able to load from a json file', () => {
      serverless.config.serverless.service.serviceFilename = 'serverless.json';
      const requireFileStub = sinon.stub(serverlessStepFunctions, 'loadFromRequiredFile')
        .returns(BbPromise.resolve({
          stepFunctions: {
            stateMachines: 'stepFunctions',
            activities: 'my-activity',
          },
        }));
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(requireFileStub.calledOnce).to.be.equal(true);
          expect(serverless.service.stepFunctions.stateMachines).to.be.equal('stepFunctions');
          expect(serverless.service.stepFunctions.activities).to.be.equal('my-activity');
        });
    });

    it('should be able to load from a ts file', () => {
      serverless.config.serverless.service.serviceFilename = 'serverless.ts';
      const requireFileStub = sinon.stub(serverlessStepFunctions, 'loadFromRequiredFile')
        .returns(BbPromise.resolve({
          stepFunctions: {
            stateMachines: 'stepFunctions',
            activities: 'my-activity',
          },
        }));
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(requireFileStub.calledOnce).to.be.equal(true);
          expect(serverless.service.stepFunctions.stateMachines).to.be.equal('stepFunctions');
          expect(serverless.service.stepFunctions.activities).to.be.equal('my-activity');
        });
    });

    it('should create empty object when stepfunctions param are not given', () => {
      serverlessStepFunctions.serverless.yamlParser.parse.restore();
      serverlessStepFunctions.serverless.variables.populateObject.restore();
      yamlParserStub = sinon.stub(serverlessStepFunctions.serverless.yamlParser, 'parse')
        .returns(BbPromise.resolve({
          stepFunctions: {},
        }));
      yamlObjectParserStub = sinon.stub(serverless.variables,
        'populateObject').returns(BbPromise.resolve({
        stepFunctions: {},
      }));
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(yamlParserStub.calledOnce).to.be.equal(true);
          expect(yamlObjectParserStub.calledOnce).to.be.equal(true);
          expect(populateServiceStub.calledOnce).to.be.equal(true);
          expect(serverless.service.stepFunctions.stateMachines).to.be.deep.equal({});
          expect(serverless.service.stepFunctions.activities).to.be.deep.equal([]);
        });
    });

    it('should default to serverless.yml if serviceFileName (--config option) is not passed', () => {
      const servicePath = serverlessStepFunctions.serverless.config.servicePath;
      serverlessStepFunctions.serverless.config.serverless.service.serviceFilename = undefined;

      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(yamlParserStub.calledWith(`${servicePath}/serverless.yml`)).to.be.equal(true);
        });
    });

    it('should read serviceFileName if passed as --config option', () => {
      const servicePath = serverlessStepFunctions.serverless.config.servicePath;
      const fileName = 'other_config.yml';
      serverlessStepFunctions.serverless.config.serverless.service.serviceFilename = fileName;

      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(yamlParserStub.calledWith(`${servicePath}/${fileName}`)).to.be.equal(true);
        });
    });

    it('should read relative serviceFileName path if passed as --config option', () => {
      const servicePath = serverlessStepFunctions.serverless.config.servicePath;
      const relativeFilename = './some_folder/other_config.yml';
      serverlessStepFunctions.options.config = relativeFilename;
      const serviceFilePath = path.normalize(`${servicePath}/${relativeFilename}`);
      serverlessStepFunctions.yamlParse()
        .then(() => {
          expect(yamlParserStub.calledWith(serviceFilePath)).to.be.equal(true);
        });
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
