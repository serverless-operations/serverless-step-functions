'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  replaceNamesWithArns(stateMachineName, node) {
    if (node instanceof Array) {
      for (let i = 0; i < node.length; i++) {
        this.replaceNamesWithArns(stateMachineName, node[i]);
      }

      return;
    }

    const keys = Object.keys(node);

    for (let i = 0; i < keys.length; i++) {
      if (node[keys[i]] instanceof Array || node[keys[i]] instanceof Object) {
        this.replaceNamesWithArns(stateMachineName, node[keys[i]]);
      }
    }

    if (node.Type === 'Task' && node.Resource) {
      if (node.Resource.indexOf('arn:aws') !== 0) {
        if (!this.serverless.service.functions[node.Resource]) {
          const errorMessage = [
            `${stateMachineName} is referring to non-existent function ${node.Resource}`,
            ' please make sure this function exists inside your serverless.yml',
          ].join('');

          throw new this.serverless.classes
            .Error(errorMessage);
        }

        // disable because we're mutating object
        /* eslint-disable no-param-reassign */
        node.Resource = {
          'Fn::Join': [
            '-',
            [
              this.provider.serverless.service.service,
              this.provider.getStage(),
              this.provider.getRegion(),
              node.Resource,
            ],
          ],
        };
        /* eslint-enable no-param-reassign */
      }
    }
  },
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
          this.replaceNamesWithArns(stateMachineName, stateMachineObj.definition);
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
