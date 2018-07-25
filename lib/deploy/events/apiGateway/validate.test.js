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
