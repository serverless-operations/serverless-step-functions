'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../index');

describe('#compileAlarms', () => {
  let consoleLogSpy;
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    consoleLogSpy = sinon.spy();
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.cli = { consoleLog: consoleLogSpy };
    const options = {
      stage: 'dev',
      region: 'ap-northeast-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  const validateCloudWatchAlarm = (alarm) => {
    expect(alarm.Type).to.equal('AWS::CloudWatch::Alarm');
    expect(alarm.Properties.Namespace).to.equal('AWS/States');
    expect(alarm.Properties.Threshold).to.equal(1);
    expect(alarm.Properties.Period).to.equal(60);
    expect(alarm.Properties.Statistic).to.equal('Sum');
    expect(alarm.Properties.Dimensions).to.have.lengthOf(1);
    expect(alarm.Properties.Dimensions[0].Name).to.equal('StateMachineArn');
  };

  it('should generate CloudWatch Alarms', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      alarms: {
        topics: {
          ok: '${self:service}-${opt:stage}-alerts-ok',
          alarm: '${self:service}-${opt:stage}-alerts-alarm',
          insufficientData: '${self:service}-${opt:stage}-alerts-missing',
        },
        metrics: [
          'executionsTimedOut',
          'executionsFailed',
          'executionsAborted',
          'executionThrottled',
          'executionsSucceeded',
        ],
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(resources).to.have.property('StateMachineBeta1ExecutionsTimedOutAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta1ExecutionsTimedOutAlarm);
    expect(resources).to.have.property('StateMachineBeta1ExecutionsFailedAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta1ExecutionsFailedAlarm);
    expect(resources).to.have.property('StateMachineBeta1ExecutionsAbortedAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta1ExecutionsAbortedAlarm);
    expect(resources).to.have.property('StateMachineBeta1ExecutionThrottledAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta1ExecutionThrottledAlarm);
    expect(resources).to.have.property('StateMachineBeta2ExecutionsTimedOutAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta2ExecutionsTimedOutAlarm);
    expect(resources).to.have.property('StateMachineBeta2ExecutionsFailedAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta2ExecutionsFailedAlarm);
    expect(resources).to.have.property('StateMachineBeta2ExecutionsAbortedAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta2ExecutionsAbortedAlarm);
    expect(resources).to.have.property('StateMachineBeta2ExecutionThrottledAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta2ExecutionThrottledAlarm);

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should not generate logs when no CloudWatch Alarms are defiened', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should not generate CloudWatch Alarms when alarms.topics is missing', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      alarms: {
        metrics: [
          'executionsTimedOut',
        ],
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(2);
  });

  it('should not generate CloudWatch Alarms when alarms.topics is empty', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      alarms: {
        topics: {},
        metrics: [
          'executionsTimedOut',
        ],
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(2);
  });

  it('should not generate CloudWatch Alarms when alarms.metrics is missing', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      alarms: {
        topics: {
          ok: '${self:service}-${opt:stage}-alerts-ok',
        },
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    expect(_.keys(resources)).to.have.lengthOf(0);

    expect(consoleLogSpy.callCount).equal(2);
  });

  it('should not generate CloudWatch Alarms for unsupported metrics', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      alarms: {
        topics: {
          ok: '${self:service}-${opt:stage}-alerts-ok',
        },
        metrics: [
          'executionsFailed',
          'executionsFail',
        ],
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;
    // valid metrics => CW alarms
    expect(resources).to.have.property('StateMachineBeta1ExecutionsFailedAlarm');
    expect(resources).to.have.property('StateMachineBeta2ExecutionsFailedAlarm');

    // but invalid metric names are skipped
    expect(_.keys(resources)).to.have.lengthOf(2);

    expect(consoleLogSpy.callCount).equal(2);
  });

  it('should use specified treatMissingData for all alarms', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      alarms: {
        topics: {
          ok: '${self:service}-${opt:stage}-alerts-ok',
          alarm: '${self:service}-${opt:stage}-alerts-alarm',
          insufficientData: '${self:service}-${opt:stage}-alerts-missing',
        },
        metrics: [
          'executionsTimedOut',
          'executionsFailed',
          'executionsAborted',
          'executionThrottled',
          'executionsSucceeded',
        ],
        treatMissingData: 'ignore',
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const verify = (resourceName) => {
      expect(resources).to.have.property(resourceName);
      expect(resources[resourceName].Properties.TreatMissingData).to.equal('ignore');
    };

    verify('StateMachineBeta1ExecutionsTimedOutAlarm');
    verify('StateMachineBeta1ExecutionsFailedAlarm');
    verify('StateMachineBeta1ExecutionsAbortedAlarm');
    verify('StateMachineBeta1ExecutionThrottledAlarm');
    verify('StateMachineBeta2ExecutionsTimedOutAlarm');
    verify('StateMachineBeta2ExecutionsFailedAlarm');
    verify('StateMachineBeta2ExecutionsAbortedAlarm');
    verify('StateMachineBeta2ExecutionThrottledAlarm');

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should allow individual alarms to override default treatMissingData', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      alarms: {
        topics: {
          ok: '${self:service}-${opt:stage}-alerts-ok',
          alarm: '${self:service}-${opt:stage}-alerts-alarm',
          insufficientData: '${self:service}-${opt:stage}-alerts-missing',
        },
        metrics: [
          'executionsTimedOut',
          { metric: 'executionsFailed', treatMissingData: 'breaching' },
          'executionsAborted',
          'executionThrottled',
          'executionsSucceeded',
        ],
        treatMissingData: 'ignore',
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine1: genStateMachine('stateMachineBeta1'),
        myStateMachine2: genStateMachine('stateMachineBeta2'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    const verify = (resourceName, expectedConfig = 'ignore') => {
      expect(resources).to.have.property(resourceName);
      expect(resources[resourceName].Properties.TreatMissingData).to.equal(expectedConfig);
    };

    verify('StateMachineBeta1ExecutionsTimedOutAlarm');
    verify('StateMachineBeta1ExecutionsFailedAlarm', 'breaching');
    verify('StateMachineBeta1ExecutionsAbortedAlarm');
    verify('StateMachineBeta1ExecutionThrottledAlarm');
    verify('StateMachineBeta2ExecutionsTimedOutAlarm');
    verify('StateMachineBeta2ExecutionsFailedAlarm', 'breaching');
    verify('StateMachineBeta2ExecutionsAbortedAlarm');
    verify('StateMachineBeta2ExecutionThrottledAlarm');

    expect(consoleLogSpy.callCount).equal(0);
  });

  it('should allow alarms to override default logical ID', () => {
    const genStateMachine = name => ({
      name,
      definition: {
        StartAt: 'A',
        States: {
          A: {
            Type: 'Pass',
            End: true,
          },
        },
      },
      alarms: {
        topics: {
          ok: '${self:service}-${opt:stage}-alerts-ok',
          alarm: '${self:service}-${opt:stage}-alerts-alarm',
          insufficientData: '${self:service}-${opt:stage}-alerts-missing',
        },
        metrics: [
          { metric: 'executionsFailed', logicalId: 'MyAlarm', treatMissingData: 'breaching' },
        ],
        treatMissingData: 'ignore',
      },
    });

    serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: genStateMachine('stateMachineBeta'),
      },
    };

    serverlessStepFunctions.compileAlarms();
    const resources = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources;

    expect(resources).to.have.property('MyAlarm');
    expect(consoleLogSpy.callCount).equal(0);
  });
});
