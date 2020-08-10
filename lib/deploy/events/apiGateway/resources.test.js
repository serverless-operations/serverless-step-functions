'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const ServerlessStepFunctions = require('./../../../index');

describe('#compileResources()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless);
    serverlessStepFunctions.apiGatewayRestApiLogicalId = 'ApiGatewayRestApi';
    serverlessStepFunctions.pluginhttpValidated = {};
  });

  // sorted makes parent refs easier
  it('should construct the correct (sorted) resourcePaths array', () => {
    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: '',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'foo/bar',
          method: 'POST',
        },
      },
      {
        http: {
          path: 'bar/-',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/foo',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/{id}/foobar',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/{id}',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/{foo_id}',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/{foo_id}/foobar',
          method: 'GET',
        },
      },
    ];
    expect(Object.keys(serverlessStepFunctions.getResourcePaths())).to.deep.equal([
      'foo',
      'foo/bar',
      'bar',
      'bar/-',
      'bar/foo',
      'bar/{id}',
      'bar/{id}/foobar',
      'bar/{foo_id}',
      'bar/{foo_id}/foobar',
    ]);
  });

  it('should reference the appropriate ParentId', () => {
    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: 'foo/bar',
          method: 'POST',
        },
      },
      {
        http: {
          path: 'bar/-',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/foo',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/{id}/foobar',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/{id}',
          method: 'GET',
        },
      },
    ];
    return serverlessStepFunctions.compileResources().then(() => {
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFoo.Properties.ParentId['Fn::GetAtt'][0])
        .to.equal('ApiGatewayRestApi');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFoo.Properties.ParentId['Fn::GetAtt'][1])
        .to.equal('RootResourceId');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFooBar.Properties.ParentId.Ref)
        .to.equal('ApiGatewayResourceFoo');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceBarIdVar.Properties.ParentId.Ref)
        .to.equal('ApiGatewayResourceBar');
    });
  });

  it('should construct the correct resourceLogicalIds object', () => {
    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: '',
          method: 'POST',
        },
      },
      {
        http: {
          path: 'foo',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'foo/{foo_id}/bar',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'baz/foo',
          method: 'GET',
        },
      },
    ];
    return serverlessStepFunctions.compileResources().then(() => {
      const expectedResourceLogicalIds = {
        baz: 'ApiGatewayResourceBaz',
        'baz/foo': 'ApiGatewayResourceBazFoo',
        foo: 'ApiGatewayResourceFoo',
        'foo/{foo_id}': 'ApiGatewayResourceFooFooidVar',
        'foo/{foo_id}/bar': 'ApiGatewayResourceFooFooidVarBar',
      };
      Object.keys(expectedResourceLogicalIds).forEach((path) => {
        expect(serverlessStepFunctions.apiGatewayResources[path].resourceLogicalId)
          .equal(expectedResourceLogicalIds[path]);
      });
    });
  });

  it('should construct resourceLogicalIds that do not collide', () => {
    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: 'foo/bar',
          method: 'POST',
        },
      },
      {
        http: {
          path: 'foo/{bar}',
          method: 'GET',
        },
      },
    ];
    return serverlessStepFunctions.compileResources().then(() => {
      const expectedResourceLogicalIds = {
        foo: 'ApiGatewayResourceFoo',
        'foo/bar': 'ApiGatewayResourceFooBar',
        'foo/{bar}': 'ApiGatewayResourceFooBarVar',
      };
      Object.keys(expectedResourceLogicalIds).forEach((path) => {
        expect(serverlessStepFunctions.apiGatewayResources[path].resourceLogicalId)
          .equal(expectedResourceLogicalIds[path]);
      });
    });
  });

  it('should set the appropriate Pathpart', () => {
    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: 'foo/{bar}',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'foo/bar',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'foo/{bar}/baz',
          method: 'GET',
        },
      },
    ];
    return serverlessStepFunctions.compileResources().then(() => {
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFooBar.Properties.PathPart)
        .to.equal('bar');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFooBarVar.Properties.PathPart)
        .to.equal('{bar}');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFooBarVarBaz.Properties.PathPart)
        .to.equal('baz');
    });
  });

  it('should handle root resource references', () => {
    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: '',
          method: 'GET',
        },
      },
    ];
    return serverlessStepFunctions.compileResources().then(() => {
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources).to.deep.equal({});
    });
  });

  it('should create child resources only if there are predefined parent resources', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway = {
      restApiId: '6fyzt1pfpk',
      restApiRootResourceId: 'z5d4qh4oqi',
      restApiResources: {
        '/foo': 'axcybf2i39',
        '/users': 'zxcvbnmasd',
        '/users/friends': 'fcasdoojp1',
        '/groups': 'iuoyiusduo',
      },
    };

    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: 'foo/bar',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'foo/bar',
          method: 'POST',
        },
      },
      {
        http: {
          path: 'foo/bar',
          method: 'DELETE',
        },
      },
      {
        http: {
          path: 'bar/-',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/foo',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/{id}/foobar',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'bar/{id}',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users/friends/comments',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users/me/posts',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'groups/categories',
          method: 'GET',
        },
      },
    ];
    return serverlessStepFunctions.compileResources().then(() => {
      try {
        serverlessStepFunctions.getResourceId('users/{userId}');
        throw new Error('Expected API Gateway resource not found error, got success');
      } catch (e) {
        expect(e.message).to.equal('Can not find API Gateway resource from path users/{userId}');
      }

      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFoo).to.equal(undefined);
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceBar.Properties.RestApiId)
        .to.equal('6fyzt1pfpk');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceBar.Properties.ParentId)
        .to.equal('z5d4qh4oqi');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFooBar.Properties.ParentId)
        .to.equal('axcybf2i39');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceBarIdVar.Properties.ParentId.Ref)
        .to.equal('ApiGatewayResourceBar');
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceUsersMePosts).not.equal(undefined);
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceUsersFriendsComments.Properties.ParentId)
        .to.equal('fcasdoojp1');
    });
  });

  it('should not create any child resources if all resources exists', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway = {
      restApiId: '6fyzt1pfpk',
      restApiRootResourceId: 'z5d4qh4oqi',
      restApiResources: {
        foo: 'axcybf2i39',
        users: 'zxcvbnmasd',
        'users/friends': 'fcasdoojp1',
        'users/is/this/a/long/path': 'sadvgpoujk',
      },
    };

    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: 'foo',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users/friends',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users/is/this/a/long/path',
          method: 'GET',
        },
      },
    ];

    return serverlessStepFunctions.compileResources().then(() => {
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceFoo).to.equal(undefined);
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceUsers).to.equal(undefined);
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceUsersFriends).to.equal(undefined);
      expect(serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
        .Resources.ApiGatewayResourceUsersIsThis).to.equal(undefined);
    });
  });

  it('should throw error if parent of existing resources is required', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway = {
      restApiId: '6fyzt1pfpk',
      restApiRootResourceId: 'z5d4qh4oqi',
      restApiResources: {
        'users/friends': 'fcasdoojp1',
      },
    };

    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: 'users',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users/friends/{friendId}',
          method: 'GET',
        },
      },
    ];

    expect(() => serverlessStepFunctions.compileResources())
      .to.throw(Error, 'Resource ID for path users is required');
  });

  it('should throw error if API root resourceId of existing resource is required', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway = {
      restApiId: '6fyzt1pfpk',
      restApiRootResourceId: '',
      restApiResources: {
        'users/friends': 'fcasdoojp1',
      },
    };

    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: 'users/test/{id}',
          method: 'GET',
        },
      },
    ];

    expect(() => serverlessStepFunctions.compileResources())
      .to.throw(Error, 'Resource ID for path users is required');
  });

  it('should named all method paths if all resources are predefined', () => {
    serverlessStepFunctions.serverless.service.provider.apiGateway = {
      restApiId: '6fyzt1pfpk',
      restApiRootResourceId: 'z5d4qh4oqi',
      restApiResources: {
        'users/{id}': 'fcasdoojp1',
        'users/friends': 'fcasdoojp1',
        'users/friends/{id}': 'fcasdoojp1',
      },
    };

    serverlessStepFunctions.pluginhttpValidated.events = [
      {
        http: {
          path: '/users/{id}',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users/friends',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users/friends',
          method: 'POST',
        },
      },
      {
        http: {
          path: 'users/friends',
          method: 'DELETE',
        },
      },
      {
        http: {
          path: 'users/friends/{id}',
          method: 'GET',
        },
      },
      {
        http: {
          path: 'users/friends/{id}',
          method: 'POST',
        },
      },
    ];

    return serverlessStepFunctions.compileResources().then(() => {
      expect(Object.keys(serverlessStepFunctions.serverless
        .service.provider.compiledCloudFormationTemplate
        .Resources).every(k => ['ApiGatewayMethodundefinedGet',
        'ApiGatewayMethodundefinedPost'].indexOf(k) === -1))
        .to.equal(true);
    });
  });

  it('should return empty string if path is empty', () => {
    expect(serverlessStepFunctions.getResourceName('')).to.equal('');
  });

  it('should return empty string if no resources', () => {
    expect(serverlessStepFunctions.getResourceName('users/friends')).to.equal('');
  });

  it('should return resource name for given path', () => {
    serverlessStepFunctions.apiGatewayResources = {
      'users/create': {
        name: 'UsersCreate',
        resourceLogicalId: 'ApiGatewayResourceUsersCreate',
      },
    };

    expect(serverlessStepFunctions.getResourceName('users/create')).to.equal('UsersCreate');
  });
});
