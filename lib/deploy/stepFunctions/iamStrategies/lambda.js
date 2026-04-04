'use strict';

const _ = require('lodash');
const {
  isIntrinsic, translateLocalFunctionNames, trimAliasFromLambdaArn, resolveLambdaFunctionName,
} = require('../../../utils/aws');
const logger = require('../../../utils/logger');
const { isJsonPathParameter, isJsonataArgument, getParameterOrArgument } = require('./utils');

function getPermissions(state, { plugin }) {
  if (isJsonPathParameter(state, 'FunctionName') || isJsonataArgument(state, 'FunctionName')) {
    const allowedFunctions = getParameterOrArgument(state, 'AllowedFunctions');
    return [{
      action: 'lambda:InvokeFunction',
      resource: allowedFunctions || '*',
    }];
  }

  const functionName = getParameterOrArgument(state, 'FunctionName');

  if (_.isString(functionName)) {
    const segments = functionName.split(':');

    let functionArns;
    if (functionName.match(/^arn:aws(-[a-z]+)*:lambda/)) {
      functionArns = [
        functionName,
        `${functionName}:*`,
      ];
    } else if (segments.length === 3 && segments[0].match(/^\d+$/)) {
      functionArns = [
        { 'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:${functionName}` },
        { 'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:${functionName}:*` },
      ];
    } else {
      functionArns = [
        {
          'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${functionName}`,
        },
        {
          'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${functionName}:*`,
        },
      ];
    }

    return [{
      action: 'lambda:InvokeFunction',
      resource: functionArns,
    }];
  }

  if (_.has(functionName, 'Fn::GetAtt')) {
    const functionArn = translateLocalFunctionNames.bind(plugin)(functionName);
    return [{
      action: 'lambda:InvokeFunction',
      resource: [
        functionArn,
        { 'Fn::Sub': ['${functionArn}:*', { functionArn }] },
      ],
    }];
  }

  if (_.has(functionName, 'Ref')) {
    const resolvedName = resolveLambdaFunctionName(functionName, plugin);
    if (resolvedName) {
      return [{
        action: 'lambda:InvokeFunction',
        resource: [
          { 'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${resolvedName}` },
          { 'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${resolvedName}:*` },
        ],
      }];
    }
    const functionArn = translateLocalFunctionNames.bind(plugin)(functionName);
    return [{
      action: 'lambda:InvokeFunction',
      resource: [
        {
          'Fn::Sub': [
            'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${functionArn}',
            { functionArn },
          ],
        },
        {
          'Fn::Sub': [
            'arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${functionArn}:*',
            { functionArn },
          ],
        },
      ],
    }];
  }

  return [{
    action: 'lambda:InvokeFunction',
    resource: functionName,
  }];
}

function getVersionedArn(functionArn) {
  if (_.has(functionArn, 'Fn::Sub')) {
    const sub = functionArn['Fn::Sub'];
    if (typeof sub === 'string') {
      return { 'Fn::Sub': `${sub}:*` };
    }
    if (Array.isArray(sub)) {
      return { 'Fn::Sub': [`${sub[0]}:*`, sub[1]] };
    }
  }
  return { 'Fn::Sub': ['${functionArn}:*', { functionArn }] };
}

function getFallbackPermissions(state, { plugin }) {
  if (isIntrinsic(state.Resource) || !!state.Resource.match(/arn:aws(-[a-z]+)*:lambda/)) {
    const trimmedArn = trimAliasFromLambdaArn(state.Resource);

    const resolvedName = resolveLambdaFunctionName(trimmedArn, plugin);
    if (resolvedName) {
      return [{
        action: 'lambda:InvokeFunction',
        resource: [
          { 'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${resolvedName}` },
          { 'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${resolvedName}:*` },
        ],
      }];
    }

    const functionArn = translateLocalFunctionNames.bind(plugin)(trimmedArn);
    return [{
      action: 'lambda:InvokeFunction',
      resource: [
        functionArn,
        getVersionedArn(functionArn),
      ],
    }];
  }
  logger.log('Cannot generate IAM policy statement for Task state', state);
  return [];
}

module.exports = { getPermissions, getFallbackPermissions };
