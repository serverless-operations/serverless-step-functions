'use strict';

const _ = require('lodash');

function getPermissions(action, state) {
  const permissions = [];

  if (['redshift-data:ExecuteStatement', 'redshift-data:BatchExecuteStatement'].includes(action)) {
    const dbName = _.has(state, ['Parameters', 'Database']) ? state.Parameters.Database : '*';

    let workgroupArn;
    let clusterName;
    if (_.has(state, ['Parameters', 'WorkgroupName'])) {
      if (state.Parameters.WorkgroupName.startsWith('arn:')) {
        workgroupArn = state.Parameters.WorkgroupName;
      } else {
        workgroupArn = { 'Fn::Sub': 'arn:${AWS::Partition}:redshift-serverless:${AWS::Region}:${AWS::AccountId}:workgroup/*' };
      }
    } else if (_.has(state, ['Parameters', 'WorkgroupName.$'])) {
      workgroupArn = { 'Fn::Sub': 'arn:${AWS::Partition}:redshift-serverless:${AWS::Region}:${AWS::AccountId}:workgroup/*' };
    } else if (_.has(state, ['Parameters', 'ClusterIdentifier'])) {
      clusterName = state.Parameters.ClusterIdentifier;
    } else {
      clusterName = '*';
    }

    let secretArn;
    let dbUser;
    if (_.has(state, ['Parameters', 'SecretArn'])) {
      if (state.Parameters.SecretArn.startsWith('arn:')) {
        secretArn = state.Parameters.SecretArn;
      } else {
        secretArn = { 'Fn::Sub': `arn:\${AWS::Partition}:secretsmanager:\${AWS::Region}:\${AWS::AccountId}:secret:${state.Parameters.SecretArn}*` };
      }
    } else if (_.has(state, ['Parameters', 'SecretArn.$'])) {
      secretArn = { 'Fn::Sub': 'arn:${AWS::Partition}:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:*' };
    } else if (_.has(state, ['Parameters', 'DbUser'])) {
      dbUser = state.Parameters.DbUser;
    } else if (_.has(state, ['Parameters', 'DbUser.$'])) {
      dbUser = '*';
    }

    permissions.push({
      action,
      resource: workgroupArn || { 'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:cluster:${clusterName}` },
    });

    if (secretArn) {
      permissions.push({
        action: 'secretsmanager:GetSecretValue',
        resource: secretArn,
      });
    } else if (dbUser) {
      permissions.push({
        action: 'redshift:GetClusterCredentials',
        resource: [
          { 'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:dbuser:${clusterName}/${dbUser}` },
          { 'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:dbname:${clusterName}/${dbName}` },
        ],
      });
    } else {
      if (workgroupArn) { // eslint-disable-line no-lonely-if
        permissions.push({
          action: 'redshift-serverless:GetCredentials',
          resource: workgroupArn,
        });
      } else {
        permissions.push({
          action: 'redshift:GetClusterCredentialsWithIAM',
          resource: { 'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:dbname:${clusterName}/${dbName}` },
        });
      }
    }
  } else {
    permissions.push({ action, resource: '*' });
  }

  return permissions;
}

module.exports = { getPermissions };
