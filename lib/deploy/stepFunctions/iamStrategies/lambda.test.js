'use strict';

const itParam = require('mocha-param');
const expect = require('chai').expect;
const logger = require('../../../utils/logger');
const { getPermissions, getFallbackPermissions } = require('./lambda');

// Configure logger so strategy modules can call logger.log
before(() => {
  logger.log = () => {};
});

function getParamsOrArgs(queryLanguage, params, args) {
  return queryLanguage === 'JSONPath'
    ? { Parameters: params }
    : { Arguments: args === undefined ? params : args };
}

// Build a minimal plugin mock. translateLocalFunctionNames is bound to `this` (the plugin),
// so we need serverless.service.provider.compiledCloudFormationTemplate.Resources,
// serverless.service.functions, and provider.naming.getLambdaLogicalId.
function makePlugin(functions) {
  const resources = {};
  const serverless = {
    service: {
      provider: {
        compiledCloudFormationTemplate: { Resources: resources },
      },
      functions: functions || {},
    },
  };

  const provider = {
    naming: {
      getLambdaLogicalId: (name) => {
        // Mirrors Serverless Framework naming: hello-world → HelloDashworldLambdaFunction
        const normalised = name.replace(/-/g, 'Dash').replace(/[^a-zA-Z0-9]/g, '');
        return `${normalised.charAt(0).toUpperCase()}${normalised.slice(1)}LambdaFunction`;
      },
    },
  };

  return { serverless, provider };
}

