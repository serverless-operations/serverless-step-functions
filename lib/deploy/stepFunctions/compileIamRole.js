'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');
const path = require('path');

function getTaskStates(states) {
  return _.flatMap(states, state => {
    switch (state.Type) {
      case 'Task': {
        return [state];
      }
      case 'Parallel': {
        const parallelStates = _.flatMap(state.Branches, branch => _.values(branch.States));
        return getTaskStates(parallelStates);
      }
      default: {
        return [];
      }
    }
  });
}

function sqsQueueUrlToArn(serverless, queueUrl) {
  const regex = /https:\/\/sqs.(.*).amazonaws.com\/(.*)\/(.*)/g;
  const match = regex.exec(queueUrl);
  if (match) {
    const region = match[1];
    const accountId = match[2];
    const queueName = match[3];
    return `arn:aws:sqs:${region}:${accountId}:${queueName}`;
  }
  serverless.cli.consoleLog(`Unable to parse SQS queue url [${queueUrl}]`);
  return [];
}

function getSqsPermissions(serverless, state) {
  if (_.has(state, 'Parameters.QueueUrl') ||
      _.has(state, ['Parameters', 'QueueUrl.$'])) {
    // if queue URL is provided by input, then need pervasive permissions (i.e. '*')
    const queueArn = state.Parameters['QueueUrl.$']
      ? '*'
      : sqsQueueUrlToArn(serverless, state.Parameters.QueueUrl);
    return [{ action: 'sqs:SendMessage', resource: queueArn }];
  }
  serverless.cli.consoleLog('SQS task missing Parameters.QueueUrl or Parameters.QueueUrl.$');
  return [];
}

function getSnsPermissions(serverless, state) {
  if (_.has(state, 'Parameters.TopicArn') ||
      _.has(state, ['Parameters', 'TopicArn.$'])) {
    // if topic ARN is provided by input, then need pervasive permissions
    const topicArn = state.Parameters['TopicArn.$'] ? '*' : state.Parameters.TopicArn;
    return [{ action: 'sns:Publish', resource: topicArn }];
  }
  serverless.cli.consoleLog('SNS task missing Parameters.TopicArn or Parameters.TopicArn.$');
  return [];
}

function getDynamoDBArn(tableName) {
  return {
    'Fn::Join': [
      ':',
      [
        'arn:aws:dynamodb',
        { Ref: 'AWS::Region' },
        { Ref: 'AWS::AccountId' },
        `table/${tableName}`,
      ],
    ],
  };
}

function getBatchPermissions() {
  return [{
    action: 'batch:SubmitJob,batch:DescribeJobs,batch:TerminateJob',
    resource: '*',
  }, {
    action: 'events:PutTargets,events:PutRule,events:DescribeRule',
    resource: {
      'Fn::Join': [
        ':',
        [
          'arn:aws:events',
          { Ref: 'AWS::Region' },
          { Ref: 'AWS::AccountId' },
          'rule/StepFunctionsGetEventsForBatchJobsRule',
        ],
      ],
    },
  }];
}

function getEcsPermissions() {
  return [{
    action: 'ecs:RunTask,ecs:StopTask,ecs:DescribeTasks',
    resource: '*',
  }, {
    action: 'events:PutTargets,events:PutRule,events:DescribeRule',
    resource: {
      'Fn::Join': [
        ':',
        [
          'arn:aws:events',
          { Ref: 'AWS::Region' },
          { Ref: 'AWS::AccountId' },
          'rule/StepFunctionsGetEventsForECSTaskRule',
        ],
      ],
    },
  }];
}

function getDynamoDBPermissions(action, state) {
  const tableArn = state.Parameters['TableName.$']
    ? '*'
    : getDynamoDBArn(state.Parameters.TableName);

  return [{
    action,
    resource: tableArn,
  }];
}

// if there are multiple permissions with the same action, then collapsed them into one
// permission instead, and collect the resources into an array
function consolidatePermissionsByAction(permissions) {
  return _.chain(permissions)
    .groupBy(perm => perm.action)
    .mapValues(perms => {
      // find the unique resources
      let resources = _.uniqWith(_.flatMap(perms, p => p.resource), _.isEqual);
      if (_.includes(resources, '*')) {
        resources = '*';
      }

      return {
        action: perms[0].action,
        resource: resources,
      };
    })
    .values()
    .value(); // unchain
}

