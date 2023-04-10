const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider');
const sinon = require('sinon');
const BbPromise = require('bluebird');
const CLI = require('serverless/lib/classes/CLI');
const ServerlessStepFunctions = require('./../index');

describe('#deploy', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.cli = new CLI(serverless);
    serverless.service.service = 'new-service';
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    const options = {
      stage: 'dev',
      region: 'us-east-1',
      name: 'myStateMachine',
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
    serverlessStepFunctions.serverless.service.stepFunctions = {
      stateMachines: {
        myStateMachine: {
          define: 'my-define',
        },
      },
    };
  });


  describe('#getLambdaStackResource()', () => {
    let getLambdaStackResourceStub;

    it('should return Resource ARNs Array', async () => {
      getLambdaStackResourceStub = sinon
        .stub(serverlessStepFunctions.provider, 'request')
        .returns(
          BbPromise.resolve({
            Stacks: [
              {
                Outputs: [
                  {
                    OutputKey: 'MyFunctionLambdaFunctionQualifiedArn',
                    OutputValue: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction:1',
                    Description: 'MyFunction ARN',
                  },
                  {
                    OutputKey: 'MyFunction1LambdaFunctionQualifiedArn',
                    OutputValue: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1:2',
                    Description: 'MyFunction1 ARN',
                  },
                ],
              },
            ],
          }),
        );

      const expectedResult = [
        {
          MyFunctionLambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
        },
        {
          MyFunction1LambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
        },
      ];

      await serverlessStepFunctions.getLambdaStackResource().then(() => {
        expect(getLambdaStackResourceStub.calledOnce).to.be.equal(true);
        expect(
          getLambdaStackResourceStub.calledWithExactly(
            'CloudFormation',
            'describeStacks',
            { StackName: 'new-service-dev' },
            serverlessStepFunctions.options.stage,
            serverlessStepFunctions.options.region,
          ),
        ).to.be.equal(true);
        expect(
          serverlessStepFunctions.deployStateMachine.getLambdaStackResource,
        ).to.eql(expectedResult);
        serverlessStepFunctions.provider.request.restore();
      });
    });

    it('should throw error if describeStacks returns empty',
      () => {
        getLambdaStackResourceStub = sinon.stub(serverlessStepFunctions.provider, 'request')
          .returns(BbPromise.resolve(false));

        serverlessStepFunctions.getLambdaStackResource()
          .catch((error) => {
            expect(getLambdaStackResourceStub.calledOnce).to.be.equal(true);
            expect(getLambdaStackResourceStub.calledWithExactly(
              'CloudFormation',
              'describeStacks',
              { StackName: 'new-service-dev' },
              serverlessStepFunctions.options.stage,
              serverlessStepFunctions.options.region,
            )).to.be.equal(true);
            expect(error.message).to.be
              .equal('"myStateMachine" stateMachine does not exists.');
          });
        serverlessStepFunctions.provider.request.restore();
      });
  });

  describe('#replaceAllStatesARNInDefinition()', () => {
    beforeEach(() => {
      serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine: {
            definition: 'myStateMachine',
          },
        },
      };
    });

    it('should handle missing state.Type and state.Resource properties', async () => {
      // Define input values
      const definition = {
        States: {
          State1: {
            Type: 'Task',
          },
          State2: {
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:my-function',
          },
        },
      };

      // Call the function and assert that it returns the original definition unchanged
      const result = await serverlessStepFunctions.replaceAllStatesARNInDefinition(definition,
        serverlessStepFunctions);
      expect(result).to.deep.equal(definition);
    });

    it('should throw an error when lambda does not exist in state machine', async () => {
      // Define input values
      const definition = {
        States: {
          State1: {
            Type: 'Task',
            Resource: {
              'Fn::GetAtt': ['MyFunction', 'Arn'],
            },
          },
        },
      };
      serverlessStepFunctions.deployStateMachine = {};
      serverlessStepFunctions.deployStateMachine.getLambdaStackResource = [
        {
          MyDummyFunction: 'arn:aws:lambda:us-east-1:123456789012:function:MyDummyFunction',
        },
      ];

      // Call the function and assert that it throws an error
      expect(() => serverlessStepFunctions.replaceAllStatesARNInDefinition(definition, serverlessStepFunctions)).to.throw('Lambda does not exist in state machine');
    });

    it('should replace state resource ARNs in the definition', async () => {
      // Define input value
      const definition = {
        States: {
          State1: {
            Type: 'Task',
            Resource: {
              'Fn::GetAtt': ['MyFunction', 'Arn'],
            },
          },
          State2: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
          },
          State3: {
            Type: 'Task',
            Resource: {
              'Fn::GetAtt': ['MyFunction2', 'Arn'],
            },
          },
        },
      };
      serverlessStepFunctions.deployStateMachine = {};
      serverlessStepFunctions.deployStateMachine.getLambdaStackResource = [
        {
          MyFunctionLambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
        },
        {
          MyFunction1LambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
        },
        {
          MyFunction2LambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction2',
        },
      ];

      // Call the function
      const result = serverlessStepFunctions.replaceAllStatesARNInDefinition(definition,
        serverlessStepFunctions);

      // Assert that state resource ARNs are replaced correctly
      expect(result).to.deep.equal({
        States: {
          State1: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
          },
          State2: {
            Type: 'Task',
            // eslint-disable-next-line max-len
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
          },
          State3: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction2',
          },
        },
      });
    });
  });

  describe('#createDefinitionString()', () => {
    it('should create a valid definition string with single state', async () => {
      serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine: {
            definition: {
              States: {
                State1: {
                  Type: 'Task',
                  Resource: {
                    'Fn::GetAtt': ['MyFunction', 'Arn'],
                  },
                },
                State2: {
                  Type: 'Task',
                  Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
                },
                State3: {
                  Type: 'Task',
                  Resource: {
                    'Fn::GetAtt': ['MyFunction2', 'Arn'],
                  },
                },
              },
            },
          },
        },
      };
      serverlessStepFunctions.deployStateMachine = {};
      serverlessStepFunctions.deployStateMachine.getLambdaStackResource = [
        {
          MyFunctionLambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
        },
        {
          MyFunction1LambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
        },
        {
          MyFunction2LambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction2',
        },
      ];
      await serverlessStepFunctions.createDefinitionString();
      const expected = {
        States: {
          State1: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
          },
          State2: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
          },
          State3: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction2',
          },
        },
      };
      expect(serverlessStepFunctions.deployStateMachine.definitionObject).to.eql(expected);
    });
  });

  describe('#callUpdateFunction', () => {
    let getLambdaStackResourceStub;
    it('should create definition object', async () => {
      getLambdaStackResourceStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(
          BbPromise.resolve({ updateDate: new Date().toISOString() }),
        );
      serverless.service.stepFunctions = {
        stateMachines: {
          myStateMachine: {
            definition: {
              StartAt: 'State1',
              States: {
                State1: {
                  Type: 'Task',
                  Resource: {
                    'Fn::GetAtt': ['MyFunction', 'Arn'],
                  },
                },
                State2: {
                  Type: 'Task',
                  Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
                },
                State3: {
                  Type: 'Task',
                  Resource: {
                    'Fn::GetAtt': ['MyFunction2', 'Arn'],
                  },
                },
              },
            },
          },
        },
      };
      serverlessStepFunctions.deployStateMachine = {};
      serverlessStepFunctions.deployStateMachine.getLambdaStackResource = [
        {
          myStateMachineArn: 'arn:aws:lambda:us-east-1:123456789012:stateMachine:myStateMachine',
        },
        {
          MyFunctionLambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
        },
        {
          MyFunction1LambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction1',
        },
        {
          MyFunction2LambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction2',
        },
      ];
      await serverlessStepFunctions.createDefinitionString();
      await serverlessStepFunctions.callUpdateFunction().then((result) => {
        expect(getLambdaStackResourceStub.calledOnce).to.be.equal(true);
        expect(result).to.be.eql('Step-Function deployed');
      });
    });

    it('should throw an error if state machine not found', async () => {
      getLambdaStackResourceStub = sinon.stub(serverlessStepFunctions.provider, 'request')
        .returns(
          BbPromise.resolve(false),
        );
      serverlessStepFunctions.deployStateMachine = {};
      serverlessStepFunctions.deployStateMachine.getLambdaStackResource = [];
      await serverlessStepFunctions.createDefinitionString();
      expect(() => serverlessStepFunctions.callUpdateFunction()).to.throw('Step function does not exist in cloud formation');
    });
  });
});
