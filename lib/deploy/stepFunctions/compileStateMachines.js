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

        if (stateMachineObj.definition) {
          if (typeof stateMachineObj.definition === 'string') {
            DefinitionString = JSON.stringify(stateMachineObj.definition)
              .replace(/\\n|\\r|\\n\\r/g, '');
          } else {
            DefinitionString = JSON.stringify(stateMachineObj.definition, undefined, 2);
          }
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
              RoleArn = stateMachineObj.role;
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
          RoleArn = {
            'Fn::GetAtt': [
              'IamRoleStateMachineExecution',
              'Arn',
            ],
          };
          DependsOn = 'IamRoleStateMachineExecution';
        }

        const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName,
          stateMachineObj);
        const stateMachineOutputLogicalId = this
          .getStateMachineOutputLogicalId(stateMachineName, stateMachineObj);
        const stateMachineTemplate =
          {
            Type: 'AWS::StepFunctions::StateMachine',
            Properties: {
              DefinitionString,
              RoleArn,
            },
            DependsOn,
          };

        const newStateMachineObject = {
          [stateMachineLogicalId]: stateMachineTemplate,
        };

        if (stateMachineObj.name) {
          newStateMachineObject[stateMachineLogicalId].Properties.StateMachineName
            = stateMachineObj.name;
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