function consolidatePermissionsByResource(permissions) {
  return _.chain(permissions)
          .groupBy(p => JSON.stringify(p.resource))
          .mapValues(perms => {
            // find unique actions
            const actions = _.uniq(_.flatMap(perms, p => p.action.split(',')));

            return {
              action: actions.join(','),
              resource: perms[0].resource,
            };
          })
          .values()
          .value(); // unchain
}

function getIamPermissions(serverless, taskStates) {
  return _.flatMap(taskStates, state => {
    switch (state.Resource) {
      case 'arn:aws:states:::sqs:sendMessage':
        return getSqsPermissions(serverless, state);

      case 'arn:aws:states:::sns:publish':
        return getSnsPermissions(serverless, state);

      case 'arn:aws:states:::dynamodb:updateItem':
        return getDynamoDBPermissions('dynamodb:UpdateItem', state);
      case 'arn:aws:states:::dynamodb:putItem':
        return getDynamoDBPermissions('dynamodb:PutItem', state);
      case 'arn:aws:states:::dynamodb:getItem':
        return getDynamoDBPermissions('dynamodb:GetItem', state);
      case 'arn:aws:states:::dynamodb:deleteItem':
        return getDynamoDBPermissions('dynamodb:DeleteItem', state);

      case 'arn:aws:states:::batch:submitJob.sync':
      case 'arn:aws:states:::batch:submitJob':
        return getBatchPermissions();

      case 'arn:aws:states:::ecs:runTask.sync':
      case 'arn:aws:states:::ecs:runTask':
        return getEcsPermissions();

      default:
        if (state.Resource.startsWith('arn:aws:lambda')) {
          return [{
            action: 'lambda:InvokeFunction',
            resource: state.Resource,
          }];
        }
        serverless.cli.consoleLog('Cannot generate IAM policy statement for Task state', state);
        return [];
    }
  });
}

function getIamStatements(iamPermissions) {
  // when the state machine doesn't define any Task states, and therefore doesn't need ANY
  // permission, then we should follow the behaviour of the AWS console and return a policy
  // that denies access to EVERYTHING
  if (_.isEmpty(iamPermissions)) {
    return [{
      Effect: 'Deny',
      Action: '*',
      Resource: '*',
    }];
  }

  return iamPermissions.map(p => ({
    Effect: 'Allow',
    Action: p.action.split(','),
    Resource: p.resource,
  }));
}

module.exports = {
  compileIamRole() {
    const customRolesProvided = [];
    let iamPermissions = [];
    this.getAllStateMachines().forEach((stateMachineName) => {
      const stateMachineObj = this.getStateMachine(stateMachineName);
      customRolesProvided.push('role' in stateMachineObj);

      const taskStates = getTaskStates(stateMachineObj.definition.States);
      iamPermissions = iamPermissions.concat(getIamPermissions(this.serverless, taskStates));
    });
    if (_.isEqual(_.uniq(customRolesProvided), [true])) {
      return BbPromise.resolve();
    }

    const iamRoleStateMachineExecutionTemplate = this.serverless.utils.readFileSync(
      path.join(__dirname,
        '..',
        '..',
        'iam-role-statemachine-execution-template.txt')
    );

    iamPermissions = consolidatePermissionsByAction(iamPermissions);
    iamPermissions = consolidatePermissionsByResource(iamPermissions);

    const iamStatements = getIamStatements(iamPermissions);

    const iamRoleJson =
      iamRoleStateMachineExecutionTemplate
        .replace('[region]', this.options.region)
        .replace('[PolicyName]', this.getStateMachinePolicyName())
        .replace('[Statements]', JSON.stringify(iamStatements));

    const iamRoleStateMachineLogicalId = this.getiamRoleStateMachineLogicalId();
    const newIamRoleStateMachineExecutionObject = {
      [iamRoleStateMachineLogicalId]: JSON.parse(iamRoleJson),
    };

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newIamRoleStateMachineExecutionObject);
    return BbPromise.resolve();
  },
};
