'use strict';

const itParam = require('mocha-param');
const expect = require('chai').expect;
const { getPermissions, getBatchPermissions } = require('./dynamodb');

function getParamsOrArgs(queryLanguage, params, args) {
  return queryLanguage === 'JSONPath'
    ? { Parameters: params }
    : { Arguments: args === undefined ? params : args };
}

const helloTableArn = {
  'Fn::Join': [
    ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, 'table/hello'],
  ],
};

describe('dynamodb strategy', () => {
  itParam('should give dynamodb:UpdateItem permission with specific table: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::dynamodb:updateItem',
      ...getParamsOrArgs(queryLanguage, { TableName: 'hello' }),
    };
    const result = getPermissions('dynamodb:UpdateItem', state);
    expect(result).to.deep.equal([{ action: 'dynamodb:UpdateItem', resource: helloTableArn }]);
  });

  itParam('should give dynamodb permission to * when TableName.$ is seen: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::dynamodb:updateItem',
      ...getParamsOrArgs(
        queryLanguage,
        { 'TableName.$': '$.tableName' },
        { TableName: '{% $tableName %}' },
      ),
    };
    const result = getPermissions('dynamodb:UpdateItem', state);
    expect(result).to.deep.equal([{ action: 'dynamodb:UpdateItem', resource: '*' }]);
  });

  itParam('should include index ARN when IndexName is provided: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:dynamodb:query',
      ...getParamsOrArgs(queryLanguage, { TableName: 'hello', IndexName: 'GSI1' }),
    };
    const result = getPermissions('dynamodb:Query', state);
    expect(result).to.have.lengthOf(1);
    expect(result[0].action).to.equal('dynamodb:Query');
    // resource should be the index ARN
    expect(result[0].resource['Fn::Join'][1][5]).to.equal('table/hello/index/GSI1');
  });

  itParam('should give dynamodb permission to table/TableName/index/* when IndexName.$ is seen: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:dynamodb:query',
      ...getParamsOrArgs(
        queryLanguage,
        { TableName: 'hello', 'IndexName.$': '$.myDynamicIndexName' },
        { TableName: 'hello', IndexName: '{% $myDynamicIndexName %}' },
      ),
    };
    const result = getPermissions('dynamodb:Query', state);
    expect(result[0].resource['Fn::Join'][1][5]).to.equal('table/hello/index/*');
  });

  itParam('should give dynamodb permission to * when both TableName.$ and IndexName.$ are seen: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:dynamodb:query',
      ...getParamsOrArgs(
        queryLanguage,
        { 'TableName.$': '$.myDynamicTableName', 'IndexName.$': '$.myDynamicIndexName' },
        { TableName: '{% $myDynamicTableName %}', IndexName: '{% $myDynamicIndexName %}' },
      ),
    };
    const result = getPermissions('dynamodb:Query', state);
    expect(result[0].resource).to.equal('*');
  });

  itParam('should give dynamodb:Scan permission for aws-sdk:dynamodb:scan: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:dynamodb:scan',
      ...getParamsOrArgs(queryLanguage, { TableName: 'hello' }),
    };
    const result = getPermissions('dynamodb:Scan', state);
    expect(result).to.deep.equal([{
      action: 'dynamodb:Scan',
      resource: helloTableArn,
    }]);
  });

  itParam('should give dynamodb permission for table imported from external stack: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const externalHelloTable = { 'Fn::ImportValue': 'HelloStack:Table:Name' };
    const expectedArn = {
      'Fn::Join': [
        ':', ['arn', { Ref: 'AWS::Partition' }, 'dynamodb', { Ref: 'AWS::Region' }, { Ref: 'AWS::AccountId' }, { 'Fn::Join': ['/', ['table', externalHelloTable]] }],
      ],
    };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::dynamodb:updateItem',
      ...getParamsOrArgs(queryLanguage, { TableName: externalHelloTable }),
    };
    const result = getPermissions('dynamodb:UpdateItem', state);
    expect(result).to.deep.equal([{ action: 'dynamodb:UpdateItem', resource: expectedArn }]);
  });

  // Batch operations
  itParam('should give batch dynamodb:BatchWriteItem permission for specific table: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:dynamodb:batchWriteItem',
      ...getParamsOrArgs(queryLanguage, { RequestItems: { hello: [] } }),
    };
    const result = getBatchPermissions('dynamodb:BatchWriteItem', state);
    expect(result).to.deep.equal([{ action: 'dynamodb:BatchWriteItem', resource: helloTableArn }]);
  });

  itParam('should give batch dynamodb permission to * when RequestItems.$ is seen: ${value}', ['JSONPath', 'JSONata'], (queryLanguage) => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:dynamodb:batchWriteItem',
      ...getParamsOrArgs(
        queryLanguage,
        { 'RequestItems.$': '$.requestItems' },
        { RequestItems: '{% $requestItems %}' },
      ),
    };
    const result = getBatchPermissions('dynamodb:BatchWriteItem', state);
    expect(result).to.deep.equal([{ action: 'dynamodb:BatchWriteItem', resource: '*' }]);
  });
});
