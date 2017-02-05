'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./index');

describe('activity', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.service = 'step-functions';
    serverless.service.stepFunctions = {};
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
      name: 'helloActivity',
    };

    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('getActivityName', () => {
    it('should return activity name',
      () => expect(serverlessStepFunctions.getActivityName('name'))
      .to.be.equal('step-functions-dev-name'));
  });

  describe('#createActivity()', () => {
    let createActivityStub;
    beforeEach(() => {
      createActivityStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve());
    });

    it('should createActivity when correct params is not given'
    , () => serverlessStepFunctions.createActivity()
      .then(() => {
        const stage = serverlessStepFunctions.options.stage;
        expect(createActivityStub.calledOnce).to.be.equal(true);
        expect(createActivityStub.calledWithExactly(
          'StepFunctions',
          'createActivity',
          {
            name: `${serverless.service.service}-${stage}-helloActivity`,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );

    it('should createActivity with correct params'
    , () => serverlessStepFunctions.createActivity('name')
      .then(() => {
        const stage = serverlessStepFunctions.options.stage;
        expect(createActivityStub.calledOnce).to.be.equal(true);
        expect(createActivityStub.calledWithExactly(
          'StepFunctions',
          'createActivity',
          {
            name: `${serverless.service.service}-${stage}-name`,
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#createActivities()', () => {
    let createActivityStub;
    beforeEach(() => {
      serverlessStepFunctions.deployedActivities = {
        helloHello: 'notDeployed',
        hogeHoge: 'notDeployed',
        sssss: 'deployed',
      };
      createActivityStub = sinon
      .stub(serverlessStepFunctions, 'createActivity').returns(BbPromise.resolve());
    });

    it('should createActivities with correct params'
    , () => serverlessStepFunctions.createActivities()
      .then(() => {
        expect(createActivityStub.calledTwice).to.be.equal(true);
        serverlessStepFunctions.createActivity.restore();
      })
    );
  });

  describe('#deleteActivity()', () => {
    let deleteActivityStub;
    beforeEach(() => {
      deleteActivityStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve());
      serverlessStepFunctions.activityArns.helloActivity = 'arn';
      serverlessStepFunctions.activityArns.name = 'arnarn';
    });

    it('should deleteActivity when correct params is not given'
    , () => serverlessStepFunctions.deleteActivity()
      .then(() => {
        expect(deleteActivityStub.calledOnce).to.be.equal(true);
        expect(deleteActivityStub.calledWithExactly(
          'StepFunctions',
          'deleteActivity',
          {
            activityArn: 'arn',
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );

    it('should deleteActivity with correct params'
    , () => serverlessStepFunctions.deleteActivity('name')
      .then(() => {
        expect(deleteActivityStub.calledOnce).to.be.equal(true);
        expect(deleteActivityStub.calledWithExactly(
          'StepFunctions',
          'deleteActivity',
          {
            activityArn: 'arnarn',
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        serverlessStepFunctions.provider.request.restore();
      })
    );
  });

  describe('#describeActivity()', () => {
    let describeActivityResolveStub;
    let describeActivityRejectStub;
    beforeEach(() => {
      describeActivityResolveStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve());
      serverlessStepFunctions.activityArns.helloActivity = 'arn';
      serverlessStepFunctions.activityArns.name = 'arnarn';
    });

    it('should describeActivity when correct params is not given and stub is resolve'
    , () => serverlessStepFunctions.describeActivity()
      .then(() => {
        expect(describeActivityResolveStub.calledOnce).to.be.equal(true);
        expect(describeActivityResolveStub.calledWithExactly(
          'StepFunctions',
          'describeActivity',
          {
            activityArn: 'arn',
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.deployedActivities.helloActivity)
        .to.be.equal('deployed');
        serverlessStepFunctions.provider.request.restore();
      })
    );

    it('should describeActivity with correct params and stub is resolve'
    , () => serverlessStepFunctions.describeActivity('name')
      .then(() => {
        expect(describeActivityResolveStub.calledOnce).to.be.equal(true);
        expect(describeActivityResolveStub.calledWithExactly(
          'StepFunctions',
          'describeActivity',
          {
            activityArn: 'arnarn',
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.deployedActivities.name)
        .to.be.equal('deployed');
        serverlessStepFunctions.provider.request.restore();
      })
    );

    it('should describeActivity when correct params is not given and stub is reject'
    , () => {
      serverlessStepFunctions.provider.request.restore();
      describeActivityRejectStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.reject());
      serverlessStepFunctions.describeActivity()
      .catch(() => {
        expect(describeActivityRejectStub.calledOnce).to.be.equal(true);
        expect(describeActivityRejectStub.calledWithExactly(
          'StepFunctions',
          'describeActivity',
          {
            activityArn: 'arn',
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.deployedActivities.helloActivity)
        .to.be.equal('notDployed');
        serverlessStepFunctions.provider.request.restore();
      });
    });

    it('should describeActivity with correct params and stub is reject'
    , () => {
      serverlessStepFunctions.provider.request.restore();
      describeActivityRejectStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.reject());
      serverlessStepFunctions.describeActivity('name')
      .catch(() => {
        expect(describeActivityResolveStub.calledOnce).to.be.equal(true);
        expect(describeActivityResolveStub.calledWithExactly(
          'StepFunctions',
          'describeActivity',
          {
            activityArn: 'arnarn',
          },
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.deployedActivities.name)
        .to.be.equal('notDployed');
        serverlessStepFunctions.provider.request.restore();
      });
    });
  });
});
