'use strict';

const sqs = require('./sqs');
const sns = require('./sns');
const dynamodb = require('./dynamodb');
const redshiftData = require('./redshiftData');
const batch = require('./batch');
const glue = require('./glue');
const ecs = require('./ecs');
const lambda = require('./lambda');
const stepFunctions = require('./stepFunctions');
const codebuild = require('./codebuild');
const sagemaker = require('./sagemaker');
const bedrock = require('./bedrock');
const eventbridge = require('./eventbridge');
const http = require('./http');
const s3 = require('./s3');
const ses = require('./ses');
const emr = require('./emr');
const athena = require('./athena');

// Maps normalized resource ARNs to their permission handler.
// ARNs are normalized by replacing any AWS partition prefix with 'arn:aws:' before lookup.
const registry = new Map([
  // SQS
  ['arn:aws:states:::sqs:sendMessage', sqs.getPermissions],
  ['arn:aws:states:::sqs:sendMessage.waitForTaskToken', sqs.getPermissions],

  // SNS
  ['arn:aws:states:::sns:publish', sns.getPermissions],
  ['arn:aws:states:::sns:publish.waitForTaskToken', sns.getPermissions],

  // DynamoDB — single-item operations
  ['arn:aws:states:::dynamodb:updateItem', (state) => dynamodb.getPermissions('dynamodb:UpdateItem', state)],
  ['arn:aws:states:::aws-sdk:dynamodb:updateItem', (state) => dynamodb.getPermissions('dynamodb:UpdateItem', state)],
  ['arn:aws:states:::aws-sdk:dynamodb:updateItem.waitForTaskToken', (state) => dynamodb.getPermissions('dynamodb:UpdateItem', state)],
  ['arn:aws:states:::dynamodb:putItem', (state) => dynamodb.getPermissions('dynamodb:PutItem', state)],
  ['arn:aws:states:::aws-sdk:dynamodb:putItem', (state) => dynamodb.getPermissions('dynamodb:PutItem', state)],
  ['arn:aws:states:::aws-sdk:dynamodb:putItem.waitForTaskToken', (state) => dynamodb.getPermissions('dynamodb:PutItem', state)],
  ['arn:aws:states:::dynamodb:getItem', (state) => dynamodb.getPermissions('dynamodb:GetItem', state)],
  ['arn:aws:states:::dynamodb:deleteItem', (state) => dynamodb.getPermissions('dynamodb:DeleteItem', state)],
  ['arn:aws:states:::aws-sdk:dynamodb:updateTable', (state) => dynamodb.getPermissions('dynamodb:UpdateTable', state)],
  ['arn:aws:states:::aws-sdk:dynamodb:query', (state) => dynamodb.getPermissions('dynamodb:Query', state)],
  ['arn:aws:states:::aws-sdk:dynamodb:scan', (state) => dynamodb.getPermissions('dynamodb:Scan', state)],

  // DynamoDB — batch operations
  ['arn:aws:states:::aws-sdk:dynamodb:batchGetItem', (state) => dynamodb.getBatchPermissions('dynamodb:BatchGetItem', state)],
  ['arn:aws:states:::aws-sdk:dynamodb:batchWriteItem', (state) => dynamodb.getBatchPermissions('dynamodb:BatchWriteItem', state)],

  // Redshift Data
  ['arn:aws:states:::aws-sdk:redshiftdata:executeStatement', (state) => redshiftData.getPermissions('redshift-data:ExecuteStatement', state)],
  ['arn:aws:states:::aws-sdk:redshiftdata:batchExecuteStatement', (state) => redshiftData.getPermissions('redshift-data:BatchExecuteStatement', state)],
  ['arn:aws:states:::aws-sdk:redshiftdata:listStatements', (state) => redshiftData.getPermissions('redshift-data:ListStatements', state)],
  ['arn:aws:states:::aws-sdk:redshiftdata:describeStatement', (state) => redshiftData.getPermissions('redshift-data:DescribeStatement', state)],
  ['arn:aws:states:::aws-sdk:redshiftdata:getStatementResult', (state) => redshiftData.getPermissions('redshift-data:GetStatementResult', state)],
  ['arn:aws:states:::aws-sdk:redshiftdata:cancelStatement', (state) => redshiftData.getPermissions('redshift-data:CancelStatement', state)],

  // Batch
  ['arn:aws:states:::batch:submitJob', batch.getPermissions],
  ['arn:aws:states:::batch:submitJob.sync', batch.getPermissions],

  // Glue
  ['arn:aws:states:::glue:startJobRun', glue.getPermissions],
  ['arn:aws:states:::glue:startJobRun.sync', glue.getPermissions],

  // ECS
  ['arn:aws:states:::ecs:runTask', ecs.getPermissions],
  ['arn:aws:states:::ecs:runTask.sync', ecs.getPermissions],
  ['arn:aws:states:::ecs:runTask.waitForTaskToken', ecs.getPermissions],

  // Lambda
  ['arn:aws:states:::lambda:invoke', lambda.getPermissions],
  ['arn:aws:states:::lambda:invoke.waitForTaskToken', lambda.getPermissions],

  // Step Functions
  ['arn:aws:states:::states:startExecution', stepFunctions.getStartExecutionPermissions],
  ['arn:aws:states:::states:startExecution.sync', stepFunctions.getStartExecutionPermissions],
  ['arn:aws:states:::states:startExecution.sync:2', stepFunctions.getStartExecutionPermissions],
  ['arn:aws:states:::states:startExecution.waitForTaskToken', stepFunctions.getStartExecutionPermissions],
  ['arn:aws:states:::aws-sdk:sfn:startSyncExecution', stepFunctions.getSDKPermissions],

  // CodeBuild
  ['arn:aws:states:::codebuild:startBuild', codebuild.getPermissions],
  ['arn:aws:states:::codebuild:startBuild.sync', codebuild.getPermissions],

  // EMR
  ['arn:aws:states:::elasticmapreduce:createCluster', emr.getCreateClusterPermissions],
  ['arn:aws:states:::elasticmapreduce:createCluster.sync', () => emr.getCreateClusterPermissions({ sync: true })],
  ['arn:aws:states:::elasticmapreduce:runJobFlow', emr.getCreateClusterPermissions],
  ['arn:aws:states:::elasticmapreduce:terminateCluster', emr.getTerminateClusterPermissions],
  ['arn:aws:states:::elasticmapreduce:terminateCluster.sync', emr.getTerminateClusterPermissions],
  ['arn:aws:states:::elasticmapreduce:addStep', emr.getAddStepPermissions],
  ['arn:aws:states:::elasticmapreduce:addStep.sync', emr.getAddStepPermissions],
  ['arn:aws:states:::elasticmapreduce:cancelStep', emr.getCancelStepPermissions],
  ['arn:aws:states:::elasticmapreduce:setClusterTerminationProtection', emr.getSetTerminationProtectionPermissions],
  ['arn:aws:states:::elasticmapreduce:modifyInstanceFleetByName', emr.getModifyInstanceFleetPermissions],
  ['arn:aws:states:::elasticmapreduce:modifyInstanceGroupByName', emr.getModifyInstanceGroupPermissions],

  // SageMaker
  ['arn:aws:states:::sagemaker:createTransformJob.sync', sagemaker.getPermissions],

  // Bedrock
  ['arn:aws:states:::bedrock:invokeModel', bedrock.getPermissions],

  // EventBridge
  ['arn:aws:states:::events:putEvents', eventbridge.getPermissions],
  ['arn:aws:states:::events:putEvents.waitForTaskToken', eventbridge.getPermissions],
  ['arn:aws:states:::aws-sdk:eventbridge:putTargets', eventbridge.getPutTargetsPermissions],
  ['arn:aws:states:::aws-sdk:eventbridge:putTargets.waitForTaskToken', eventbridge.getPutTargetsPermissions],

  // EventBridge Scheduler
  ['arn:aws:states:::aws-sdk:scheduler:createSchedule', (state) => eventbridge.getSchedulerPermissions('scheduler:CreateSchedule', state)],
  ['arn:aws:states:::aws-sdk:scheduler:deleteSchedule', (state) => eventbridge.getSchedulerPermissions('scheduler:DeleteSchedule', state)],

  // HTTP Invoke
  ['arn:aws:states:::http:invoke', http.getPermissions],

  // S3
  ['arn:aws:states:::s3:getObject', (state) => s3.getPermissions('s3:GetObject', state)],
  ['arn:aws:states:::aws-sdk:s3:getObject', (state) => s3.getPermissions('s3:GetObject', state)],
  ['arn:aws:states:::s3:putObject', (state) => s3.getPermissions('s3:PutObject', state)],
  ['arn:aws:states:::aws-sdk:s3:putObject', (state) => s3.getPermissions('s3:PutObject', state)],
  ['arn:aws:states:::s3:listObjectsV2', (state) => s3.getPermissions('s3:listObjectsV2', state)],
  ['arn:aws:states:::aws-sdk:s3:listObjectsV2', (state) => s3.getPermissions('s3:listObjectsV2', state)],

  // SES
  ['arn:aws:states:::aws-sdk:sesv2:sendEmail', ses.getPermissions],

  // Athena
  ['arn:aws:states:::athena:startQueryExecution', (state) => athena.getStartQueryPermissions({ state })],
  ['arn:aws:states:::athena:startQueryExecution.sync', (state) => athena.getStartQueryPermissions({ sync: true, state })],
  ['arn:aws:states:::athena:stopQueryExecution', athena.getStopQueryPermissions],
  ['arn:aws:states:::athena:getQueryExecution', athena.getGetQueryExecutionPermissions],
  ['arn:aws:states:::athena:getQueryResults', athena.getGetQueryResultsPermissions],
]);

function normalizeArn(resource) {
  if (typeof resource !== 'string') return resource;
  return resource.replace(/^arn:(aws(-[a-z]+)*|\$\{AWS::Partition\}):/, 'arn:aws:');
}

function getPermissions(state, context) {
  const normalizedArn = normalizeArn(state.Resource);
  const handler = registry.get(normalizedArn);
  if (handler) {
    return handler(state, context);
  }
  return lambda.getFallbackPermissions(state, context);
}

module.exports = { getPermissions };
