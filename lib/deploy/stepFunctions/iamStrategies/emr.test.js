'use strict';

const expect = require('chai').expect;
const {
  getCreateClusterPermissions,
  getTerminateClusterPermissions,
  getAddStepPermissions,
  getCancelStepPermissions,
  getSetTerminationProtectionPermissions,
  getModifyInstanceFleetPermissions,
  getModifyInstanceGroupPermissions,
} = require('./emr');

describe('emr strategy', () => {
  describe('getCreateClusterPermissions (createCluster / createCluster.sync / runJobFlow)', () => {
    it('should give elasticmapreduce:RunJobFlow on *', () => {
      const results = getCreateClusterPermissions();
      const perm = results.find((p) => p.action.includes('elasticmapreduce:RunJobFlow'));
      expect(perm).to.not.equal(undefined);
      expect(perm.resource).to.equal('*');
    });

    it('should give iam:PassRole on *', () => {
      const results = getCreateClusterPermissions();
      const perm = results.find((p) => p.action.includes('iam:PassRole'));
      expect(perm).to.not.equal(undefined);
      expect(perm.resource).to.equal('*');
    });

    it('should give elasticmapreduce:DescribeCluster and elasticmapreduce:TerminateJobFlows for sync variant', () => {
      const results = getCreateClusterPermissions({ sync: true });
      const perm = results.find((p) => p.action.includes('elasticmapreduce:RunJobFlow'));
      expect(perm.action).to.include('elasticmapreduce:DescribeCluster');
      expect(perm.action).to.include('elasticmapreduce:TerminateJobFlows');
    });

    it('should not include DescribeCluster and TerminateJobFlows for non-sync variant', () => {
      const results = getCreateClusterPermissions();
      const perm = results.find((p) => p.action.includes('elasticmapreduce:RunJobFlow'));
      expect(perm.action).to.not.include('elasticmapreduce:DescribeCluster');
      expect(perm.action).to.not.include('elasticmapreduce:TerminateJobFlows');
    });
  });

  describe('getTerminateClusterPermissions (terminateCluster)', () => {
    it('should give elasticmapreduce:TerminateJobFlows and DescribeCluster on *', () => {
      const results = getTerminateClusterPermissions();
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.include('elasticmapreduce:TerminateJobFlows');
      expect(result.action).to.include('elasticmapreduce:DescribeCluster');
      expect(result.resource).to.equal('*');
    });
  });

  describe('getAddStepPermissions (addStep / addStep.sync)', () => {
    it('should give elasticmapreduce:AddJobFlowSteps, DescribeStep and CancelSteps on *', () => {
      const results = getAddStepPermissions();
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.include('elasticmapreduce:AddJobFlowSteps');
      expect(result.action).to.include('elasticmapreduce:DescribeStep');
      expect(result.action).to.include('elasticmapreduce:CancelSteps');
      expect(result.resource).to.equal('*');
    });
  });

  describe('getCancelStepPermissions (cancelStep)', () => {
    it('should give elasticmapreduce:CancelSteps on *', () => {
      const results = getCancelStepPermissions();
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.include('elasticmapreduce:CancelSteps');
      expect(result.resource).to.equal('*');
    });
  });

  describe('getSetTerminationProtectionPermissions (setClusterTerminationProtection)', () => {
    it('should give elasticmapreduce:SetTerminationProtection on *', () => {
      const results = getSetTerminationProtectionPermissions();
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.include('elasticmapreduce:SetTerminationProtection');
      expect(result.resource).to.equal('*');
    });
  });

  describe('getModifyInstanceFleetPermissions (modifyInstanceFleetByName)', () => {
    it('should give elasticmapreduce:ModifyInstanceFleet and ListInstanceFleets on *', () => {
      const results = getModifyInstanceFleetPermissions();
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.include('elasticmapreduce:ModifyInstanceFleet');
      expect(result.action).to.include('elasticmapreduce:ListInstanceFleets');
      expect(result.resource).to.equal('*');
    });
  });

  describe('getModifyInstanceGroupPermissions (modifyInstanceGroupByName)', () => {
    it('should give elasticmapreduce:ModifyInstanceGroups and ListInstanceGroups on *', () => {
      const results = getModifyInstanceGroupPermissions();
      const result = results[0];
      expect(results).to.have.lengthOf(1);
      expect(result.action).to.include('elasticmapreduce:ModifyInstanceGroups');
      expect(result.action).to.include('elasticmapreduce:ListInstanceGroups');
      expect(result.resource).to.equal('*');
    });
  });
});
