'use strict';

const BbPromise = require('bluebird');
const compileStateMachines = require('./deploy/stepFunctions/compileStateMachines');
const compileActivities = require('./deploy/stepFunctions/compileActivities');
const compileIamRole = require('./deploy/stepFunctions/compileIamRole');
const httpValidate = require('./deploy/events/apiGateway/validate');
const httpResources = require('./deploy/events/apiGateway/resources');
const httpMethods = require('./deploy/events/apiGateway/methods');
const coreCompileRestApi =
  require('serverless/lib/plugins/aws/deploy/compile/events/apiGateway/lib/restApi');
const yamlParser = require('./yamlParser');
const naming = require('./naming');
const _ = require('lodash');

class ServerlessStepFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('aws');
    this.service = this.serverless.service.service;
    this.region = this.provider.getRegion();
    this.stage = this.provider.getStage();

    _.forEach(this.serverless.pluginManager.getPlugins(), (pluginObject, index) => {
      if (pluginObject.constructor.toString().match(/class AwsCompileApigEvents/)) {
        this.awsCompileApigEventsKey = index;
      }
    });

    this.awsCompileApigEvents = this.serverless.pluginManager
      .getPlugins()[this.awsCompileApigEventsKey];
//      .validate().events.length;

    Object.assign(
      this,
      compileStateMachines,
      compileActivities,
      compileIamRole,
      coreCompileRestApi,
      httpValidate,
      httpResources,
      httpMethods,
      yamlParser,
      naming
    );

    this.commands = {
      invoke: {
        commands: {
          stepf: {
            usage: 'Invoke Step functions',
            lifecycleEvents: [
              'invoke',
            ],
            options: {
              name: {
                usage: 'State Machine name',
                shortcut: 'n',
                required: true,
              },
              data: {
                usage: 'String data to be passed as an event to your step function',
                shortcut: 'd',
              },
              path: {
                usage:
                'The path to a json file with input data to be passed to the invoked step function',
                shortcut: 'p',
              },
              stage: {
                usage: 'Stage of the service',
                shortcut: 's',
              },
              region: {
                usage: 'Region of the service',
                shortcut: 'r',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'invoke:stepf:invoke': () => BbPromise.bind(this)
        .then(this.invoke),
      'deploy:initialize': () => BbPromise.bind(this)
          .then(this.yamlParse),
      'deploy:compileFunctions': () => BbPromise.bind(this)
        .then(this.compileIamRole)
        .then(this.compileStateMachines)
        .then(this.compileActivities),
      'deploy:compileEvents': () => {
        this.pluginhttpValidated = this.httpValidate();

        if (this.pluginhttpValidated.events.length === 0) {
          return BbPromise.resolve();
        } else if (!this.isCoreHttpevents()) {
          return BbPromise.bind(this)
            .then(this.compileRestApi)
            .then(this.compileResources)
            .then(this.compileMethods);
        }
        return BbPromise.bind(this)
          .then(this.compileResources);
      },
    };
  }

  invoke() {

  }
}
module.exports = ServerlessStepFunctions;
