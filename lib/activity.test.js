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

  describe('#deleteActivities()', () => {
    let deleteActivityStub;
    beforeEach(() => {
      serverlessStepFunctions.deployedActivities = {
        helloHello: 'deployed',
        hogeHoge: 'deployed',
        sssss: 'notDeployed',
      };
      deleteActivityStub = sinon
      .stub(serverlessStepFunctions, 'deleteActivity').returns(BbPromise.resolve());
    });

    it('should deleteActivities with correct params'
    , () => serverlessStepFunctions.deleteActivities()
      .then(() => {
        expect(deleteActivityStub.calledTwice).to.be.equal(true);
        serverlessStepFunctions.deleteActivity.restore();
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

  describe('#describeActivities()', () => {
    let describeActivityStub;
    beforeEach(() => {
      serverless.service.stepFunctions.activities = [
        'helloHello',
        'hogeHoge',
      ];
      describeActivityStub = sinon
      .stub(serverlessStepFunctions, 'describeActivity').returns(BbPromise.resolve());
    });

    it('should deleteActivities with correct params'
    , () => serverlessStepFunctions.describeActivities()
      .then(() => {
        expect(describeActivityStub.calledTwice).to.be.equal(true);
        serverlessStepFunctions.describeActivity.restore();
      })
    );
  });

  describe('#checkActivitySettings()', () => {
    it('should throw error when activities does not exists', () => {
      expect(() => serverlessStepFunctions.checkActivitySettings()).to.throw(Error);
    });

    it('should return resolve when activities exists', (done) => {
      serverlessStepFunctions.serverless.service.stepFunctions.activities = true;
      serverlessStepFunctions.checkActivitySettings().then(() => done());
    });
  });

  describe('#checkActivitySetting()', () => {
    beforeEach(() => {
      serverless.service.stepFunctions.activities = [
        'helloActivity',
        'name',
      ];
    });

    it('should throw error when activity does not exists', () => {
      serverlessStepFunctions.serverless.service.stepFunctions.activities = [];
      expect(() => serverlessStepFunctions.checkActivitySetting()).to.throw(Error);
    });

    it('should return respleve when correct params is not given', (done) => {
      serverlessStepFunctions.checkActivitySetting().then(() => done());
    });

    it('should return respleve with correct params', (done) => {
      serverlessStepFunctions.checkActivitySetting('name').then(() => done());
    });
  });

  describe('#getActivityArn()', () => {
    let getActivityArnStub;
    beforeEach(() => {
      getActivityArnStub = sinon.stub(serverlessStepFunctions.provider, 'request')
      .returns(BbPromise.resolve({ Account: 1234 }));
    });

    it('should getActivityArn when correct params is not given', () => {
      serverlessStepFunctions.getActivityArn().then(() => {
        expect(getActivityArnStub.calledOnce).to.be.equal(true);
        expect(getActivityArnStub.calledWithExactly(
          'STS',
          'getCallerIdentity',
          {},
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.activityArns.helloActivity).to.be
        .equal('arn:aws:states:us-east-1:1234:activity:step-functions-dev-helloActivity');
        serverlessStepFunctions.provider.request.restore();
      });
    });

    it('should getActivityArn with correct params', () => {
      serverlessStepFunctions.getActivityArn('name').then(() => {
        expect(getActivityArnStub.calledOnce).to.be.equal(true);
        expect(getActivityArnStub.calledWithExactly(
          'STS',
          'getCallerIdentity',
          {},
          serverlessStepFunctions.options.stage,
          serverlessStepFunctions.options.region
        )).to.be.equal(true);
        expect(serverlessStepFunctions.activityArns.name).to.be
        .equal('arn:aws:states:us-east-1:1234:activity:step-functions-dev-name');
        serverlessStepFunctions.provider.request.restore();
      });
    });
  });

  describe('#getActivityArns()', () => {
    let getActivityArnStub;
    beforeEach(() => {
      serverless.service.stepFunctions.activities = [
        'helloHello',
        'hogeHoge',
      ];
      getActivityArnStub = sinon
      .stub(serverlessStepFunctions, 'getActivityArn').returns(BbPromise.resolve());
    });

    it('should getActivityArns with correct params'
    , () => serverlessStepFunctions.getActivityArns()
      .then(() => {
        expect(getActivityArnStub.calledTwice).to.be.equal(true);
        serverlessStepFunctions.getActivityArn.restore();
      })
    );
  });
});
