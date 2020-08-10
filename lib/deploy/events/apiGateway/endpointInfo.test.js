'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const BbPromise = require('bluebird');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');


describe('#getEndpointInfo()', () => {
  let serverless;
  let serverlessStepFunctions;
  let describeStacksStub;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.service.service = 'new-service';
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
  });

  it('should return endpointInfo', () => {
    const describeStacksResponse = {
      Stacks: [
        {
          StackId: 'arn:aws:cloudformation:us-east-1:123456789012:'
            + 'stack/myteststack/466df9e0-0dff-08e3-8e2f-5088487c4896',
          Description: 'AWS CloudFormation Sample Template S3_Bucket: '
            + 'Sample template showing how to create a publicly accessible S3 bucket.',
          Tags: [],
          Outputs: [
            {
              Description: 'URL of the service endpoint',
              OutputKey: 'ServiceEndpoint',
              OutputValue: 'ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev',
            },
            {
              Description: 'first',
              OutputKey: 'ApiGatewayApiKey1Value',
              OutputValue: 'xxx',
            },
            {
              Description: 'second',
              OutputKey: 'ApiGatewayApiKey2Value',
              OutputValue: 'yyy',
            },
          ],
          StackStatusReason: null,
          CreationTime: '2013-08-23T01:02:15.422Z',
          Capabilities: [],
          StackName: 'myteststack',
          StackStatus: 'CREATE_COMPLETE',
          DisableRollback: false,
        },
      ],
    };

    describeStacksStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve(describeStacksResponse));

    return serverlessStepFunctions.getEndpointInfo().then(() => {
      expect(describeStacksStub.calledOnce).to.equal(true);
      expect(describeStacksStub.calledWithExactly(
        'CloudFormation',
        'describeStacks',
        {
          StackName: serverlessStepFunctions.provider.naming.getStackName(),
        },
        serverlessStepFunctions.options.stage,
        serverlessStepFunctions.options.region,
      )).to.equal(true);

      expect(serverlessStepFunctions.endpointInfo)
        .to.equal('ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev');
      serverlessStepFunctions.provider.request.restore();
    });
  });

  it('should resolve if result is empty', () => {
    const describeStacksResponse = null;

    describeStacksStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve(describeStacksResponse));

    return serverlessStepFunctions.getEndpointInfo().then(() => {
      expect(describeStacksStub.calledOnce).to.equal(true);
      expect(describeStacksStub.calledWithExactly(
        'CloudFormation',
        'describeStacks',
        {
          StackName: serverlessStepFunctions.provider.naming.getStackName(),
        },
        serverlessStepFunctions.options.stage,
        serverlessStepFunctions.options.region,
      )).to.equal(true);

      expect(serverlessStepFunctions.endpointInfo).to.equal(undefined);
      serverlessStepFunctions.provider.request.restore();
    });
  });
});
