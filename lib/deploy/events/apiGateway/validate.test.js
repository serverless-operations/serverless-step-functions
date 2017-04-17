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
});
