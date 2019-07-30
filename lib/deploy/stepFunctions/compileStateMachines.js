'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const Chance = require('chance');
const { isIntrinsic, translateLocalFunctionNames } = require('../../utils/aws');

const chance = new Chance();

function randomName() {
  return chance.string({
    length: 10,
    pool: 'abcdefghijklmnopqrstufwxyzABCDEFGHIJKLMNOPQRSTUFWXYZ1234567890',
  });
}

function toTags(obj, serverless) {
  const tags = [];

  if (!obj) {
    return tags;
  }

  if (_.isPlainObject(obj)) {
    _.forEach(
      obj,
      (Value, Key) => tags.push({ Key, Value: Value.toString() }),
    );
  } else {
    throw new serverless.classes
      .Error('Unable to parse tags, it should be an object.');
  }

  return tags;
}

// return an iterable of
// [ ParamName,  IntrinsicFunction ]
// e.g. [ 'mptFnX05Fb', { Ref: 'MyTopic' } ]
// this makes it easy to use _.fromPairs to construct an object afterwards
function* getIntrinsicFunctions(obj) {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (Array.isArray(value)) {
        // eslint-disable-next-line guard-for-in, no-restricted-syntax
        for (const idx in value) {
          const innerFuncs = Array.from(getIntrinsicFunctions(value[idx]));
          for (const x of innerFuncs) {
            yield x;
          }
        }
      } else if (isIntrinsic(value)) {
        const paramName = randomName();
        // eslint-disable-next-line no-param-reassign
        obj[key] = `\${${paramName}}`;
        yield [paramName, value];
      } else if (typeof value === 'object') {
        const innerFuncs = Array.from(getIntrinsicFunctions(value));
        for (const x of innerFuncs) {
          yield x;
        }
      }
    }
  }
}

module.exports = {
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
            const functionMappings = Array.from(getIntrinsicFunctions(stateMachineObj.definition));
            const definitionString = JSON.stringify(stateMachineObj.definition, undefined, 2);

            if (_.isEmpty(functionMappings)) {
              DefinitionString = definitionString;
            } else {
              const f = translateLocalFunctionNames.bind(this);
              const params = _.fromPairs(functionMappings.map(([k, v]) => [k, f(v)]));
              DefinitionString = {
                'Fn::Sub': [
                  definitionString,
                  params,
                ],
              };
            }
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
          newStateMachineObject[
            stateMachineLogicalId].Properties.StateMachineName = stateMachineObj.name;
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
          newStateMachineOutPutObject);

        return BbPromise.resolve();
      });
    }
  },
};
