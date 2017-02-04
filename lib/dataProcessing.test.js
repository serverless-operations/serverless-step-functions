'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('dataProsessing', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.functions = {
      first: {
        handler: true,
        name: 'first',
      },
    };

    const options = {
      stage: 'dev',
      region: 'us-east-1',
      function: 'first',
      functionObj: {
        name: 'first',
      },
      name: 'hellofunc',
      data: 'inputData',
    };

    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#yamlParse()', () => {
    let yamlParserStub;
    beforeEach(() => {
      yamlParserStub = sinon.stub(serverlessStepFunctions.serverless.yamlParser, 'parse')
      .returns(BbPromise.resolve({ stepFunctions: { stateMachines: 'stepFunctions' } }));
      serverlessStepFunctions.serverless.config.servicePath = 'servicePath';
    });

    it('should yamlParse with correct params'
    , () => serverlessStepFunctions.yamlParse()
      .then(() => {
        expect(yamlParserStub.calledOnce).to.be.equal(true);
        expect(serverless.service.stepFunctions).to.be.equal('stepFunctions');
        serverlessStepFunctions.serverless.yamlParser.parse.restore();
      })
    );

    it('should return resolve when servicePath does not exists', () => {
      serverlessStepFunctions.serverless.config.servicePath = null;
      serverlessStepFunctions.yamlParse()
      .then(() => {
        expect(yamlParserStub.callCount).to.be.equal(0);
        serverlessStepFunctions.serverless.yamlParser.parse.restore();
      });
    });

    it('should return resolve when variables exists in the yaml', () => {
      serverlessStepFunctions.serverless.yamlParser.parse.restore();
      yamlParserStub = sinon.stub(serverlessStepFunctions.serverless.yamlParser, 'parse')
      .returns(BbPromise.resolve({ stepFunctions: { stateMachines: '${self:defaults.region}' } }));
      serverlessStepFunctions.yamlParse()
      .then(() => {
        expect(yamlParserStub.calledOnce).to.be.equal(true);
        expect(serverless.service.stepFunctions).to.be.equal('us-east-1');
      });
    });
  });

  describe('#compile()', () => {
    it('should throw error when stepFunction state does not exists', () => {
      expect(() => serverlessStepFunctions.compile()).to.throw(Error);
    });

    it('should throw error when stateMachine name does not exists', () => {
      serverlessStepFunctions.stepFunctions = {};
      expect(() => serverlessStepFunctions.compile()).to.throw(Error);
    });

    it('should comple with correct params', () => {
      serverless.service.stepFunctions = {
        hellofunc: {
          States: {
            HelloWorld: {
              Resource: 'first',
            },
          },
        },
      };
      serverlessStepFunctions.functionArns.first = 'lambdaArn';
      serverlessStepFunctions.compile().then(() => {
        expect(serverlessStepFunctions.serverless.service.stepFunctions.hellofunc)
        .to.be.equal('{"States":{"HelloWorld":{"Resource":"lambdaArn"}}}');
      });
    });

    it('should comple with correct params when nested Resource', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        hellofunc: {
          States: {
            HelloWorld: {
              Resource: 'first',
              HelloWorld: {
                Resource: 'first',
                HelloWorld: {
                  Resource: 'first',
                },
              },
            },
          },
        },
      };

      let a = '{"States":{"HelloWorld":{"Resource":"lambdaArn","HelloWorld"';
      a += ':{"Resource":"lambdaArn","HelloWorld":{"Resource":"lambdaArn"}}}}}';
      serverlessStepFunctions.functionArns.first = 'lambdaArn';
      serverlessStepFunctions.compile().then(() => {
        expect(serverlessStepFunctions.serverless.service.stepFunctions.hellofunc).to.be.equal(a);
      });
    });
  });

  describe('#parseInputdate()', () => {
    beforeEach(() => {
      serverlessStepFunctions.serverless.config.servicePath = 'servicePath';
      sinon.stub(serverlessStepFunctions.serverless.utils, 'fileExistsSync').returns(true);
      sinon.stub(serverlessStepFunctions.serverless.utils, 'readFileSync')
      .returns({ foo: 'var' });
      serverlessStepFunctions.options.data = null;
      serverlessStepFunctions.options.path = 'data.json';
    });

    it('should throw error if file does not exists', () => {
      serverlessStepFunctions.serverless.utils.fileExistsSync.restore();
      sinon.stub(serverlessStepFunctions.serverless.utils, 'fileExistsSync').returns(false);
      expect(() => serverlessStepFunctions.parseInputdate()).to.throw(Error);
      serverlessStepFunctions.serverless.utils.readFileSync.restore();
    });

    it('should parse file if path param is provided'
      , () => serverlessStepFunctions.parseInputdate().then(() => {
        expect(serverlessStepFunctions.options.data).to.deep.equal('{"foo":"var"}');
        serverlessStepFunctions.serverless.utils.fileExistsSync.restore();
        serverlessStepFunctions.serverless.utils.readFileSync.restore();
      })
    );

    it('should parse file if path param is provided when absolute path', () => {
      serverlessStepFunctions.options.path = '/data.json';
      serverlessStepFunctions.parseInputdate().then(() => {
        expect(serverlessStepFunctions.options.data).to.deep.equal('{"foo":"var"}');
        serverlessStepFunctions.serverless.utils.fileExistsSync.restore();
        serverlessStepFunctions.serverless.utils.readFileSync.restore();
      });
    });

    it('should return resolve if path param is not provided', () => {
      serverlessStepFunctions.options.path = null;
      return serverlessStepFunctions.parseInputdate().then(() => {
        expect(serverlessStepFunctions.options.data).to.deep.equal(null);
        serverlessStepFunctions.serverless.utils.fileExistsSync.restore();
        serverlessStepFunctions.serverless.utils.readFileSync.restore();
      });
    });
  });

  describe('#getFunctionArns()', () => {
    let getCallerIdentityStub;
    beforeEach(() => {
      getCallerIdentityStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Account: 1234 }));
    });

    it('should getFunctionArns with correct params', () => serverlessStepFunctions.getFunctionArns()
      .then(() => {
        expect(getCallerIdentityStub.calledOnce).to.be.equal(true);
        expect(getCallerIdentityStub.calledWithExactly(
          'STS',
          'getCallerIdentity',
          {},
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.functionArns.first).to.be
        .equal('arn:aws:lambda:us-east-1:1234:function:first');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#compileAll()', () => {
    it('should throw error when stepFunction state does not exists', () => {
      expect(() => serverlessStepFunctions.compileAll()).to.throw(Error);
    });

    it('should comple with correct params when nested Resource', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        hellofunc: {
          States: {
            HelloWorld: {
              Resource: 'first',
              HelloWorld: {
                Resource: 'first',
                HelloWorld: {
                  Resource: 'first',
                },
              },
            },
          },
        },
      };

      let a = '{"States":{"HelloWorld":{"Resource":"lambdaArn","HelloWorld"';
      a += ':{"Resource":"lambdaArn","HelloWorld":{"Resource":"lambdaArn"}}}}}';
      serverlessStepFunctions.functionArns.first = 'lambdaArn';
      serverlessStepFunctions.compileAll().then(() => {
        expect(serverlessStepFunctions.serverless.service.stepFunctions.hellofunc).to.be.equal(a);
      });
    });
  });
});
