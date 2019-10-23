'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('awsCompileCloudWatchEventEvents', () => {
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
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#compileCloudWatchEventEvents()', () => {
    it('should throw an error if cloudwatch event type is not an object', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: 42,
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileCloudWatchEventEvents()).to.throw(Error);
    });

    it('should throw an error if the "event" property is not given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: null,
                },
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileCloudWatchEventEvents()).to.throw(Error);
    });

    it('should create corresponding resources when cloudwatch events are given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                },
              },
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: true,
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1.Type).to.equal('AWS::Events::Rule');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent2.Type).to.equal('AWS::Events::Rule');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstEventToStepFunctionsRole.Type).to.equal('AWS::IAM::Role');
    });

    it('should respect enabled variable, defaulting to true', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                },
              },
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: true,
                },
              },
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1
        .Properties.State).to.equal('DISABLED');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent2
        .Properties.State).to.equal('ENABLED');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent3
        .Properties.State).to.equal('ENABLED');
    });

    it('should respect inputPath variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                  inputPath: '$.stageVariables',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1
        .Properties.Targets[0].InputPath).to.equal('$.stageVariables');
    });

    it('should respect input variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                  input: '{"key":"value"}',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1
        .Properties.Targets[0].Input).to.equal('{"key":"value"}');
    });

    it('should respect description variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                  input: '{"key":"value"}',
                  description: 'test description',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1
        .Properties.Description).to.equal('test description');
    });

    it('should respect name variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                  input: '{"key":"value"}',
                  name: 'test-event-name',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1
        .Properties.Name).to.equal('test-event-name');
    });

    it('should respect eventBusName variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                  input: '{"key":"value"}',
                  name: 'test-event-name',
                  eventBusName: 'custom-event-bus',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1
        .Properties.EventBusName).to.equal('custom-event-bus');
    });

    it('should respect input variable as an object', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
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

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1
        .Properties.Targets[0].Input).to.equal('{"key":"value"}');
    });

    it('should throw an error when both Input and InputPath are set', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
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

      expect(() => serverlessStepFunctions.compileCloudWatchEventEvents()).to.throw(Error);
    });

    it('should respect variables if multi-line variables is given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                cloudwatchEvent: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification \n with newline'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                  input: {
                    key: 'value\n',
                  },
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstEventsRuleCloudWatchEvent1.Properties.EventPattern['detail-type'][0]).to.equal('EC2 Instance State-change Notification  with newline');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstEventsRuleCloudWatchEvent1.Properties.Targets[0].Input).to.equal('{"key":"value"}');
    });

    it('should not create corresponding resources when cloudwatch events are not given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources,
      ).to.deep.equal({});
    });
  });
});
