const _ = require('lodash');

function isIntrinsic(obj) {
  return _.isObjectLike(obj)
    && Object.keys(obj).some((k) => k.startsWith('Fn::') || k === 'Ref');
}

// translates local function names, e.g. hello-world
// to logical resource name, e.g. HelloDashworldLambdaFunction
function translateLocalFunctionNames(value) {
  const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
  const functions = this.serverless.service.functions;

  const translate = (logicalId) => {
    if (!_.has(resources, logicalId) && _.has(functions, logicalId)) {
      const functionName = logicalId;
      return this.provider.naming.getLambdaLogicalId(functionName);
    }

    return logicalId;
  };

  if (_.has(value, 'Ref')) {
    const logicalId = value.Ref;
    return {
      Ref: translate(logicalId),
    };
  }

  if (_.has(value, 'Fn::GetAtt')) {
    const [logicalId, prop] = value['Fn::GetAtt'];
    return {
      'Fn::GetAtt': [translate(logicalId), prop],
    };
  }

  return value;
}

// converts a reference to a function to a reference to a function version
function convertToFunctionVersion(value) {
  const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
  const versions = Object.keys(resources) // [ [logicalId, version] ]
    .filter((logicalId) => resources[logicalId].Type === 'AWS::Lambda::Version')
    .map((logicalId) => [logicalId, resources[logicalId]]);

  const isFunction = (logicalId) => _.has(resources, logicalId) && resources[logicalId].Type === 'AWS::Lambda::Function';
  const getVersion = (logicalId) => {
    const version = versions.find((x) => _.get(x[1], 'Properties.FunctionName.Ref') === logicalId);
    if (version) {
      return version[0];
    }

    return null;
  };

  if (_.has(value, 'Ref') && isFunction(value.Ref)) {
    const version = getVersion(value.Ref);
    if (version) {
      return { Ref: version };
    }
    return value;
  }

  // for Lambda function, Get::Att can only return the ARN
  // but for Lambda version, you need Ref to get its ARN, hence why we return Ref here
  if (_.has(value, 'Fn::GetAtt') && isFunction(value['Fn::GetAtt'][0])) {
    const version = getVersion(value['Fn::GetAtt'][0]);
    if (version) {
      return { Ref: version };
    }
    return value;
  }

  return value;
}

// Resolve a Ref to a local Lambda function to its deployed function name string.
// Returns the name if resolvable, null otherwise.
//
// Using { Ref: LambdaFunctionLogicalId } in an IAM policy resource or state
// machine definition creates a hard CloudFormation dependency and resolves to
// the function *name* (not ARN) at CF evaluation time. IAM rejects non-ARN
// resources; Step Functions rejects non-ARN task resources. Resolving to a
// static name string allows callers to construct a proper Fn::Sub ARN without
// any CF resource reference, eliminating both problems.
function resolveLambdaFunctionName(ref, plugin) {
  if (!_.has(ref, 'Ref')) return null;

  const refValue = ref.Ref;
  const functions = _.get(plugin, 'serverless.service.functions') || {};

  // Case 1: Ref is the Serverless function key directly (e.g. 'parseCSV')
  let fnKey = _.has(functions, refValue) ? refValue : null;

  // Case 2: Ref is the CloudFormation logical ID (e.g. 'ParseCSVLambdaFunction')
  if (!fnKey) {
    fnKey = Object.keys(functions).find(
      (key) => plugin.provider.naming.getLambdaLogicalId(key) === refValue,
    ) || null;
  }

  if (!fnKey) return null;

  const name = _.get(functions, [fnKey, 'name']);
  return typeof name === 'string' ? name : null;
}

// If the resource is a lambda ARN string, trim off the alias
function trimAliasFromLambdaArn(resource) {
  if (typeof resource === 'string' && !!resource.match(/^arn:aws(-[a-z]+)*:lambda/)) {
    const components = resource.split(':');
    // Lambda ARNs with an alias have 8 components
    // E.g. arn:aws:lambda:region:accountId:function:name:alias
    const numberOfComponentsWhenAliasExists = 8;
    const hasAlias = components.length === numberOfComponentsWhenAliasExists;
    // Slice off the last component and join it back into an ARN string
    return hasAlias ? components.slice(0, numberOfComponentsWhenAliasExists - 1).join(':') : resource;
  }
  return resource;
}

module.exports = {
  isIntrinsic,
  translateLocalFunctionNames,
  convertToFunctionVersion,
  trimAliasFromLambdaArn,
  resolveLambdaFunctionName,
};
