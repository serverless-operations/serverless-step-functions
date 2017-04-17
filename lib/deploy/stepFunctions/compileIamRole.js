'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');
const path = require('path');

module.exports = {
  compileIamRole() {
    const customRolesProvided = [];
    this.getAllStateMachines().forEach((stateMachineName) => {
      const stateMachineObj = this.getStateMachine(stateMachineName);
      customRolesProvided.push('role' in stateMachineObj);
    });
    if (_.isEqual(_.uniq(customRolesProvided), [true])) {
      return BbPromise.resolve();
    }

    let iamRoleStateMachineExecutionTemplate = JSON.stringify(this.serverless.utils.readFileSync(
      path.join(__dirname,
        '..',
        '..',
        'iam-role-statemachine-execution-template.json'))
    );
    iamRoleStateMachineExecutionTemplate =
      iamRoleStateMachineExecutionTemplate.replace('[region]', this.region)
      .replace('[PolicyName]', this.getStateMachinePolicyName());

    const iamRoleStateMachineLogicalId = this.getiamRoleStateMachineLogicalId();
    const newIamRoleStateMachineExecutionObject = {
      [iamRoleStateMachineLogicalId]: JSON.parse(iamRoleStateMachineExecutionTemplate),
    };

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newIamRoleStateMachineExecutionObject);
    return BbPromise.resolve();
  },
};
