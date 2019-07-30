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

module.exports = {
  isIntrinsic,
  translateLocalFunctionNames,
};
