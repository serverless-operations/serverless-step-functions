'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileStateMachines() {
    this.getAllStateMachines().forEach((stateMachineName) => {
      const stateMachineObj = this.getStateMachine(stateMachineName);
      let DefinitionString;
      let RoleArn;
      let DependsOn;

      if (stateMachineObj.definition) {
        DefinitionString = JSON.stringify(JSON.stringify(stateMachineObj.definition))
          .replace(/\r?\n/g, '').replace('"', '\"'); // eslint-disable-line
      } else {
        const errorMessage = [
          `Missing "definition" property in stateMachine ${stateMachineName}`,
          ' Please check the README for more info.',
        ].join('');
        throw new this.serverless.classes
          .Error(errorMessage);
      }

      if (stateMachineObj.role) {
        if (typeof stateMachineObj.role === 'string') {
          if (stateMachineObj.role.startsWith('arn:aws')) {
            RoleArn = `"${stateMachineObj.role}"`;
          } else {
            const errorMessage = [
              `role property in stateMachine "${stateMachineName}" is not ARN`,
              ' Please check the README for more info.',
            ].join('');
            throw new this.serverless.classes
            .Error(errorMessage);
          }
        } else {
          const errorMessage = [
            `role property in stateMachine "${stateMachineName}" is not an string`,
            ' Please check the README for more info.',
          ].join('');
          throw new this.serverless.classes
          .Error(errorMessage);
        }
      } else {
        RoleArn = '{ "Fn::GetAtt": ["IamRoleStateMachineExecution", "Arn"] }';
        DependsOn = 'IamRoleStateMachineExecution';
      }

      const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName);

      const stateMachineTemplate = `
        {
          "Type": "AWS::StepFunctions::StateMachine",
          "Properties": {
            "DefinitionString": ${DefinitionString},
            "RoleArn": ${RoleArn}
          }
          ${DependsOn ? `,"DependsOn": "${DependsOn.replace(/\r?\n/g, '')}"` : ''}
        }
      `;
console.log(stateMachineTemplate)
      const newStateMachineObject = {
        [stateMachineLogicalId]: JSON.parse(stateMachineTemplate),
      };

      _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
        newStateMachineObject);
      return BbPromise.resolve();
    });
  },
};
