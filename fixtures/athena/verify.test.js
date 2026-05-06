'use strict';

const fs = require('node:fs');
const path = require('node:path');
const expect = require('chai').expect;

const templatePath = path.join(__dirname, '.serverless', 'cloudformation-template-update-stack.json');

const collectActions = (role) => role.Properties.Policies[0].PolicyDocument.Statement
  .flatMap((s) => [].concat(s.Action));

const findStatementByAction = (role, actionName) => role.Properties.Policies[0]
  .PolicyDocument.Statement.find((s) => [].concat(s.Action).includes(actionName));

const arnSubStrings = (statement) => {
  const resources = [].concat(statement.Resource);
  return resources
    .map((r) => r && r['Fn::Sub'])
    .filter(Boolean)
    .map((sub) => (Array.isArray(sub) ? sub[0] : sub));
};

const workGroupArn = (statement) => arnSubStrings(statement).find((s) => s.includes(':workgroup/'));

describe('athena fixture — generated IAM role', () => {
  let resources;
  let syncRole;
  let asyncRole;
  let runtimeWgRole;

  before(() => {
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    resources = template.Resources;

    const roles = Object.values(resources).filter((r) => r.Type === 'AWS::IAM::Role');
    // The sync machine grants the full Run-a-Job action set including ListQueryExecutions.
    syncRole = roles.find((r) => collectActions(r).includes('athena:ListQueryExecutions'));
    const asyncRoles = roles.filter((r) => {
      const actions = collectActions(r);
      return actions.includes('athena:startQueryExecution')
        && !actions.includes('athena:ListQueryExecutions');
    });
    asyncRole = asyncRoles.find((r) => workGroupArn(
      findStatementByAction(r, 'athena:startQueryExecution'),
    ).endsWith(':workgroup/primary'));
    runtimeWgRole = asyncRoles.find((r) => workGroupArn(
      findStatementByAction(r, 'athena:startQueryExecution'),
    ).endsWith(':workgroup/*'));
  });

  it('creates an IAM role for each athena state machine', () => {
    expect(syncRole, 'sync machine role should exist').to.not.equal(undefined);
    expect(asyncRole, 'async-only static-WorkGroup role should exist').to.not.equal(undefined);
    expect(runtimeWgRole, 'runtime-WorkGroup role should exist').to.not.equal(undefined);
  });

  describe('sync machine (startQueryExecution.sync)', () => {
    it('grants the full Run-a-Job athena action set (matches AWS template)', () => {
      const stmt = findStatementByAction(syncRole, 'athena:startQueryExecution');
      const actions = [].concat(stmt.Action);
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
        expect(actions).to.include(action);
      }
    });

    it('scopes the athena resource to workgroup/<name> + datacatalog/* when WorkGroup is static', () => {
      const stmt = findStatementByAction(syncRole, 'athena:startQueryExecution');
      const arns = arnSubStrings(stmt);
      expect(arns.some((a) => /:workgroup\/primary$/.test(a))).to.equal(true);
      expect(arns.some((a) => /:datacatalog\/\*$/.test(a))).to.equal(true);
    });

    it('does not grant events:* (Athena .sync uses polling, not the EventBridge rule)', () => {
      const actions = collectActions(syncRole);
      expect(actions).to.not.include('events:PutTargets');
      expect(actions).to.not.include('events:PutRule');
      expect(actions).to.not.include('events:DescribeRule');
    });

    it('grants the documented S3 action set on arn:aws:s3:::*', () => {
      const stmt = findStatementByAction(syncRole, 's3:GetBucketLocation');
      const actions = [].concat(stmt.Action);
      for (const action of [
        's3:GetBucketLocation', 's3:GetObject', 's3:ListBucket', 's3:PutObject',
      ]) {
        expect(actions).to.include(action);
      }
      expect([].concat(stmt.Resource)).to.include('arn:aws:s3:::*');
    });

    it('grants the documented Glue action set on catalog/database/table/userDefinedFunction', () => {
      const stmt = findStatementByAction(syncRole, 'glue:GetDatabase');
      const arns = arnSubStrings(stmt);
      expect(arns.some((a) => /:catalog$/.test(a))).to.equal(true);
      expect(arns.some((a) => /:database\/\*$/.test(a))).to.equal(true);
      expect(arns.some((a) => /:table\/\*$/.test(a))).to.equal(true);
      expect(arns.some((a) => /:userDefinedFunction\/\*$/.test(a))).to.equal(true);
    });

    it('grants lakeformation:GetDataAccess on *', () => {
      const stmt = findStatementByAction(syncRole, 'lakeformation:GetDataAccess');
      expect(stmt).to.not.equal(undefined);
      expect([].concat(stmt.Resource)).to.include('*');
    });
  });

  describe('async-only machine with static WorkGroup (startQueryExecution request-response)', () => {
    it('grants only startQueryExecution and getDataCatalog (no polling/stop)', () => {
      const stmt = findStatementByAction(asyncRole, 'athena:startQueryExecution');
      const actions = [].concat(stmt.Action);
      expect(actions).to.include('athena:startQueryExecution');
      expect(actions).to.include('athena:getDataCatalog');
      expect(actions).to.not.include('athena:stopQueryExecution');
      expect(actions).to.not.include('athena:getQueryResults');
      expect(actions).to.not.include('athena:ListQueryExecutions');
    });

    it('still grants S3 + Glue + LakeFormation (Athena uses caller identity for data access)', () => {
      const actions = collectActions(asyncRole);
      expect(actions).to.include('s3:GetObject');
      expect(actions).to.include('glue:GetTable');
      expect(actions).to.include('lakeformation:GetDataAccess');
    });

    it('scopes the athena resource to workgroup/primary', () => {
      const stmt = findStatementByAction(asyncRole, 'athena:startQueryExecution');
      expect(workGroupArn(stmt)).to.match(/:workgroup\/primary$/);
    });
  });

  describe('runtime-WorkGroup machine (WorkGroup.$ path)', () => {
    it('falls back to workgroup/* when the WorkGroup is a runtime JSON path', () => {
      const stmt = findStatementByAction(runtimeWgRole, 'athena:startQueryExecution');
      expect(workGroupArn(stmt)).to.match(/:workgroup\/\*$/);
    });
  });
});
