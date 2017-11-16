'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileStateMachines() {
    if (this.isStateMachines()) {
      this.getAllStateMachines().forEach((stateMachineName) => {
        const stateMachineObj = this.getStateMachine(stateMachineName);
        let DefinitionString;
        let RoleArn;
        let DependsOn;
        let Name;

        if (stateMachineObj.name) {
          Name = stateMachineObj.name;
        }

        if (stateMachineObj.definition) {
          DefinitionString = JSON.stringify(stateMachineObj.definition);
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

        const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName, Name);
        const stateMachineOutputLogicalId = this
                        .getStateMachineOutputLogicalId(stateMachineName, Name);

        const stateMachineTemplate = `
          {
            "Type": "AWS::StepFunctions::StateMachine",
            "Properties": {
              "DefinitionString": ${JSON.stringify(DefinitionString
                .replace(/\\n|\\r|\\n\\r/g, ''))},
              "RoleArn": ${RoleArn}
            }
            ${DependsOn ? `,"DependsOn": "${DependsOn}"` : ''}
          }
        `;

        const newStateMachineObject = {
          [stateMachineLogicalId]: JSON.parse(stateMachineTemplate),
        };

        if (Name) {
          newStateMachineObject[stateMachineLogicalId].Properties.StateMachineName = Name;
        }

        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
          newStateMachineObject);

        const stateMachineOutPutObject = {
          Description: 'Current StateMachine Arn',
          Value: {
            Ref: stateMachineLogicalId,
          },
        };

        const newStateMachineOutPutObject = {
          [stateMachineOutputLogicalId]: stateMachineOutPutObject,
        };

        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Outputs,
          newStateMachineOutPutObject
        );

        return BbPromise.resolve();
      });
    }
  },
};
