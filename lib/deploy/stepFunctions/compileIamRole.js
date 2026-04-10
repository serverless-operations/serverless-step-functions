'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const path = require('node:path');
const logger = require('../../utils/logger');
const { getPermissions } = require('./iamStrategies');

function getTaskStates(states, stateMachineName) {
  return _.flatMap(states, (state) => {
    switch (state.Type) {
      case 'Task': {
        return [state];
      }
      case 'Parallel': {
        const parallelStates = _.flatMap(state.Branches, (branch) => _.values(branch.States));
        return getTaskStates(parallelStates, stateMachineName);
      }
      case 'Map': {
        const mapStates = state.ItemProcessor ? state.ItemProcessor.States : state.Iterator.States;
        const taskStates = getTaskStates(mapStates, stateMachineName);
        if (state.ItemProcessor && state.ItemProcessor.ProcessorConfig
          && state.ItemProcessor.ProcessorConfig.Mode === 'DISTRIBUTED') {
          taskStates.push({
            Resource: 'arn:aws:states:::states:startExecution',
            Mode: 'DISTRIBUTED',
            StateMachineName: stateMachineName,
          });
        }
        if (state.ItemReader) {
          taskStates.push(state.ItemReader);
        }
        if (state.ResultWriter) {
          taskStates.push(state.ResultWriter);
        }
        return taskStates;
      }
      default: {
        return [];
      }
    }
  });
}

function consolidatePermissionsByAction(permissions) {
  return _.chain(permissions)
    .groupBy((perm) => perm.action)
    .mapValues((perms) => {
      let resources = _.uniqWith(_.flatMap(perms, (p) => p.resource), _.isEqual);
      if (_.includes(resources, '*')) {
        resources = '*';
      }

      return {
        action: perms[0].action,
        resource: resources,
      };
    })
    .values()
    .value();
}

function consolidatePermissionsByResource(permissions) {
  return _.chain(permissions)
    .groupBy((p) => JSON.stringify(p.resource))
    .mapValues((perms) => {
      const actions = _.uniq(_.flatMap(perms, (p) => p.action.split(',')));

      return {
        action: actions.join(','),
        resource: perms[0].resource,
      };
    })
    .values()
    .value();
}

function getIamStatements(iamPermissions, stateMachineObj) {
  if (_.isEmpty(iamPermissions) && _.isEmpty(stateMachineObj.iamRoleStatements)) {
    return [{
      Effect: 'Deny',
      Action: '*',
      Resource: '*',
    }];
  }

  const iamStatements = iamPermissions.map((p) => ({
    Effect: 'Allow',
    Action: p.action.split(','),
    Resource: p.resource,
  }));

  if (!_.isEmpty(stateMachineObj.iamRoleStatements)) {
    iamStatements.push(...stateMachineObj.iamRoleStatements);
  }

  return iamStatements;
}

module.exports = {
  compileIamRole() {
    logger.config(this.serverless, this.v3Api);
    const service = this.serverless.service;
    const permissionsBoundary = service.provider.rolePermissionsBoundary;
    const context = { serverless: this.serverless, plugin: this };

    this.getAllStateMachines().forEach((stateMachineId) => {
      const stateMachineObj = this.getStateMachine(stateMachineId);
      const stateMachineName = stateMachineObj.name || stateMachineId;
      if (stateMachineObj.role) {
        return;
      }

      if (!stateMachineObj.definition) {
        throw new Error(`Missing "definition" for state machine ${stateMachineId}`);
      }

      const taskStates = getTaskStates(stateMachineObj.definition.States, stateMachineName);
      let iamPermissions = _.flatMap(taskStates, (state) => getPermissions(state, context));

      if (stateMachineObj.loggingConfig) {
        iamPermissions.push({
          action: 'logs:CreateLogDelivery,logs:GetLogDelivery,logs:UpdateLogDelivery,'
            + 'logs:DeleteLogDelivery,logs:ListLogDeliveries,logs:PutResourcePolicy,'
            + 'logs:DescribeResourcePolicies,logs:DescribeLogGroups',
          resource: '*',
        });
      }

      if (stateMachineObj.tracingConfig) {
        iamPermissions.push({
          action: 'xray:PutTraceSegments,xray:PutTelemetryRecords,'
            + 'xray:GetSamplingRules,xray:GetSamplingTargets',
          resource: '*',
        });
      }

      if (stateMachineObj.kmsKeyArns && stateMachineObj.kmsKeyArns.length > 0) {
        iamPermissions.push({
          action: 'kms:Decrypt,kms:Encrypt,kms:ReEncrypt*,kms:GenerateDataKey*,kms:DescribeKey',
          resource: stateMachineObj.kmsKeyArns,
        });
      }

      if (stateMachineObj.encryptionConfig && stateMachineObj.encryptionConfig.KmsKeyId) {
        iamPermissions.push({
          action: 'kms:Decrypt,kms:Encrypt',
          resource: { 'Fn::Sub': stateMachineObj.encryptionConfig.KmsKeyId },
        });
      }

      iamPermissions = consolidatePermissionsByAction(iamPermissions);
      iamPermissions = consolidatePermissionsByResource(iamPermissions);
      const iamStatements = getIamStatements(iamPermissions, stateMachineObj);

      const iamRoleStateMachineExecutionTemplate = this.serverless.utils.readFileSync(
        path.join(
          __dirname,
          '..',
          '..',
          'iam-role-statemachine-execution-template.txt',
        ),
      );

      let iamRoleJson = iamRoleStateMachineExecutionTemplate
        .replace('[PolicyName]', this.getStateMachinePolicyName())
        .replace('[Statements]', JSON.stringify(iamStatements));

      if (permissionsBoundary) {
        const jsonIamRole = JSON.parse(iamRoleJson);
        jsonIamRole.Properties.PermissionsBoundary = permissionsBoundary;
        iamRoleJson = JSON.stringify(jsonIamRole);
      }

      const rolePath = _.get(service, 'provider.iam.role.path');
      if (rolePath) {
        const jsonIamRole = JSON.parse(iamRoleJson);
        jsonIamRole.Properties.Path = rolePath;
        iamRoleJson = JSON.stringify(jsonIamRole);
      }

      const stateMachineLogicalId = this.getStateMachineLogicalId(
        stateMachineId,
        stateMachineObj,
      );
      const iamRoleStateMachineLogicalId = `${stateMachineLogicalId}Role`;
      const newIamRoleStateMachineExecutionObject = {
        [iamRoleStateMachineLogicalId]: JSON.parse(iamRoleJson),
      };

      _.merge(
        this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
        newIamRoleStateMachineExecutionObject,
      );
    });

    return BbPromise.resolve();
  },
};
