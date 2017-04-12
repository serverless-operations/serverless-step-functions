'use strict';

const _ = require('lodash');

const DEFAULT_STATUS_CODES = {
  200: {
    pattern: '',
  },
  400: {
    pattern: '.*\\[400\\].*',
  },
  401: {
    pattern: '.*\\[401\\].*',
  },
  403: {
    pattern: '.*\\[403\\].*',
  },
  404: {
    pattern: '.*\\[404\\].*',
  },
  422: {
    pattern: '.*\\[422\\].*',
  },
  500: {
    pattern: '.*(Process\\s?exited\\s?before\\s?completing\\s?request|\\[500\\]).*',
  },
  502: {
    pattern: '.*\\[502\\].*',
  },
  504: {
    pattern: '.*\\[504\\].*',
  },
};

module.exports = {
  httpValidate() {
    const events = [];
    const corsPreflight = {};

    _.forEach(this.getAllStateMachines(), (stateMachineName) => {
      const stateMachineObj = this.getStateMachine(stateMachineName);
      _.forEach(stateMachineObj.events, (event) => {
        if (_.has(event, 'http')) {
          const http = this.getHttp(event, stateMachineName);

          http.path = this.getHttpPath(http, stateMachineName);
          http.method = this.getHttpMethod(http, stateMachineName);
          http.request = {};

          http.request.passThrough = 'NEVER';
          http.response = {};

          if (http.response.statusCodes) {
            http.response.statusCodes = _.assign({}, http.response.statusCodes);

            if (!_.some(http.response.statusCodes, code => code.pattern === '')) {
              http.response.statusCodes['200'] = DEFAULT_STATUS_CODES['200'];
            }
          } else {
            http.response.statusCodes = DEFAULT_STATUS_CODES;
          }

          events.push({
            stateMachineName,
            http,
          });
        }
      });
    });

    return {
      events,
      corsPreflight,
    };
  },

  isCoreHttpevents() {
    _.forEach(this.serverless.service.functions, (functionObject) => {
      _.forEach(functionObject.events, (event) => {
        if (_.has(event, 'http')) {
          return true;
        }
        return false;
      });
    });
  },

  getHttp(event, functionName) {
    if (typeof event.http === 'object') {
      return event.http;
    } else if (typeof event.http === 'string') {
      return {
        method: event.http.split(' ')[0],
        path: event.http.split(' ')[1],
      };
    }
    const errorMessage = [
      `Invalid http event in function "${functionName}"`,
      ' in serverless.yml.',
      ' If you define an http event, make sure you pass a valid value for it,',
      ' either as string syntax, or object syntax.',
      ' Please check the docs for more options.',
    ].join('');
    throw new this.serverless.classes.Error(errorMessage);
  },

  getHttpPath(http, functionName) {
    if (typeof http.path === 'string') {
      return http.path.replace(/^\//, '').replace(/\/$/, '');
    }
    const errorMessage = [
      `Missing or invalid "path" property in function "${functionName}"`,
      ' for http event in serverless.yml.',
      ' If you define an http event, make sure you pass a valid value for it,',
      ' either as string syntax, or object syntax.',
      ' Please check the docs for more options.',
    ].join('');
    throw new this.serverless.classes.Error(errorMessage);
  },

  getHttpMethod(http, functionName) {
    if (typeof http.method === 'string') {
      const method = http.method.toLowerCase();

      const allowedMethods = [
        'get', 'post', 'put', 'patch', 'options', 'head', 'delete', 'any',
      ];
      if (allowedMethods.indexOf(method) === -1) {
        const errorMessage = [
          `Invalid APIG method "${http.method}" in function "${functionName}".`,
          ` AWS supported methods are: ${allowedMethods.join(', ')}.`,
        ].join('');
        throw new this.serverless.classes.Error(errorMessage);
      }
      return method;
    }
    const errorMessage = [
      `Missing or invalid "method" property in function "${functionName}"`,
      ' for http event in serverless.yml.',
      ' If you define an http event, make sure you pass a valid value for it,',
      ' either as string syntax, or object syntax.',
      ' Please check the docs for more options.',
    ].join('');
    throw new this.serverless.classes.Error(errorMessage);
  },
};
