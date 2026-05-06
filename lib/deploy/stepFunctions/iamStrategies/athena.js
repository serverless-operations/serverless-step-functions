'use strict';

// IAM permissions follow AWS's documented templates for Step Functions ↔ Athena
// integration. Athena is unusual: it uses the *caller's* IAM identity for Glue
// catalog and S3 data access, so the state machine's execution role needs Glue,
// S3, and Lake Formation grants in addition to the athena: actions.
// Reference: https://docs.aws.amazon.com/step-functions/latest/dg/connect-athena.html

const S3_PERMISSIONS = {
  action: 's3:GetBucketLocation,s3:GetObject,s3:ListBucket,s3:ListBucketMultipartUploads,s3:ListMultipartUploadParts,s3:AbortMultipartUpload,s3:CreateBucket,s3:PutObject',
  resource: 'arn:aws:s3:::*',
};

const GLUE_PERMISSIONS = {
  action: 'glue:CreateDatabase,glue:GetDatabase,glue:GetDatabases,glue:UpdateDatabase,glue:DeleteDatabase,glue:CreateTable,glue:UpdateTable,glue:GetTable,glue:GetTables,glue:DeleteTable,glue:BatchDeleteTable,glue:BatchCreatePartition,glue:CreatePartition,glue:UpdatePartition,glue:GetPartition,glue:GetPartitions,glue:BatchGetPartition,glue:DeletePartition,glue:BatchDeletePartition',
  resource: [
    { 'Fn::Sub': ['arn:${AWS::Partition}:glue:${AWS::Region}:${AWS::AccountId}:catalog', {}] },
    { 'Fn::Sub': ['arn:${AWS::Partition}:glue:${AWS::Region}:${AWS::AccountId}:database/*', {}] },
    { 'Fn::Sub': ['arn:${AWS::Partition}:glue:${AWS::Region}:${AWS::AccountId}:table/*', {}] },
    { 'Fn::Sub': ['arn:${AWS::Partition}:glue:${AWS::Region}:${AWS::AccountId}:userDefinedFunction/*', {}] },
  ],
};

const LAKE_FORMATION_PERMISSION = {
  action: 'lakeformation:GetDataAccess',
  resource: '*',
};

function workGroupArn(workGroupName) {
  const target = workGroupName || '*';
  return {
    'Fn::Sub': [
      `arn:\${AWS::Partition}:athena:\${AWS::Region}:\${AWS::AccountId}:workgroup/${target}`,
      {},
    ],
  };
}

const dataCatalogArn = {
  'Fn::Sub': [
    'arn:${AWS::Partition}:athena:${AWS::Region}:${AWS::AccountId}:datacatalog/*',
    {},
  ],
};

function staticWorkGroup(state) {
  const wg = state && state.Parameters && state.Parameters.WorkGroup;
  return typeof wg === 'string' && wg.length > 0 ? wg : null;
}

function getStartQueryPermissions({ sync = false, state } = {}) {
  const athenaActions = sync
    ? 'athena:startQueryExecution,athena:stopQueryExecution,athena:getQueryExecution,athena:getDataCatalog,athena:GetWorkGroup,athena:BatchGetQueryExecution,athena:GetQueryResults,athena:ListQueryExecutions'
    : 'athena:startQueryExecution,athena:getDataCatalog';

  return [
    {
      action: athenaActions,
      resource: [workGroupArn(staticWorkGroup(state)), dataCatalogArn],
    },
    S3_PERMISSIONS,
    GLUE_PERMISSIONS,
    LAKE_FORMATION_PERMISSION,
  ];
}

function getStopQueryPermissions() {
  return [{ action: 'athena:stopQueryExecution', resource: workGroupArn(null) }];
}

function getGetQueryExecutionPermissions() {
  return [{ action: 'athena:getQueryExecution', resource: workGroupArn(null) }];
}

function getGetQueryResultsPermissions() {
  return [
    { action: 'athena:getQueryResults', resource: workGroupArn(null) },
    { action: 's3:GetObject', resource: 'arn:aws:s3:::*' },
  ];
}

module.exports = {
  getStartQueryPermissions,
  getStopQueryPermissions,
  getGetQueryExecutionPermissions,
  getGetQueryResultsPermissions,
};
