'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('ServerlessStepFunctions', () => {
  let serverless;
  let provider;
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
      state: 'hellofunc',
      data: 'inputData',
    };

    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    provider = serverless.getProvider('aws');
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(serverlessStepFunctions.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(serverlessStepFunctions.provider).to.be.instanceof(AwsProvider));

    it('should have access to the serverless instance', () => {
      expect(serverlessStepFunctions.serverless).to.deep.equal(serverless);
    });

    it('should set the region variable', () =>
      expect(serverlessStepFunctions.region).to.be.equal(provider.getRegion()));

    it('should set the stage variable', () =>
      expect(serverlessStepFunctions.stage).to.be.equal(provider.getStage()));

    it('should set the assumeRolePolicyDocument variable', () =>
      expect(serverlessStepFunctions.assumeRolePolicyDocument).to.be
      .equal(`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": "states.us-east-1.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }
   `));

    it('should run deploy:stepf:deploy promise chain in order', () => {
      const deployStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineDeploy').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['deploy:stepf:deploy']()
        .then(() => {
          expect(deployStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineDeploy.restore();
        });
    });

    it('should run remove:stepf:remove promise chain in order', () => {
      const removeStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineRemove').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['remove:stepf:remove']()
        .then(() => {
          expect(removeStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineRemove.restore();
        });
    });

    it('should run invoke:stepf:invoke promise chain in order', () => {
      const invokeStub = sinon
        .stub(serverlessStepFunctions, 'stateMachineInvoke').returns(BbPromise.resolve());
      return serverlessStepFunctions.hooks['invoke:stepf:invoke']()
        .then(() => {
          expect(invokeStub.calledOnce).to.be.equal(true);
          serverlessStepFunctions.stateMachineInvoke.restore();
        });
    });

    it('should set an empty options object if no options are given', () => {
      const serverlessStepFunctionsWithEmptyOptions = new ServerlessStepFunctions(serverless);
      expect(serverlessStepFunctionsWithEmptyOptions.options).to.deep.equal({});
    });
  });

  describe('#stateMachineDeploy()', () => {
    it('should run promise chain in order', () => {
      const yamlParseStub = sinon
        .stub(serverlessStepFunctions, 'yamlParse').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const getFunctionArnsStub = sinon
        .stub(serverlessStepFunctions, 'getFunctionArns').returns(BbPromise.resolve());
      const compileStub = sinon
        .stub(serverlessStepFunctions, 'compile').returns(BbPromise.resolve());
      const getIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'getIamRole').returns(BbPromise.resolve());
      const deleteStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachine').returns(BbPromise.resolve());
      const createStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'createStateMachine').returns(BbPromise.resolve());

      return serverlessStepFunctions.stateMachineDeploy()
        .then(() => {
          expect(yamlParseStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(yamlParseStub)).to.be.equal(true);
          expect(getFunctionArnsStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(compileStub.calledAfter(getFunctionArnsStub)).to.be.equal(true);
          expect(getIamRoleStub.calledAfter(compileStub)).to.be.equal(true);
          expect(deleteStateMachineStub.calledAfter(getIamRoleStub)).to.be.equal(true);
          expect(createStateMachineStub.calledAfter(deleteStateMachineStub)).to.be.equal(true);

          serverlessStepFunctions.yamlParse.restore();
          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.getFunctionArns.restore();
          serverlessStepFunctions.compile.restore();
          serverlessStepFunctions.getIamRole.restore();
          serverlessStepFunctions.deleteStateMachine.restore();
          serverlessStepFunctions.createStateMachine.restore();
        });
    });
  });

  describe('#stateMachineRemove()', () => {
    it('should run promise chain in order', () => {
      const deleteIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'deleteIamRole').returns(BbPromise.resolve());
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const deleteStateMachineStub = sinon
        .stub(serverlessStepFunctions, 'deleteStateMachine').returns(BbPromise.resolve());

      return serverlessStepFunctions.stateMachineRemove()
        .then(() => {
          expect(deleteIamRoleStub.calledOnce).to.be.equal(true);
          expect(getStateMachineArnStub.calledAfter(deleteIamRoleStub)).to.be.equal(true);
          expect(deleteStateMachineStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);

          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.deleteStateMachine.restore();
        });
    });
  });

  describe('#stateMachineInvoke()', () => {
    it('should run promise chain in order', () => {
      const getStateMachineArnStub = sinon
        .stub(serverlessStepFunctions, 'getStateMachineArn').returns(BbPromise.resolve());
      const startExecutionStub = sinon
        .stub(serverlessStepFunctions, 'startExecution').returns(BbPromise.resolve());
      const describeExecutionStub = sinon
        .stub(serverlessStepFunctions, 'describeExecution').returns(BbPromise.resolve());

      return serverlessStepFunctions.stateMachineInvoke()
        .then(() => {
          expect(getStateMachineArnStub.calledOnce).to.be.equal(true);
          expect(startExecutionStub.calledAfter(getStateMachineArnStub)).to.be.equal(true);
          expect(describeExecutionStub.calledAfter(startExecutionStub)).to.be.equal(true);

          serverlessStepFunctions.getStateMachineArn.restore();
          serverlessStepFunctions.startExecution.restore();
          serverlessStepFunctions.describeExecution.restore();
        });
    });
  });

  describe('#getIamRoleName', () => {
    it('should return IamRoleName', () => {
      expect(serverlessStepFunctions.getIamRoleName('state'))
      .to.be.equal('step-functions-us-east-1-dev-state-ssf-exerole');
    });
  });

  describe('#getIamPolicyName', () => {
    it('should return IamPolicyName', () => {
      expect(serverlessStepFunctions.getIamPolicyName('state'))
      .to.be.equal('step-functions-us-east-1-dev-state-ssf-exepolicy');
    });
  });

  describe('#getIamRole()', () => {
    let getRoleStub;
    beforeEach(() => {
      getRoleStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Role: { Arn: 'roleArn' } }));
    });

    it('should getIamRole with correct params', () => serverlessStepFunctions.getIamRole('state')
      .then(() => {
        expect(getRoleStub.calledOnce).to.be.equal(true);
        expect(getRoleStub.calledWithExactly(
          'IAM',
          'getRole',
          {
            RoleName: 'step-functions-us-east-1-dev-state-ssf-exerole',
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.iamRoleArn.state).to.be.equal('roleArn');
        serverlessStepFunctions.provider.request.restore();
      })
    );

    it('should createRole when statusCode is 404', () => {
      serverlessStepFunctions.provider.request.restore();
      const getRoleErrorStub = sinon.stub(serverlessStepFunctions.provider, 'request')
       .returns(BbPromise.reject({ statusCode: 404 }));
      const createIamRoleStub = sinon
        .stub(serverlessStepFunctions, 'createIamRole').returns(BbPromise.resolve());

      serverlessStepFunctions.getIamRole().catch(() => {
        expect(createIamRoleStub.calledOnce).to.be.equal(true);
        expect(getRoleErrorStub.calledOnce).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
        serverlessStepFunctions.createIamRole.restore();
      });
    });

    it('should throw error when statusCode is not 404', () => {
      serverlessStepFunctions.provider.request.restore();
      const getRoleErrorStub = sinon.stub(serverlessStepFunctions.provider, 'request')
       .returns(BbPromise.reject({ statusCode: 502 }));

      serverlessStepFunctions.getIamRole().catch((error) => {
        expect(getRoleErrorStub.calledOnce).to.be.equal(true);
        expect(error.name).to.be.equal('ServerlessError');
        serverlessStepFunctions.provider.request.restore();
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

  describe('#createIamRole()', () => {
    let createIamRoleStub;
    beforeEach(() => {
      createIamRoleStub = sinon.stub(serverlessStepFunctions.provider, 'request');
      createIamRoleStub.onFirstCall().returns(BbPromise.resolve({ Role: { Arn: 'roleArn' } }));
      createIamRoleStub.onSecondCall().returns(BbPromise.resolve({ Policy: { Arn: 'policyArn' } }));
      createIamRoleStub.onThirdCall().returns(BbPromise.resolve());
    });

    it('should createIamRole with correct params', () => serverlessStepFunctions.createIamRole()
      .then(() => {
        expect(createIamRoleStub.calledThrice).to.be.equal(true);
        expect(createIamRoleStub.args[0][0]).to.be.equal('IAM');
        expect(createIamRoleStub.args[0][1]).to.be.equal('createRole');
        expect(createIamRoleStub.args[1][0]).to.be.equal('IAM');
        expect(createIamRoleStub.args[1][1]).to.be.equal('createPolicy');
        expect(createIamRoleStub.args[2][0]).to.be.equal('IAM');
        expect(createIamRoleStub.args[2][1]).to.be.equal('attachRolePolicy');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#deleteIamRole()', () => {
    let deleteIamRoleStub;
    beforeEach(() => {
      deleteIamRoleStub = sinon.stub(serverlessStepFunctions.provider, 'request');
      deleteIamRoleStub.onFirstCall().returns(BbPromise.resolve({ Account: 1234 }));
      deleteIamRoleStub.onSecondCall().returns(BbPromise.resolve());
      deleteIamRoleStub.onThirdCall().returns(BbPromise.resolve());
      deleteIamRoleStub.onCall(4).returns(BbPromise.resolve());
    });

    it('should deleteIamRole with correct params', () => serverlessStepFunctions.deleteIamRole()
      .then(() => {
        expect(deleteIamRoleStub.callCount).to.be.equal(4);
        expect(deleteIamRoleStub.args[0][0]).to.be.equal('STS');
        expect(deleteIamRoleStub.args[0][1]).to.be.equal('getCallerIdentity');
        expect(deleteIamRoleStub.args[1][0]).to.be.equal('IAM');
        expect(deleteIamRoleStub.args[1][1]).to.be.equal('detachRolePolicy');
        expect(deleteIamRoleStub.args[2][0]).to.be.equal('IAM');
        expect(deleteIamRoleStub.args[2][1]).to.be.equal('deletePolicy');
        expect(deleteIamRoleStub.args[3][0]).to.be.equal('IAM');
        expect(deleteIamRoleStub.args[3][1]).to.be.equal('deleteRole');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#getStateMachineArn()', () => {
    let getStateMachineStub;
    beforeEach(() => {
      getStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Account: 1234 }));
    });

    it('should getStateMachineStub with correct params'
    , () => serverlessStepFunctions.getStateMachineArn('state')
      .then(() => {
        expect(getStateMachineStub.calledOnce).to.be.equal(true);
        expect(getStateMachineStub.calledWithExactly(
          'STS',
          'getCallerIdentity',
          {},
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.stateMachineArns.state).to.be
        .equal('arn:aws:states:us-east-1:1234:stateMachine:step-functions-dev-state');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#deleteStateMachine()', () => {
    let deleteStateMachineStub;
    beforeEach(() => {
      deleteStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Account: 1234 }));
    });

    it('should deleteStateMachine with correct params'
    , () => serverlessStepFunctions.deleteStateMachine()
      .then(() => {
        expect(deleteStateMachineStub.calledOnce).to.be.equal(true);
        expect(deleteStateMachineStub.calledWithExactly(
          'StepFunctions',
          'deleteStateMachine',
          {
            stateMachineArn: serverlessStepFunctions.stateMachineArn,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#createStateMachine()', () => {
    let createStateMachineStub;
    beforeEach(() => {
      createStateMachineStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve());
      serverlessStepFunctions.serverless.service.stepFunctions = { state: 'state' };
    });

    it('should createStateMachine with correct params'
    , () => serverlessStepFunctions.createStateMachine('state')
      .then(() => {
        const stage = serverlessStepFunctions.options.stage;
        expect(createStateMachineStub.calledOnce).to.be.equal(true);
        expect(createStateMachineStub.calledWithExactly(
          'StepFunctions',
          'createStateMachine',
          {
            definition: serverlessStepFunctions
            .serverless.service.stepFunctions.state,
            name: `${serverless.service.service}-${stage}-state`,
            roleArn: serverlessStepFunctions.iamRoleArn.state,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );
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

    it('should return resolve if path param is not provided', () => {
      serverlessStepFunctions.options.path = null;
      return serverlessStepFunctions.parseInputdate().then(() => {
        expect(serverlessStepFunctions.options.data).to.deep.equal(null);
        serverlessStepFunctions.serverless.utils.fileExistsSync.restore();
        serverlessStepFunctions.serverless.utils.readFileSync.restore();
      });
    });
  });

  describe('#startExecution()', () => {
    let startExecutionStub;
    beforeEach(() => {
      startExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ executionArn: 'executionArn' }));
    });

    it('should startExecution with correct params', () => serverlessStepFunctions.startExecution()
      .then(() => {
        expect(startExecutionStub.calledOnce).to.be.equal(true);
        expect(startExecutionStub.calledWithExactly(
          'StepFunctions',
          'startExecution',
          {
            stateMachineArn: serverlessStepFunctions.stateMachineArn,
            input: serverlessStepFunctions.options.data,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.executionArn).to.be.equal('executionArn');
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#describeExecution()', () => {
    let describeExecutionStub;
    it('should describeExecution with correct params', () => {
      describeExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ status: 'SUCCESS' }));

      serverlessStepFunctions.describeExecution()
      .then(() => {
        expect(describeExecutionStub.calledOnce).to.be.equal(true);
        expect(describeExecutionStub.calledWithExactly(
          'StepFunctions',
          'describeExecution',
          {
            executionArn: serverlessStepFunctions.executionArn,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      });
    });

    it('should describeExecution with status FAILED', () => {
      describeExecutionStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(BbPromise.resolve({ status: 'FAILED' }));
      const getExecutionHistoryStub = sinon
        .stub(serverlessStepFunctions, 'getExecutionHistory')
        .returns(BbPromise.resolve({ events: [{ executionFailedEventDetails: 'error' }] }));

      serverlessStepFunctions.describeExecution()
      .then(() => {
        expect(describeExecutionStub.calledOnce).to.be.equal(true);
        expect(describeExecutionStub.calledWithExactly(
          'StepFunctions',
          'describeExecution',
          {
            executionArn: serverlessStepFunctions.executionArn,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(getExecutionHistoryStub.calledOnce).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
        serverlessStepFunctions.getExecutionHistory.restore();
      });
    });
  });

  describe('#getExecutionHistory()', () => {
    let getExecutionHistoryStub;
    beforeEach(() => {
      getExecutionHistoryStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ events: [{ executionFailedEventDetails: 'error' }] }));
    });

    it('should getExecutionHistory with correct params'
    , () => serverlessStepFunctions.getExecutionHistory()
      .then(() => {
        expect(getExecutionHistoryStub.calledOnce).to.be.equal(true);
        expect(getExecutionHistoryStub.calledWithExactly(
          'StepFunctions',
          'getExecutionHistory',
          {
            executionArn: serverlessStepFunctions.executionArn,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#yamlParse()', () => {
    let yamlParserStub;
    beforeEach(() => {
      yamlParserStub = sinon.stub(serverlessStepFunctions.serverless.yamlParser, 'parse')
      .returns(BbPromise.resolve({ stepFunctions: { stateMachine: 'stepFunctions' } }));
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
      .returns(BbPromise.resolve({ stepFunctions: { stateMachine: '${self:defaults.region}' } }));
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
});

