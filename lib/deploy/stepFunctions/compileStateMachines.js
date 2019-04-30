'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');

function isIntrinsic(obj) {
  const isObject = typeof obj === 'object';
  return isObject && Object.keys(obj).some((k) => k.startsWith('Fn::') || k.startsWith('Ref'));
}

function toTags(obj, serverless) {
  const tags = [];

  if (!obj) {
    return tags;
  }

  if (_.isPlainObject(obj)) {
    _.forEach(
      obj,
      (Value, Key) => tags.push({ Key, Value: Value.toString() }));
  } else {
    throw new serverless.classes
      .Error('Unable to parse tags, it should be an object.');
  }

  return tags;
}

module.exports = {
  isIntrinsic,
  compileStateMachines() {
    if (this.isStateMachines()) {
      this.getAllStateMachines().forEach((stateMachineName) => {
        const stateMachineObj = this.getStateMachine(stateMachineName);
        let DefinitionString;
        let RoleArn;
        let DependsOn = [];
        const Tags = toTags(this.serverless.service.provider.tags, this.serverless);

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
          } else if (isIntrinsic(stateMachineObj.role)) {
            RoleArn = stateMachineObj.role;
          } else {
            const errorMessage = [
              `role property in stateMachine "${stateMachineName}" is neither a string`,
              ' nor a CloudFormation intrinsic function',
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
          DependsOn.push('IamRoleStateMachineExecution');
        }

        if (stateMachineObj.dependsOn) {
          const dependsOn = stateMachineObj.dependsOn;

          if (_.isArray(dependsOn) && _.every(dependsOn, _.isString)) {
            DependsOn = _.concat(DependsOn, dependsOn);
          } else if (_.isString(dependsOn)) {
            DependsOn.push(dependsOn);
          } else {
            const errorMessage = [
              `dependsOn property in stateMachine "${stateMachineName}" is neither a string`,
              ' nor an array of strings',
            ].join('');
            throw new this.serverless.classes
              .Error(errorMessage);
          }
        }

        if (stateMachineObj.tags) {
          const stateMachineTags = toTags(stateMachineObj.tags, this.serverless);
          _.forEach(stateMachineTags, tag => Tags.push(tag));
        }

        const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName,
          stateMachineObj);
        const stateMachineOutputLogicalId = this
          .getStateMachineOutputLogicalId(stateMachineName, stateMachineObj);
        const stateMachineTemplate = {
          Type: 'AWS::StepFunctions::StateMachine',
          Properties: {
            DefinitionString,
            RoleArn,
            Tags,
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
