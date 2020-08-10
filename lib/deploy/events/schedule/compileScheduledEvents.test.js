'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#httpValidate()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#compileScheduledEvents()', () => {
    it('should throw an error if schedule event type is not a string or an object', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: 42,
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileScheduledEvents()).to.throw(Error);
    });

    it('should throw an error if the "rate" property is not given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: null,
                },
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileScheduledEvents()).to.throw(Error);
    });

    it('should create corresponding resources when schedule events are given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                },
              },
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: true,
                },
              },
              {
                schedule: 'rate(10 minutes)',
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule1.Type).to.equal('AWS::Events::Rule');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule2.Type).to.equal('AWS::Events::Rule');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule3.Type).to.equal('AWS::Events::Rule');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstScheduleToStepFunctionsRole.Type).to.equal('AWS::IAM::Role');
    });

    it('should respect enabled variable, defaulting to true', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                },
              },
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: true,
                },
              },
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                },
              },
              {
                schedule: 'rate(10 minutes)',
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule1
        .Properties.State).to.equal('DISABLED');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule2
        .Properties.State).to.equal('ENABLED');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule3
        .Properties.State).to.equal('ENABLED');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule4
        .Properties.State).to.equal('ENABLED');
    });

    it('should respect name variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  name: 'your-scheduled-event-name',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule1
        .Properties.Name).to.equal('your-scheduled-event-name');
    });

    it('should respect description variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  description: 'your scheduled event description',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule1
        .Properties.Description).to.equal('your scheduled event description');
    });

    it('should respect inputPath variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  inputPath: '$.stageVariables',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule1
        .Properties.Targets[0].InputPath).to.equal('$.stageVariables');
    });

    it('should respect input variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  input: '{"key":"value"}',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule1
        .Properties.Targets[0].Input).to.equal('{"key":"value"}');
    });

    it('should respect input variable as an object', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  input: {
                    key: 'value',
                  },
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsEventsRuleSchedule1
        .Properties.Targets[0].Input).to.equal('{"key":"value"}');
    });

    it('should throw an error when both Input and InputPath are set', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  input: {
                    key: 'value',
                  },
                  inputPath: '$.stageVariables',
                },
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileScheduledEvents()).to.throw(Error);
    });

    it('should respect role variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  role: 'arn:aws:iam::000000000000:role/test-role',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstScheduleToStepFunctionsRole).to.equal(undefined);

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstStepFunctionsEventsRuleSchedule1
        .Properties.Targets[0].RoleArn).to.equal('arn:aws:iam::000000000000:role/test-role');
    });

    it('should not create corresponding resources when scheduled events are not given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources,
      ).to.deep.equal({});

      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              'schedule',
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources,
      ).to.deep.equal({});
    });
  });
});
