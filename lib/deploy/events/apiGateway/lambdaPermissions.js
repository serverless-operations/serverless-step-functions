'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

// a function URI looks like this
// "Fn::Join": [
//   "",
//   [
//     "arn:",
//     { "Ref": "AWS::Partition" },
//     ":apigateway:",
//     { "Ref": "AWS::Region" },
//     ":lambda:path/2015-03-31/functions/",
//     {
//       "Fn::GetAtt": [
//         "HelloLambdaFunction",
//         "Arn"
//       ]
//     },
//     "/invocations"
//   ]
// ]
const getFunctionLogicalId = (uri) => {
  const parts = uri['Fn::Join'][1];
  const functionRef = parts.find(x => _.has(x, 'Fn::GetAtt'));
  return _.get(functionRef, "['Fn::GetAtt'][0]", parts[parts.length - 2]);
};

const ARNRegex = /^arn:[^:\n]*:[^:\n]*:[^:\n]*:[^:\n]*:(?<resourceName>[^:/]*)[:/]?.*$/;

const getLambdaPermission = logicalId => ({
  Type: 'AWS::Lambda::Permission',
  Properties: {
    FunctionName: ARNRegex.test(logicalId) ? logicalId : {
      'Fn::GetAtt': [logicalId, 'Arn'],
    },
    Action: 'lambda:InvokeFunction',
    Principal: {
      'Fn::Sub': 'apigateway.${AWS::URLSuffix}',
    },
  },
});

module.exports = {
  compileHttpLambdaPermissions() {
    const resources = _.get(
      this.serverless, 'service.provider.compiledCloudFormationTemplate.Resources', {},
    );
    const authorizers = _.values(resources).filter(r => r.Type === 'AWS::ApiGateway::Authorizer');
    const customAuthorizers = authorizers.filter(r => r.Properties.Type === 'CUSTOM' || r.Properties.Type === 'TOKEN');
    const uris = customAuthorizers.map(r => r.Properties.AuthorizerUri);
    const funcLogicalIds = _.uniq(uris.map(getFunctionLogicalId));
    if (_.isEmpty(funcLogicalIds)) {
      return BbPromise.resolve();
    }

    const lambdaPermissions = _.zipObject(
      funcLogicalIds.map((id) => {
        if (ARNRegex.test(id)) {
          const { groups: { resourceName } } = id.match(ARNRegex);
          return `${resourceName}LambdaPermission`;
        }

        return `${id}LambdaPermission`;
      }),
      funcLogicalIds.map(getLambdaPermission),
    );

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      lambdaPermissions);
    return BbPromise.resolve();
  },
};
