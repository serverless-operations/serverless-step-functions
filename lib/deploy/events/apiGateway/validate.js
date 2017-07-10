'use strict';
const NOT_FOUND = -1;
const _ = require('lodash');

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

          if (http.cors) {
            http.cors = this.getCors(http);

            const cors = corsPreflight[http.path] || {};

            cors.headers = _.union(http.cors.headers, cors.headers);
            cors.methods = _.union(http.cors.methods, cors.methods);
            cors.origins = _.union(http.cors.origins, cors.origins);
            cors.origin = http.cors.origin || '*';
            cors.allowCredentials = cors.allowCredentials || http.cors.allowCredentials;

            corsPreflight[http.path] = cors;
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

  getHttp(event, stateMachineName) {
    if (typeof event.http === 'object') {
      return event.http;
    } else if (typeof event.http === 'string') {
      return {
        method: event.http.split(' ')[0],
        path: event.http.split(' ')[1],
      };
    }
    const errorMessage = [
      `Invalid http event in stateMachine "${stateMachineName}"`,
      ' in serverless.yml.',
      ' If you define an http event, make sure you pass a valid value for it,',
      ' either as string syntax, or object syntax.',
      ' Please check the docs for more options.',
    ].join('');
    throw new this.serverless.classes.Error(errorMessage);
  },

  getHttpPath(http, stateMachineName) {
    if (typeof http.path === 'string') {
      return http.path.replace(/^\//, '').replace(/\/$/, '');
    }
    const errorMessage = [
      `Missing or invalid "path" property in stateMachine "${stateMachineName}"`,
      ' for http event in serverless.yml.',
      ' If you define an http event, make sure you pass a valid value for it,',
      ' either as string syntax, or object syntax.',
      ' Please check the docs for more options.',
    ].join('');
    throw new this.serverless.classes.Error(errorMessage);
  },

  getHttpMethod(http, stateMachineName) {
    if (typeof http.method === 'string') {
      const method = http.method.toLowerCase();

      const allowedMethods = [
        'get', 'post', 'put', 'patch', 'options', 'head', 'delete', 'any',
      ];
      if (allowedMethods.indexOf(method) === -1) {
        const errorMessage = [
          `Invalid APIG method "${http.method}" in stateMachine "${stateMachineName}".`,
          ` AWS supported methods are: ${allowedMethods.join(', ')}.`,
        ].join('');
        throw new this.serverless.classes.Error(errorMessage);
      }
      return method;
    }
    const errorMessage = [
      `Missing or invalid "method" property in stateMachine "${stateMachineName}"`,
      ' for http event in serverless.yml.',
      ' If you define an http event, make sure you pass a valid value for it,',
      ' either as string syntax, or object syntax.',
      ' Please check the docs for more options.',
    ].join('');
    throw new this.serverless.classes.Error(errorMessage);
  },

  getCors(http) {
    const headers = [
      'Content-Type',
      'X-Amz-Date',
      'Authorization',
      'X-Api-Key',
      'X-Amz-Security-Token',
      'X-Amz-User-Agent',
    ];

    const cors = {
      origins: ['*'],
      origin: '*',
      methods: ['OPTIONS'],
      headers,
      allowCredentials: false,
    };

    cors.methods.push(http.method.toUpperCase());

    return cors;
  },
};
