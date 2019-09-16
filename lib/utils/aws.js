const _ = require('lodash');

function isIntrinsic(obj) {
  return _.isObjectLike(obj)
    && Object.keys(obj).some(k => k.startsWith('Fn::') || k === 'Ref');
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
    .filter(logicalId => resources[logicalId].Type === 'AWS::Lambda::Version')
    .map(logicalId => [logicalId, resources[logicalId]]);

  const isFunction = logicalId => _.has(resources, logicalId) && resources[logicalId].Type === 'AWS::Lambda::Function';
  const getVersion = (logicalId) => {
    const version = versions.find(x => _.get(x[1], 'Properties.FunctionName.Ref') === logicalId);
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

// If the resource is a lambda ARN string, trim off the alias
function trimAliasFromLambdaArn(resource) {
  if (typeof resource === 'string' && resource.startsWith('arn:aws:lambda')) {
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
};