describe('lambda strategy — getPermissions (lambda:invoke resource type)', () => {
  it('should give lambda:InvokeFunction for a simple function name', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: 'a',
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result).to.have.lengthOf(1);
    expect(result[0].action).to.equal('lambda:InvokeFunction');
    expect(result[0].resource).to.deep.include({ 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:a' });
  });

  it('should give lambda:InvokeFunction for a function name with alias (b:v1)', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: 'b:v1',
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.deep.include({ 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:b:v1' });
  });

  it('should give lambda:InvokeFunction for a full ARN', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: 'arn:aws:lambda:us-west-2:1234567890:function:c',
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.include('arn:aws:lambda:us-west-2:1234567890:function:c');
    expect(result[0].resource).to.include('arn:aws:lambda:us-west-2:1234567890:function:c:*');
  });

  it('should give lambda:InvokeFunction for a partial ARN (accountId:function:name)', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: '1234567890:function:d',
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.deep.include({ 'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:1234567890:function:d' });
  });

  it('should give lambda:InvokeFunction with Fn::Sub array form for Ref FunctionName', () => {
    const lambda1 = { Ref: 'MyFunction' };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: lambda1,
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.deep.include({
      'Fn::Sub': [
        'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${functionArn}',
        { functionArn: lambda1 },
      ],
    });
  });

  it('should give lambda:InvokeFunction with Fn::GetAtt for Fn::GetAtt FunctionName', () => {
    const lambda2 = { 'Fn::GetAtt': ['MyFunction', 'Arn'] };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: lambda2,
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.deep.include(lambda2);
  });

  it('should give lambda:InvokeFunction with other intrinsic function passed through', () => {
    const lambda3 = {
      'Fn::Sub': [
        'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${FunctionName}',
        { FunctionName: 'myFunction' },
      ],
    };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: lambda3,
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.deep.include(lambda3);
  });

  it('should translate local function name Ref to logical resource ID when name is not known', () => {
    const lambda1 = { Ref: 'hello-world' };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: lambda1,
      },
    };
    const plugin = makePlugin({ 'hello-world': { handler: 'hello-world.handler' } });
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.deep.include({
      'Fn::Sub': [
        'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${functionArn}',
        { functionArn: { Ref: 'HelloDashworldLambdaFunction' } },
      ],
    });
  });

  it('should use a static Fn::Sub ARN (no Ref) when FunctionName is a Ref to a local function with a known name', () => {
    // Same circular dependency risk as #470 but via the lambda:invoke SDK integration
    // path: { Ref: LambdaFunction } in the Fn::Sub substitution map still creates a CF
    // dependency. When the function name is known at compile time, use a static string.
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: { Ref: 'hello-world' },
      },
    };
    const plugin = makePlugin({ 'hello-world': { handler: 'hello-world.handler', name: 'my-service-dev-hello-world' } });
    const result = getPermissions(state, { plugin });
    expect(result[0].action).to.equal('lambda:InvokeFunction');
    expect(JSON.stringify(result[0].resource)).to.not.include('"Ref"');
    expect(result[0].resource).to.deep.include({
      'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:my-service-dev-hello-world',
    });
  });

  it('should translate local function name Fn::GetAtt to logical resource ID', () => {
    const lambda2 = { 'Fn::GetAtt': ['hello-world', 'Arn'] };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        FunctionName: lambda2,
      },
    };
    const plugin = makePlugin({ 'hello-world': { handler: 'hello-world.handler' } });
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.deep.include({
      'Fn::GetAtt': ['HelloDashworldLambdaFunction', 'Arn'],
    });
  });

  it('should give lambda:InvokeFunction with * when FunctionName.$ is used (JSONPath)', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
      Parameters: {
        'FunctionName.$': '$.functionName',
        Payload: {},
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.equal('*');
  });

  it('should give lambda:InvokeFunction with AllowedFunctions when FunctionName.$ is used with AllowedFunctions', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
      Parameters: {
        'FunctionName.$': '$.functionName',
        AllowedFunctions: 'arn:aws:lambda:us-west-2:1234567890:function:foo',
        Payload: {},
      },
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.equal('arn:aws:lambda:us-west-2:1234567890:function:foo');
  });

  itParam('should resolve FunctionName for JSONPath and JSONata: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      ...getParamsOrArgs(
        queryLanguage,
        {
          FunctionName: 'arn:aws:lambda:us-west-2:1234567890:function:foo',
          'Payload.$': '$.Payload',
        },
        {
          FunctionName: 'arn:aws:lambda:us-west-2:1234567890:function:foo',
          Payload: '{% $states.input.Payload %}',
        },
      ),
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.deep.equal([
      'arn:aws:lambda:us-west-2:1234567890:function:foo',
      'arn:aws:lambda:us-west-2:1234567890:function:foo:*',
    ]);
  });

  itParam('should give * when FunctionName is dynamic: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
      ...getParamsOrArgs(
        queryLanguage,
        {
          'FunctionName.$': '$.functionName',
          Payload: {},
        },
        {
          FunctionName: '{% $states.input.functionName %}',
          Payload: {},
        },
      ),
    };
    const plugin = makePlugin();
    const result = getPermissions(state, { plugin });
    expect(result[0].resource).to.equal('*');
  });
});

