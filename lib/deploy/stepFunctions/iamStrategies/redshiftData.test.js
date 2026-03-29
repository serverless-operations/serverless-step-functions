'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./redshiftData');

describe('redshiftData strategy', () => {
  it('should give permissions to * for safe actions', () => {
    const safeActions = [
      'redshift-data:ListStatements',
      'redshift-data:DescribeStatement',
      'redshift-data:GetStatementResult',
      'redshift-data:CancelStatement',
    ];
    safeActions.forEach((action) => {
      const state = { Type: 'Task', Resource: 'arn:...' };
      const result = getPermissions(action, state);
      expect(result).to.deep.equal([{ action, resource: '*' }]);
    });
  });

  it('should give permissions for executeStatement on a workgroup given its ARN', () => {
    const workgroupArn = 'arn:aws:redshift-serverless:us-east-1:012345678901:workgroup/01234567-89ab-cdef-0123-456789abcdef';
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        WorkgroupName: workgroupArn,
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[0]).to.deep.equal({ action: 'redshift-data:ExecuteStatement', resource: workgroupArn });
  });

  it('should give permissions to wildcard workgroup when WorkgroupName is a non-ARN name', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        WorkgroupName: 'myWorkgroup',
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[0].resource).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:redshift-serverless:${AWS::Region}:${AWS::AccountId}:workgroup/*',
    });
  });

  it('should give permissions to wildcard workgroup when WorkgroupName.$ is used', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        'WorkgroupName.$': '$',
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[0].resource).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:redshift-serverless:${AWS::Region}:${AWS::AccountId}:workgroup/*',
    });
  });

  it('should give permissions on specific cluster given ClusterIdentifier', () => {
    const clusterIdentifier = 'myCluster';
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        ClusterIdentifier: clusterIdentifier,
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[0].resource).to.deep.equal({
      'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:cluster:${clusterIdentifier}`,
    });
  });

  it('should give permissions to * cluster when ClusterIdentifier.$ is used', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        'ClusterIdentifier.$': '$',
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[0].resource).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:redshift:${AWS::Region}:${AWS::AccountId}:cluster:*',
    });
  });

  it('should add secretsmanager:GetSecretValue permission for SecretArn (full ARN)', () => {
    const secretArn = 'arn:aws:secretsmanager:us-east-1:012345678901:secret:mySecret-ABab01';
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        SecretArn: secretArn,
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[1]).to.deep.equal({
      action: 'secretsmanager:GetSecretValue',
      resource: secretArn,
    });
  });

  it('should add wildcard secretsmanager permission for non-ARN SecretArn', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        SecretArn: 'mySecret',
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[1].resource).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:mySecret*',
    });
  });

  it('should add wildcard secretsmanager permission when SecretArn.$ is used', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        'SecretArn.$': '$',
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[1].resource).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:*',
    });
  });

  it('should add redshift:GetClusterCredentials permission for DbUser', () => {
    const dbUser = 'myUser';
    const clusterIdentifier = 'myCluster';
    const database = 'myDatabase';
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        DbUser: dbUser,
        ClusterIdentifier: clusterIdentifier,
        Database: database,
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[1]).to.deep.equal({
      action: 'redshift:GetClusterCredentials',
      resource: [
        { 'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:dbuser:${clusterIdentifier}/${dbUser}` },
        { 'Fn::Sub': `arn:\${AWS::Partition}:redshift:\${AWS::Region}:\${AWS::AccountId}:dbname:${clusterIdentifier}/${database}` },
      ],
    });
  });

  it('should add wildcard GetClusterCredentials permission when DbUser.$ is used', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        'DbUser.$': '$',
        'ClusterIdentifier.$': '$',
        'Database.$': '$',
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    expect(result[1]).to.deep.equal({
      action: 'redshift:GetClusterCredentials',
      resource: [
        { 'Fn::Sub': 'arn:${AWS::Partition}:redshift:${AWS::Region}:${AWS::AccountId}:dbuser:*/*' },
        { 'Fn::Sub': 'arn:${AWS::Partition}:redshift:${AWS::Region}:${AWS::AccountId}:dbname:*/*' },
      ],
    });
  });

  it('should add redshift-serverless:GetCredentials permission when using WorkgroupName (no secret/dbuser)', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        'WorkgroupName.$': '$',
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    const credsPerm = result.find((p) => p.action === 'redshift-serverless:GetCredentials');
    expect(credsPerm).to.not.equal(undefined);
    expect(credsPerm.resource).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:redshift-serverless:${AWS::Region}:${AWS::AccountId}:workgroup/*',
    });
  });

  it('should add redshift:GetClusterCredentialsWithIAM permission when using cluster (no secret/dbuser)', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:...',
      Parameters: {
        'ClusterIdentifier.$': '$',
        'Database.$': '$',
      },
    };
    const result = getPermissions('redshift-data:ExecuteStatement', state);
    const credsPerm = result.find((p) => p.action === 'redshift:GetClusterCredentialsWithIAM');
    expect(credsPerm).to.not.equal(undefined);
    expect(credsPerm.resource).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:redshift:${AWS::Region}:${AWS::AccountId}:dbname:*/*',
    });
  });
});
