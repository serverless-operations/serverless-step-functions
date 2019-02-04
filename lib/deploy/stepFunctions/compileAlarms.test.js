'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../index');

describe('#compileAlarms', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.cli = { consoleLog: console.log };
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
    const genStateMachine = (name) => ({
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
          'executionsTimeOut',
          'executionsFailed',
          'executionsAborted',
          'executionThrottled',
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
    expect(resources).to.have.property('StateMachineBeta1ExecutionsTimeOutAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta1ExecutionsTimeOutAlarm);
    expect(resources).to.have.property('StateMachineBeta1ExecutionsFailedAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta1ExecutionsFailedAlarm);
    expect(resources).to.have.property('StateMachineBeta1ExecutionsAbortedAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta1ExecutionsAbortedAlarm);
    expect(resources).to.have.property('StateMachineBeta1ExecutionThrottledAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta1ExecutionThrottledAlarm);
    expect(resources).to.have.property('StateMachineBeta2ExecutionsTimeOutAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta2ExecutionsTimeOutAlarm);
    expect(resources).to.have.property('StateMachineBeta2ExecutionsFailedAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta2ExecutionsFailedAlarm);
    expect(resources).to.have.property('StateMachineBeta2ExecutionsAbortedAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta2ExecutionsAbortedAlarm);
    expect(resources).to.have.property('StateMachineBeta2ExecutionThrottledAlarm');
    validateCloudWatchAlarm(resources.StateMachineBeta2ExecutionThrottledAlarm);
  });

  it('should not generate CloudWatch Alarms when alarms.topics is missing', () => {
    const genStateMachine = (name) => ({
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
          'executionsTimeOut',
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
  });

  it('should not generate CloudWatch Alarms when alarms.topics is empty', () => {
    const genStateMachine = (name) => ({
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
          'executionsTimeOut',
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
  });

  it('should not generate CloudWatch Alarms when alarms.metrics is missing', () => {
    const genStateMachine = (name) => ({
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
  });

  it('should not generate CloudWatch Alarms for unsupported metrics', () => {
    const genStateMachine = (name) => ({
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
  });
});