describe('lambda strategy — getFallbackPermissions (direct lambda ARN task resource)', () => {
  it('should give lambda:InvokeFunction for a direct lambda ARN resource', () => {
    const lambdaArn = 'arn:aws:lambda:us-west-2:1234567890:function:foo';
    const state = {
      Type: 'Task',
      Resource: lambdaArn,
    };
    const plugin = makePlugin();
    const result = getFallbackPermissions(state, { plugin });
    expect(result[0].action).to.equal('lambda:InvokeFunction');
    expect(result[0].resource).to.include(lambdaArn);
  });

  it('should give lambda:InvokeFunction for a lambda ARN with alias, including both bare and :* forms', () => {
    const lambdaArn = 'arn:aws:lambda:region:accountId:function:with-alias:some-alias';
    const state = {
      Type: 'Task',
      Resource: lambdaArn,
    };
    const plugin = makePlugin({ 'with-alias': { handler: 'with-alias.handler' } });
    const result = getFallbackPermissions(state, { plugin });
    expect(result[0].resource).to.have.lengthOf(2);
    // trimAliasFromLambdaArn removes :some-alias, leaving the base ARN
    const baseArn = 'arn:aws:lambda:region:accountId:function:with-alias';
    expect(result[0].resource).to.include(baseArn);
  });

  it('should give lambda:InvokeFunction for an intrinsic function resource (Ref to external resource)', () => {
    const state = {
      Type: 'Task',
      Resource: { Ref: 'MyFunction' },
    };
    const plugin = makePlugin();
    const result = getFallbackPermissions(state, { plugin });
    expect(result[0].action).to.equal('lambda:InvokeFunction');
  });

  it('should use a static Fn::Sub ARN (no Ref) when Resource is a Ref to a local function with a known name', () => {
    // Reproduces issue #470: using { Ref: localFunction } in the IAM policy resource
    // creates a CloudFormation dependency StateMachineRole → Lambda. If the Lambda has
    // an env var referencing the state machine ARN, CloudFormation rejects the template
    // with a circular dependency error. The fix: resolve the function name at compile
    // time and emit a static Fn::Sub string so no CF resource reference is introduced.
    const state = {
      Type: 'Task',
      Resource: { Ref: 'parseCSV' },
    };
    const plugin = makePlugin({ parseCSV: { handler: 'handler.parseCSV', name: 'my-service-dev-parseCSV' } });
    const result = getFallbackPermissions(state, { plugin });
    expect(result[0].action).to.equal('lambda:InvokeFunction');
    expect(JSON.stringify(result[0].resource)).to.not.include('"Ref"');
    expect(result[0].resource).to.deep.include({
      'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:my-service-dev-parseCSV',
    });
    expect(result[0].resource).to.deep.include({
      'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:my-service-dev-parseCSV:*',
    });
  });

  it('should use a static Fn::Sub ARN when Resource is the CloudFormation logical ID of a local function', () => {
    const state = {
      Type: 'Task',
      Resource: { Ref: 'ParseCSVLambdaFunction' },
    };
    const plugin = makePlugin({ parseCSV: { handler: 'handler.parseCSV', name: 'my-service-dev-parseCSV' } });
    const result = getFallbackPermissions(state, { plugin });
    expect(JSON.stringify(result[0].resource)).to.not.include('"Ref"');
    expect(result[0].resource).to.deep.include({
      'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:my-service-dev-parseCSV',
    });
  });

  it('should return [] for a non-lambda, non-intrinsic resource', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::foo:bar',
    };
    const plugin = makePlugin();
    const result = getFallbackPermissions(state, { plugin });
    expect(result).to.deep.equal([]);
  });

  it('should not produce a nested Fn::Sub when Resource is a Fn::Sub expression (issue #302)', () => {
    // serverless-pseudo-parameters converts #{AWS::Region} → ${AWS::Region} and wraps
    // the whole ARN in Fn::Sub. Putting that object as a variable value inside another
    // Fn::Sub array is invalid CloudFormation and causes MalformedPolicyDocument errors.
    const state = {
      Type: 'Task',
      Resource: {
        'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:my-fn',
      },
    };
    const plugin = makePlugin();
    const result = getFallbackPermissions(state, { plugin });
    expect(result[0].action).to.equal('lambda:InvokeFunction');
    const arnList = result[0].resource;
    for (const arn of arnList) {
      if (arn && typeof arn === 'object' && Array.isArray(arn['Fn::Sub'])) {
        const [, varMap] = arn['Fn::Sub'];
        if (varMap) {
          for (const val of Object.values(varMap)) {
            expect(val, 'variable map value must not be a nested Fn::Sub').to.not.have.property('Fn::Sub');
          }
        }
      }
    }
  });

  it('should generate a valid versioned ARN when Resource is a Fn::Sub string', () => {
    const fnSub = 'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:my-fn';
    const state = {
      Type: 'Task',
      Resource: { 'Fn::Sub': fnSub },
    };
    const plugin = makePlugin();
    const result = getFallbackPermissions(state, { plugin });
    const arnList = result[0].resource;
    const versionedArn = arnList.find((a) => a && a['Fn::Sub'] === `${fnSub}:*`);
    expect(versionedArn, 'versioned ARN should be a simple Fn::Sub string with :* appended').to.not.equal(undefined);
  });
});
