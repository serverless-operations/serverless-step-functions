'use strict';

const {
  isJsonPathParameter,
  isJsonataArgument,
  getParameterOrArgument,
  hasParameterOrArgument,
  getDynamoDBArn,
} = require('./utils');

function getPermissions(action, state) {
  let resource;

  if (isJsonPathParameter(state, 'TableName') || isJsonataArgument(state, 'TableName')) {
    resource = '*';
  } else if (isJsonPathParameter(state, 'IndexName') || isJsonataArgument(state, 'IndexName')) {
    resource = getDynamoDBArn(`${getParameterOrArgument(state, 'TableName')}/index/*`);
  } else if (hasParameterOrArgument(state, 'IndexName')) {
    const indexName = getParameterOrArgument(state, 'IndexName');
    resource = getDynamoDBArn(`${getParameterOrArgument(state, 'TableName')}/index/${indexName}`);
  } else {
    resource = getDynamoDBArn(getParameterOrArgument(state, 'TableName'));
  }

  return [{ action, resource }];
}

function getBatchPermissions(action, state) {
  if (isJsonPathParameter(state, 'RequestItems') || isJsonataArgument(state, 'RequestItems')) {
    return [{ action, resource: '*' }];
  }

  const tableNames = Object.keys(getParameterOrArgument(state, 'RequestItems'));
  return tableNames.map((tableName) => ({
    action,
    resource: getDynamoDBArn(tableName.replace('.$', '')),
  }));
}

module.exports = { getPermissions, getBatchPermissions };
