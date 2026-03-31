'use strict';

const expect = require('chai').expect;
const createServerless = require('../../../test/createServerless');
const ServerlessStepFunctions = require('../../..');

describe('#httpValidate()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = createServerless();
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
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

    it('should respect inputTransformer variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  inputTransformer: {
                    inputPathsMap: {
                      stage: '$.stageVariables',
                    },
                    inputTemplate: '{ "stage": <stage> }',
                  },
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstStepFunctionsEventsRuleSchedule1
        .Properties.Targets[0].InputTransformer.InputPathsMap)
        .to.have.property('stage', '$.stageVariables');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstStepFunctionsEventsRuleSchedule1
        .Properties.Targets[0].InputTransformer.InputTemplate).to.equal('{ "stage": <stage> }');
    });

    it('should throw an error when Input and InputPath and InputTransformer are set', () => {
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
                  inputTransformer: {
                    inputPathsMap: {
                      stage: '$.stageVariables',
                    },
                    inputTemplate: '{ "stage": <stage> }',
                  },
                },
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileScheduledEvents()).to.throw(Error);
    });
  });
  it('should handle permissionsBoundary', () => {
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
    const permBoundaryArn = 'arn:aws:iam::myAccount:policy/permission_boundary';
    serverless.service.provider.rolePermissionsBoundary = permBoundaryArn;
    serverlessStepFunctions.compileScheduledEvents();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .FirstScheduleToStepFunctionsRole
      .Properties.PermissionsBoundary).to.equal(permBoundaryArn);
  });

  it('should handle provider.iam.role.path', () => {
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
    serverless.service.provider.iam = { role: { path: '/teamA/' } };
    serverlessStepFunctions.compileScheduledEvents();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .FirstScheduleToStepFunctionsRole
      .Properties.Path).to.equal('/teamA/');
  });

  it('should have type of AWS::Scheduler::Schedule if method is scheduler', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              schedule: {
                method: 'scheduler',
                rate: 'rate(10 minutes)',
                enabled: false,
                timezone: 'Asia/Mumbai',
              },
            },
          ],
        },
      },
    };
    serverlessStepFunctions.compileScheduledEvents();
    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .FirstStepFunctionsSchedulerSchedule1.Type).to.equal('AWS::Scheduler::Schedule');
  });

  it('should have service as scheduler.amazonaws.com if method is scheduler', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              schedule: {
                method: 'scheduler',
                rate: 'rate(10 minutes)',
                enabled: false,
                timezone: 'Asia/Mumbai',
              },
            },
          ],
        },
      },
    };
    serverlessStepFunctions.compileScheduledEvents();
    const { Statement } = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .FirstScheduleToStepFunctionsRole.Properties.AssumeRolePolicyDocument;
    expect(Statement[0].Principal.Service).to.equal('scheduler.amazonaws.com');
  });

  it('should define timezone when schedular and timezone given', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              schedule: {
                method: 'scheduler',
                rate: 'rate(10 minutes)',
                enabled: false,
                timezone: 'Asia/Mumbai',
              },
            },
          ],
        },
      },
    };
    serverlessStepFunctions.compileScheduledEvents();

    expect(serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .FirstStepFunctionsSchedulerSchedule1.Properties.ScheduleExpressionTimezone)
      .to.equal('Asia/Mumbai');
  });

  it('should define input when schedular and input are given', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              schedule: {
                method: 'scheduler',
                rate: 'cron(1 3 * * ? *)',
                enabled: false,
                timezone: 'Asia/Mumbai',
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
      .FirstStepFunctionsSchedulerSchedule1.Properties.Target.Input)
      .to.equal('{"key":"value"}');
  });

  it('should accept timezone only if method is scheduler', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              schedule: {
                rate: 'rate(10 minutes)',
                enabled: false,
                timezone: 'Asia/Mumbai',
              },
            },
          ],
        },
      },
    };
    expect(() => serverlessStepFunctions.compileScheduledEvents()).to.throw(Error);
  });

  it('should set RetryPolicy on eventBus target when retryPolicy is given', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              schedule: {
                rate: 'rate(10 minutes)',
                retryPolicy: {
                  maximumEventAgeInSeconds: 7200,
                  maximumRetryAttempts: 5,
                },
              },
            },
          ],
        },
      },
    };

    serverlessStepFunctions.compileScheduledEvents();

    const target = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .FirstStepFunctionsEventsRuleSchedule1.Properties.Targets[0];
    expect(target.RetryPolicy.MaximumEventAgeInSeconds).to.equal(7200);
    expect(target.RetryPolicy.MaximumRetryAttempts).to.equal(5);
  });

  it('should not set RetryPolicy on eventBus target when retryPolicy is not given', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              schedule: {
                rate: 'rate(10 minutes)',
              },
            },
          ],
        },
      },
    };

    serverlessStepFunctions.compileScheduledEvents();

    const target = serverlessStepFunctions.serverless.service
      .provider.compiledCloudFormationTemplate.Resources
      .FirstStepFunctionsEventsRuleSchedule1.Properties.Targets[0];
    expect(target.RetryPolicy).to.equal(undefined);
  });
});
