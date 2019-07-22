'use strict';

const NOT_FOUND = -1;
const _ = require('lodash');
const awsArnRegExs = require('../../../utils/arnRegularExpressions');

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

          if (http.authorizer) {
            http.authorizer = this.getAuthorizer(http, stateMachineName);
          }

          if (http.cors) {
            http.cors = this.getCors(http);

            const cors = corsPreflight[http.path] || {};

            cors.headers = _.union(http.cors.headers, cors.headers);
            cors.methods = _.union(http.cors.methods, cors.methods);
            cors.origins = _.union(http.cors.origins, cors.origins);
            cors.origin = http.cors.origin || '*';
            cors.allowCredentials = cors.allowCredentials || http.cors.allowCredentials;

            // when merging, last one defined wins
            if (_.has(http.cors, 'maxAge')) {
              cors.maxAge = http.cors.maxAge;
            }

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
    } if (typeof event.http === 'string') {
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

  getIntegration(http, stateMachineName) {
    if (http.integration) {
      // normalize the integration for further processing
      const normalizedIntegration = http.integration.toUpperCase().replace('-', '_');
      const allowedIntegrations = [
        'LAMBDA_PROXY', 'LAMBDA', 'AWS', 'AWS_PROXY', 'HTTP', 'HTTP_PROXY', 'MOCK',
      ];

      // check if the user has entered a non-valid integration
      if (allowedIntegrations.indexOf(normalizedIntegration) === NOT_FOUND) {
        const errorMessage = [
          `Invalid APIG integration "${http.integration}"`,
          ` in function "${stateMachineName}".`,
          ' Supported integrations are:',
          ' lambda, lambda-proxy, aws, aws-proxy, http, http-proxy, mock.',
        ].join('');
        throw new this.serverless.classes.Error(errorMessage);
      }
      if (normalizedIntegration === 'LAMBDA') {
        return 'AWS';
      } if (normalizedIntegration === 'LAMBDA_PROXY') {
        return 'AWS_PROXY';
      }
      return normalizedIntegration;
    }
    return 'AWS_PROXY';
  },

  getAuthorizer(http, functionName) {
    const authorizer = http.authorizer;

    let type;
    let name;
    let arn;
    let identitySource;
    let resultTtlInSeconds;
    let identityValidationExpression;
    let claims;
    let authorizerId;
    let scopes;

    if (typeof authorizer === 'string') {
      if (authorizer.toUpperCase() === 'AWS_IAM') {
        type = 'AWS_IAM';
      } else if (authorizer.indexOf(':') === -1) {
        name = authorizer;
        arn = this.getLambdaArn(authorizer);
      } else {
        arn = authorizer;
        name = this.provider.naming.extractAuthorizerNameFromArn(arn);
      }
    } else if (typeof authorizer === 'object') {
      if (authorizer.type && authorizer.authorizerId) {
        type = authorizer.type;
        authorizerId = authorizer.authorizerId;
      } else if (authorizer.type && authorizer.type.toUpperCase() === 'AWS_IAM') {
        type = 'AWS_IAM';
      } else if (authorizer.arn) {
        arn = authorizer.arn;
        if (_.isString(authorizer.name)) {
          name = authorizer.name;
        } else {
          name = this.provider.naming.extractAuthorizerNameFromArn(arn);
        }
      } else if (authorizer.name) {
        name = authorizer.name;
        arn = this.getLambdaArn(name);
      } else {
        throw new this.serverless.classes.Error('Please provide either an authorizer name or ARN');
      }

      if (!type) {
        type = authorizer.type;
      }

      if (Array.isArray(authorizer.scopes)) {
        scopes = authorizer.scopes;
      }

      resultTtlInSeconds = Number.parseInt(authorizer.resultTtlInSeconds, 10);
      resultTtlInSeconds = Number.isNaN(resultTtlInSeconds) ? 300 : resultTtlInSeconds;
      claims = authorizer.claims || [];

      identitySource = authorizer.identitySource;
      identityValidationExpression = authorizer.identityValidationExpression;
    } else {
      const errorMessage = [
        `authorizer property in function ${functionName} is not an object nor a string.`,
        ' The correct format is: authorizer: functionName',
        ' OR an object containing a name property.',
        ' Please check the docs for more info.',
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }

    if (typeof identitySource === 'undefined') {
      identitySource = 'method.request.header.Authorization';
    }

    const integration = this.getIntegration(http);
    if (integration === 'AWS_PROXY'
      && typeof arn === 'string'
      && awsArnRegExs.cognitoIdpArnExpr.test(arn)
      && authorizer.claims) {
      const errorMessage = [
        'Cognito claims can only be filtered when using the lambda integration type',
      ];
      throw new this.serverless.classes.Error(errorMessage);
    }

    return {
      type,
      name,
      arn,
      authorizerId,
      resultTtlInSeconds,
      identitySource,
      identityValidationExpression,
      claims,
      scopes,
    };
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

    let cors = {
      origins: ['*'],
      origin: '*',
      methods: ['OPTIONS'],
      headers,
      allowCredentials: false,
    };

    if (typeof http.cors === 'object') {
      cors = http.cors;
      cors.methods = cors.methods || [];
      cors.allowCredentials = Boolean(cors.allowCredentials);

      if (cors.origins && cors.origin) {
        const errorMessage = [
          'You can only use "origin" or "origins",',
          ' but not both at the same time to configure CORS.',
          ' Please check the docs for more info.',
        ].join('');
        throw new this.serverless.classes.Error(errorMessage);
      }

      if (cors.headers) {
        if (!Array.isArray(cors.headers)) {
          const errorMessage = [
            'CORS header values must be provided as an array.',
            ' Please check the docs for more info.',
          ].join('');
          throw new this.serverless.classes.Error(errorMessage);
        }
      } else {
        cors.headers = headers;
      }

      if (cors.methods.indexOf('OPTIONS') === NOT_FOUND) {
        cors.methods.push('OPTIONS');
      }

      if (cors.methods.indexOf(http.method.toUpperCase()) === NOT_FOUND) {
        cors.methods.push(http.method.toUpperCase());
      }
    } else {
      cors.methods.push(http.method.toUpperCase());
    }

    return cors;
  },

  getLambdaArn(name) {
    this.serverless.service.getFunction(name);
    const lambdaLogicalId = this.provider.naming.getLambdaLogicalId(name);
    return { 'Fn::GetAtt': [lambdaLogicalId, 'Arn'] };
  },
};
