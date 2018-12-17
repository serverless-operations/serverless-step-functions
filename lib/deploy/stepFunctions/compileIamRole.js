'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');
const path = require('path');

module.exports = {
  compileIamRole() {
    const customRolesProvided = [];
    let functionArns = [];
    this.getAllStateMachines().forEach((stateMachineName) => {
      const stateMachineObj = this.getStateMachine(stateMachineName);
      customRolesProvided.push('role' in stateMachineObj);

      const stateMachineJson = JSON.stringify(stateMachineObj);
      const regex = new RegExp(/"Resource":"([\w\-:*#{}.$]*)"/gi);
      let match = regex.exec(stateMachineJson);
      while (match !== null) {
        functionArns.push(match[1]);
        match = regex.exec(stateMachineJson);
      }
    });
    if (_.isEqual(_.uniq(customRolesProvided), [true])) {
      return BbPromise.resolve();
    }
    functionArns = _.uniq(functionArns);

    let iamRoleStateMachineExecutionTemplate = this.serverless.utils.readFileSync(
      path.join(__dirname,
        '..',
        '..',
        'iam-role-statemachine-execution-template.txt')
    );

    iamRoleStateMachineExecutionTemplate =
      iamRoleStateMachineExecutionTemplate
        .replace('[region]', this.options.region)
        .replace('[PolicyName]', this.getStateMachinePolicyName())
        .replace('[functions]', JSON.stringify(functionArns));

    const iamRoleStateMachineLogicalId = this.getiamRoleStateMachineLogicalId();
    const newIamRoleStateMachineExecutionObject = {
      [iamRoleStateMachineLogicalId]: JSON.parse(iamRoleStateMachineExecutionTemplate),
    };

    _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newIamRoleStateMachineExecutionObject);
    return BbPromise.resolve();
  },
};
