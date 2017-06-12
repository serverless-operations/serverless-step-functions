'use strict';

const BbPromise = require('bluebird');
const compileStateMachines = require('./deploy/stepFunctions/compileStateMachines');
const compileActivities = require('./deploy/stepFunctions/compileActivities');
const compileIamRole = require('./deploy/stepFunctions/compileIamRole');
const httpValidate = require('./deploy/events/apiGateway/validate');
const httpResources = require('./deploy/events/apiGateway/resources');
const httpMethods = require('./deploy/events/apiGateway/methods');
const httpIamRole = require('./deploy/events/apiGateway/iamRole');
const httpDeployment = require('./deploy/events/apiGateway/deployment');
const httpRestApi = require('./deploy/events/apiGateway/restApi');
const httpInfo = require('./deploy/events/apiGateway/endpointInfo');
const invoke = require('./invoke/invoke');
const yamlParser = require('./yamlParser');
const naming = require('./naming');
const _ = require('lodash');
const chalk = require('chalk');

class ServerlessStepFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('aws');
    this.service = this.serverless.service.service;
    this.region = this.provider.getRegion();
    this.stage = this.provider.getStage();

    Object.assign(
      this,
      compileStateMachines,
      compileActivities,
      compileIamRole,
      httpRestApi,
      httpInfo,
      httpValidate,
      httpResources,
      httpMethods,
      httpIamRole,
      httpDeployment,
      invoke,
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
                usage: 'The StateMachine name',
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
      'package:initialize': () => BbPromise.bind(this)
        .then(this.yamlParse),
      'package:compileFunctions': () => BbPromise.bind(this)
        .then(this.compileIamRole)
        .then(this.compileStateMachines)
        .then(this.compileActivities),
      'package:compileEvents': () => {
        this.pluginhttpValidated = this.httpValidate();

        if (this.pluginhttpValidated.events.length === 0) {
          return BbPromise.resolve();
        }

        return BbPromise.bind(this)
          .then(this.compileRestApi)
          .then(this.compileResources)
          .then(this.compileMethods)
          .then(this.compileHttpIamRole)
          .then(this.compileDeployment);
      },
      'after:deploy:deploy': () => BbPromise.bind(this)
        .then(this.getEndpointInfo)
        .then(this.display),
    };
  }

  invoke() {
    return BbPromise.bind(this)
    .then(this.getStateMachineArn)
    .then(this.startExecution)
    .then(this.describeExecution)
    .then((result) => {
      this.serverless.cli.consoleLog('');
      if (result.status === 'FAILED') {
        return this.getExecutionHistory()
        .then((error) => {
          this.serverless.cli.consoleLog(_.merge(result, error.events[error.events.length - 1]
          .executionFailedEventDetails));
          process.exitCode = 1;
        });
      }
      this.serverless.cli.consoleLog(result);
      return BbPromise.resolve();
    });
  }

  display() {
    let message = '';

    const endpointInfo = this.endpointInfo;
    message += `${chalk.yellow.underline('Serverless StepFunctions OutPuts')}\n`;
    message += `${chalk.yellow('endpoints:')}`;
    if (this.isStateMachines()) {
      _.forEach(this.getAllStateMachines(), (stateMachineName) => {
        const stateMachineObj = this.getStateMachine(stateMachineName);
        if (stateMachineObj.events != null && _.isArray(stateMachineObj.events)) {
          stateMachineObj.events.forEach(event => {
            if (event.http) {
              let method;
              let path;

              if (typeof event.http === 'object') {
                method = event.http.method.toUpperCase();
                path = event.http.path;
              } else {
                method = event.http.split(' ')[0].toUpperCase();
                path = event.http.split(' ')[1];
              }
              path = path !== '/' ? `/${path.split('/').filter(p => p !== '').join('/')}` : '';
              message += `\n  ${method} - ${endpointInfo}${path}`;
            }
          });
        }
      });
    }
    message += '\n';
    this.serverless.cli.consoleLog(message);
    return message;
  }
}
module.exports = ServerlessStepFunctions;
