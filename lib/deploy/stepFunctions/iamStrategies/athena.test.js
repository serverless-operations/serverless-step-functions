'use strict';

const assert = require('node:assert/strict');
const {
  getStartQueryPermissions,
  getStopQueryPermissions,
  getGetQueryExecutionPermissions,
  getGetQueryResultsPermissions,
} = require('./athena');

const arnSubString = (resource) => {
  const sub = resource && resource['Fn::Sub'];
  if (!sub) return null;
  return Array.isArray(sub) ? sub[0] : sub;
};

const findStmt = (results, predicate) => results.find(predicate);

describe('athena strategy', () => {
  describe('getStartQueryPermissions (startQueryExecution / .sync)', () => {
    describe('athena action set', () => {
      it('grants only startQueryExecution and getDataCatalog for the request-response variant', () => {
        const results = getStartQueryPermissions();
        const athenaStmt = findStmt(results, (p) => /athena:/.test(p.action));
        assert.match(athenaStmt.action, /athena:startQueryExecution/);
        assert.match(athenaStmt.action, /athena:getDataCatalog/);
        assert.doesNotMatch(athenaStmt.action, /athena:stopQueryExecution/);
        assert.doesNotMatch(athenaStmt.action, /athena:getQueryExecution/);
      });

      it('grants the full Run-a-Job (.sync) action set including polling/batch/list', () => {
        const results = getStartQueryPermissions({ sync: true });
        const athenaStmt = findStmt(results, (p) => /athena:/.test(p.action));
        for (const action of [
          'athena:startQueryExecution',
          'athena:stopQueryExecution',
          'athena:getQueryExecution',
          'athena:getDataCatalog',
          'athena:GetWorkGroup',
          'athena:BatchGetQueryExecution',
          'athena:GetQueryResults',
          'athena:ListQueryExecutions',
        ]) {
          assert.ok(athenaStmt.action.includes(action), `missing ${action}`);
        }
      });

      it('does not grant events:* — Athena .sync uses polling, not the EventBridge rule pattern', () => {
        const results = getStartQueryPermissions({ sync: true });
        assert.equal(findStmt(results, (p) => /events:/.test(p.action)), undefined);
      });
    });

    describe('athena resource scoping', () => {
      it('scopes the resource to a specific workgroup ARN when WorkGroup is a static string', () => {
        const state = { Parameters: { WorkGroup: 'analytics' } };
        const results = getStartQueryPermissions({ state });
        const athenaStmt = findStmt(results, (p) => /athena:/.test(p.action));
        const arns = athenaStmt.resource.map(arnSubString);
        assert.ok(arns.some((a) => /:workgroup\/analytics$/.test(a)), 'expected workgroup/analytics');
        assert.ok(arns.some((a) => /:datacatalog\/\*$/.test(a)), 'expected datacatalog/*');
      });

      it('falls back to workgroup/* when WorkGroup is a runtime path', () => {
        const state = { Parameters: { 'WorkGroup.$': '$.workgroup' } };
        const results = getStartQueryPermissions({ state });
        const athenaStmt = findStmt(results, (p) => /athena:/.test(p.action));
        const arns = athenaStmt.resource.map(arnSubString);
        assert.ok(arns.some((a) => /:workgroup\/\*$/.test(a)));
      });

      it('falls back to workgroup/* when WorkGroup is missing', () => {
        const results = getStartQueryPermissions();
        const athenaStmt = findStmt(results, (p) => /athena:/.test(p.action));
        const arns = athenaStmt.resource.map(arnSubString);
        assert.ok(arns.some((a) => /:workgroup\/\*$/.test(a)));
      });
    });

    describe('S3 permissions (Athena reads/writes data via the caller identity)', () => {
      it('grants the full S3 action set on arn:aws:s3:::*', () => {
        const results = getStartQueryPermissions();
        const s3Stmt = findStmt(results, (p) => /^s3:/.test(p.action));
        assert.ok(s3Stmt, 's3 statement missing');
        for (const action of [
          's3:GetBucketLocation', 's3:GetObject', 's3:ListBucket',
          's3:ListBucketMultipartUploads', 's3:ListMultipartUploadParts',
          's3:AbortMultipartUpload', 's3:CreateBucket', 's3:PutObject',
        ]) {
          assert.ok(s3Stmt.action.includes(action), `missing ${action}`);
        }
        assert.equal(s3Stmt.resource, 'arn:aws:s3:::*');
      });
    });

    describe('Glue catalog permissions (Athena uses the caller identity for catalog access)', () => {
      it('grants the full Glue action set on catalog/database/table/userDefinedFunction', () => {
        const results = getStartQueryPermissions();
        const glueStmt = findStmt(results, (p) => /^glue:/.test(p.action));
        assert.ok(glueStmt, 'glue statement missing');
        for (const action of [
          'glue:GetDatabase', 'glue:GetDatabases', 'glue:GetTable', 'glue:GetTables',
          'glue:GetPartition', 'glue:GetPartitions', 'glue:BatchGetPartition',
          'glue:CreateTable', 'glue:UpdateTable', 'glue:DeleteTable',
          'glue:CreateDatabase', 'glue:UpdateDatabase', 'glue:DeleteDatabase',
        ]) {
          assert.ok(glueStmt.action.includes(action), `missing ${action}`);
        }
        const arns = glueStmt.resource.map(arnSubString);
        assert.ok(arns.some((a) => /:catalog$/.test(a)));
        assert.ok(arns.some((a) => /:database\/\*$/.test(a)));
        assert.ok(arns.some((a) => /:table\/\*$/.test(a)));
        assert.ok(arns.some((a) => /:userDefinedFunction\/\*$/.test(a)));
      });
    });

    describe('Lake Formation permission', () => {
      it('grants lakeformation:GetDataAccess on *', () => {
        const results = getStartQueryPermissions();
        const lfStmt = findStmt(results, (p) => /^lakeformation:/.test(p.action));
        assert.ok(lfStmt, 'lake formation statement missing');
        assert.equal(lfStmt.action, 'lakeformation:GetDataAccess');
        assert.equal(lfStmt.resource, '*');
      });
    });
  });

  describe('getStopQueryPermissions (stopQueryExecution)', () => {
    it('grants athena:stopQueryExecution on workgroup/*', () => {
      const results = getStopQueryPermissions();
      assert.equal(results.length, 1);
      assert.equal(results[0].action, 'athena:stopQueryExecution');
      assert.match(arnSubString(results[0].resource), /:workgroup\/\*$/);
    });
  });

  describe('getGetQueryExecutionPermissions (getQueryExecution)', () => {
    it('grants athena:getQueryExecution on workgroup/*', () => {
      const results = getGetQueryExecutionPermissions();
      assert.equal(results.length, 1);
      assert.equal(results[0].action, 'athena:getQueryExecution');
      assert.match(arnSubString(results[0].resource), /:workgroup\/\*$/);
    });
  });

  describe('getGetQueryResultsPermissions (getQueryResults)', () => {
    it('grants athena:getQueryResults on workgroup/* and s3:GetObject on the result location', () => {
      const results = getGetQueryResultsPermissions();
      assert.equal(results.length, 2);
      const athena = findStmt(results, (p) => /^athena:/.test(p.action));
      assert.equal(athena.action, 'athena:getQueryResults');
      assert.match(arnSubString(athena.resource), /:workgroup\/\*$/);
      const s3 = findStmt(results, (p) => /^s3:/.test(p.action));
      assert.equal(s3.action, 's3:GetObject');
      assert.equal(s3.resource, 'arn:aws:s3:::*');
    });
  });
});
