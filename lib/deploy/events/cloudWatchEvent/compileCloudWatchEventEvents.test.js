'use strict';

const itParam = require('mocha-param');
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
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#compileCloudWatchEventEvents()', () => {
    itParam('should throw an error if event type is not an object', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: 42,
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileCloudWatchEventEvents()).to.throw(Error);
    });

    itParam('should throw an error if the "event" property is not given', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
                  event: null,
                },
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileCloudWatchEventEvents()).to.throw(Error);
    });

    itParam('should create corresponding resources when events are given', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                },
              },
              {
                [source]: {
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

    itParam('should respect enabled variable, defaulting to true', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                },
              },
              {
                [source]: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: true,
                },
              },
              {
                [source]: {
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

    itParam('should respect inputPath variable', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
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

    itParam('should respect input variable', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
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

    itParam('should respect description variable', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
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

    itParam('should respect name variable', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
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

    itParam('should respect eventBusName variable', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
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

    itParam('should respect eventBusName intrinsic function', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
                  event: {
                    source: ['aws.ec2'],
                    'detail-type': ['EC2 Instance State-change Notification'],
                    detail: { state: ['pending'] },
                  },
                  enabled: false,
                  input: '{"key":"value"}',
                  name: 'test-event-name',
                  eventBusName: '{"Fn::If": [isLocal, "develop", "production"}',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileCloudWatchEventEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstEventsRuleCloudWatchEvent1
        .Properties.EventBusName).to.equal('{"Fn::If": [isLocal, "develop", "production"}');
    });

    itParam('should respect input variable as an object', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
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

    itParam('should throw an error when both Input and InputPath are set', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
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

    itParam('should respect variables if multi-line variables is given', ['cloudwatchEvent', 'eventBridge'], (source) => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                [source]: {
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

    it('should not create corresponding resources when events are not given', () => {
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
