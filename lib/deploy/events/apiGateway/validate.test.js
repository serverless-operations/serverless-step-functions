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
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  it('should ignore non-http events', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              ignored: {},
            },
          ],
        },
      },
    };
    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(0);
  });

  it('should reject an invalid http event', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: true,
            },
          ],
        },
      },
    };
    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should throw an error if http event type is not a string or an object', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: 42,
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should validate the http events "path" property', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should validate the http events "method" property', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                path: 'foo/bar',
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should validate the http events object syntax method is case insensitive', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
                path: 'foo/bar',
              },
            },
            {
              http: {
                method: 'post',
                path: 'foo/bar',
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(2);
  });

  it('should validate the http events string syntax method is case insensitive', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: 'POST foo/bar',
            },
            {
              http: 'post foo/bar',
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(2);
  });

  it('should throw an error if the method is invalid', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                path: 'foo/bar',
                method: 'INVALID',
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should filter non-http events', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
              },
            },
            {},
          ],
        },
        second: {
          events: [
            {
              other: {},
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(1);
  });

  it('should discard a starting slash from paths', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
                path: '/foo/bar',
              },
            },
            {
              http: 'GET /foo/bar',
            },
          ],
        },
      },
    };
    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(2);
    expect(validated.events[0].http).to.have.property('path', 'foo/bar');
    expect(validated.events[1].http).to.have.property('path', 'foo/bar');
  });

  it('should throw if an authorizer is an invalid value', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: true,
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should throw if an authorizer is an empty object', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: {},
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should throw if an cognito claims are being with a lambda proxy', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                integration: 'lambda-proxy',
                authorizer: {
                  arn: 'arn:aws:cognito-idp:us-east-1:xxx:userpool/us-east-1_ZZZ',
                  claims: [
                    'email',
                    'nickname',
                  ],
                },
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should throw if an integration is not supported', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                integration: 'fake',
                authorizer: {
                  arn: 'arn:aws:cognito-idp:us-east-1:xxx:userpool/us-east-1_ZZZ',
                },
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should accept AWS_IAM as authorizer', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        foo: {},
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: 'aws_iam',
              },
            },
          ],
        },
        second: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: {
                  type: 'aws_iam',
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(2);
    expect(validated.events[0].http.authorizer.type).to.equal('AWS_IAM');
    expect(validated.events[1].http.authorizer.type).to.equal('AWS_IAM');
  });

  it('should accept an authorizer as a string', () => {
    serverlessStepFunctions.serverless.service.functions = {
      foo: {},
    };

    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: 'foo',
              },
            },
          ],
        },
        second: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: 'sss:dev-authorizer',
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(2);
    expect(validated.events[0].http.authorizer.name).to.equal('foo');
    expect(validated.events[0].http.authorizer.arn).to.deep.equal({
      'Fn::GetAtt': [
        'FooLambdaFunction',
        'Arn',
      ],
    });
    expect(validated.events[1].http.authorizer.name).to.equal('authorizer');
    expect(validated.events[1].http.authorizer.arn).to.equal('sss:dev-authorizer');
  });

  it('should set authorizer defaults', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: {
                  arn: 'sss:dev-authorizer',
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    const authorizer = validated.events[0].http.authorizer;
    expect(authorizer.resultTtlInSeconds).to.equal(300);
    expect(authorizer.identitySource).to.equal('method.request.header.Authorization');
  });

  it('should accept authorizer config', () => {
    serverlessStepFunctions.serverless.service.functions = {
      foo: {},
    };

    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                integration: 'LAMBDA',
                authorizer: {
                  name: 'foo',
                  resultTtlInSeconds: 500,
                  identitySource: 'method.request.header.Custom',
                  identityValidationExpression: 'foo',
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    const authorizer = validated.events[0].http.authorizer;
    expect(authorizer.resultTtlInSeconds).to.equal(500);
    expect(authorizer.identitySource).to.equal('method.request.header.Custom');
    expect(authorizer.identityValidationExpression).to.equal('foo');
  });

  it('should accept authorizer config with scopes', () => {
    serverlessStepFunctions.serverless.service.functions = {
      foo: {},
    };

    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                integration: 'MOCK',
                authorizer: {
                  name: 'authorizer',
                  arn: 'arn:aws:cognito-idp:eu-west-1:xxxxxxxxxx',
                  identitySouce: 'method.request.header.Authorization',
                  scopes: ['scope1', 'scope2'],
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    const authorizer = validated.events[0].http.authorizer;
    expect(authorizer.scopes).to.deep.equal(['scope1', 'scope2']);
  });

  it('should accept authorizer config with a type', () => {
    serverlessStepFunctions.serverless.service.functions = {
      foo: {},
    };

    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                integration: 'MOCK',
                authorizer: {
                  name: 'foo',
                  type: 'request',
                  resultTtlInSeconds: 500,
                  identitySource: 'method.request.header.Custom',
                  identityValidationExpression: 'foo',
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    const authorizer = validated.events[0].http.authorizer;
    expect(authorizer.type).to.equal('request');
  });

  it('should accept authorizer config with a type and authorizerId', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: {
                  name: 'foo',
                  type: 'CUSTOM',
                  authorizerId: '12345',
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events[0].http.authorizer.type).to.equal('CUSTOM');
    expect(validated.events[0].http.authorizer.authorizerId).to.equal('12345');
  });

  it('should accept authorizer config with a lambda arn', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: {
                  name: 'foo',
                  arn: 'xxx:xxx:Lambda-Name',
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events[0].http.authorizer.arn).to.equal('xxx:xxx:Lambda-Name');
  });

  it('should accept authorizer config when resultTtlInSeconds is 0', () => {
    serverlessStepFunctions.serverless.service.functions = {
      foo: {},
    };

    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        foo: {},
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'foo/bar',
                authorizer: {
                  name: 'foo',
                  resultTtlInSeconds: 0,
                  identitySource: 'method.request.header.Custom',
                  identityValidationExpression: 'foo',
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    const authorizer = validated.events[0].http.authorizer;
    expect(authorizer.resultTtlInSeconds).to.equal(0);
    expect(authorizer.identitySource).to.equal('method.request.header.Custom');
    expect(authorizer.identityValidationExpression).to.equal('foo');
  });

  it('should throw an error if "origin" and "origins" CORS config is used', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
                path: '/foo/bar',
                cors: {
                  origin: '*',
                  origins: ['*'],
                },
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate())
      .to.throw(Error, 'can only use');
  });

  it('should process cors defaults', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
                path: '/foo/bar',
                cors: true,
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(1);
    expect(validated.events[0].http.cors).to.deep.equal({
      headers: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key',
        'X-Amz-Security-Token', 'X-Amz-User-Agent'],
      methods: ['OPTIONS', 'POST'],
      origin: '*',
      origins: ['*'],
      allowCredentials: false,
    });
  });

  it('should throw if cors headers are not an array', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
                path: '/foo/bar',
                cors: {
                  headers: true,
                },
              },
            },
          ],
        },
      },
    };

    expect(() => serverlessStepFunctions.httpValidate()).to.throw(Error);
  });

  it('should process cors options', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
                path: '/foo/bar',
                cors: {
                  headers: ['X-Foo-Bar'],
                  origins: ['acme.com'],
                  methods: ['POST', 'OPTIONS'],
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(1);
    expect(validated.events[0].http.cors).to.deep.equal({
      headers: ['X-Foo-Bar'],
      methods: ['POST', 'OPTIONS'],
      origins: ['acme.com'],
      allowCredentials: false,
    });
  });

  it('should merge all preflight origins, method, headers and allowCredentials for a path', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'GET',
                path: 'users',
                cors: {
                  origins: [
                    'http://example.com',
                  ],
                  allowCredentials: true,
                },
              },
            }, {
              http: {
                method: 'POST',
                path: 'users',
                cors: {
                  origins: [
                    'http://example2.com',
                  ],
                },
              },
            }, {
              http: {
                method: 'PUT',
                path: 'users/{id}',
                cors: {
                  headers: [
                    'TestHeader',
                  ],
                },
              },
            }, {
              http: {
                method: 'DELETE',
                path: 'users/{id}',
                cors: {
                  headers: [
                    'TestHeader2',
                  ],
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.corsPreflight['users/{id}'].methods)
      .to.deep.equal(['OPTIONS', 'DELETE', 'PUT']);
    expect(validated.corsPreflight.users.origins)
      .to.deep.equal(['http://example2.com', 'http://example.com']);
    expect(validated.corsPreflight['users/{id}'].headers)
      .to.deep.equal(['TestHeader2', 'TestHeader']);
    expect(validated.corsPreflight.users.allowCredentials)
      .to.equal(true);
    expect(validated.corsPreflight['users/{id}'].allowCredentials)
      .to.equal(false);
  });

  it('serverlessStepFunctions', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
                path: '/foo/bar',
                cors: {
                  methods: ['POST'],
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events).to.be.an('Array').with.length(1);
    expect(validated.events[0].http.cors.methods).to.deep.equal(['POST', 'OPTIONS']);
  });

  it('should set cors Access-Control-Max-Age headers', () => {
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        first: {
          events: [
            {
              http: {
                method: 'POST',
                path: '/foo/bar',
                cors: {
                  origin: '*',
                  maxAge: 86400,
                },
              },
            },
          ],
        },
      },
    };

    const validated = serverlessStepFunctions.httpValidate();
    expect(validated.events[0].http.cors.origin).to.equal('*');
    expect(validated.events[0].http.cors.maxAge).to.equal(86400);
  });
});
