'use strict';

const _ = require('lodash');
const Joi = require('@hapi/joi');
const aslValidator = require('asl-validator');
const BbPromise = require('bluebird');
const crypto = require('crypto');
const schema = require('./compileStateMachines.schema');
const { isIntrinsic, translateLocalFunctionNames, convertToFunctionVersion } = require('../../utils/aws');

function generateSubVariableName(element) {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(element))
    .digest('hex');
}

function toTags(obj) {
  const tags = [];

  if (!obj) {
    return tags;
  }

  _.forEach(obj, (Value, Key) => {
    tags.push({ Key, Value: (Value || '').toString() });
  });

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
          const element = value[idx];
          if (isIntrinsic(element)) {
            const paramName = generateSubVariableName(element);
            value[idx] = `\${${paramName}}`;
            yield [paramName, element];
          } else {
            const innerFuncs = Array.from(getIntrinsicFunctions(element));
            for (const x of innerFuncs) {
              yield x;
            }
          }
        }
      } else if (isIntrinsic(value)) {
        const paramName = generateSubVariableName(value);
        // eslint-disable-next-line no-param-reassign
        obj[key] = `\${${paramName}}`;
        yield [paramName, value, (obj.Type === 'Wait' && key === 'Seconds')];
      } else if (typeof value === 'object') {
        const innerFuncs = Array.from(getIntrinsicFunctions(value));
        for (const x of innerFuncs) {
          yield x;
        }
      }
    }
  }
}

// replace any pseudo parameters, e.g. #{AWS::Region} or #{AWS::AccountId}
function replacePseudoParameters(obj) {
  const json = JSON.stringify(obj);

  const regex = /#{([^}]+)}/g;
  if (json.search(regex) >= 0) {
    const newJson = json.replace(regex, '${$1}');
    return {
      replaced: true,
      definition: JSON.parse(newJson),
    };
  }

  return {
    replaced: false,
    definition: obj,
  };
}

module.exports = {
  compileStateMachines() {
    if (this.isStateMachines()) {
      this.getAllStateMachines().forEach((stateMachineName) => {
        const stateMachineObj = this.getStateMachine(stateMachineName);
        const stateMachineLogicalId = this.getStateMachineLogicalId(stateMachineName,
          stateMachineObj);
        let DefinitionString;
        let RoleArn;
        let DependsOn = [];
        let LoggingConfiguration;
        let TracingConfiguration;
        let Tags;
        if (stateMachineObj.inheritGlobalTags === false) {
          Tags = [];
        } else {
          Tags = toTags(this.serverless.service.provider.tags);
        }

        const { error, value } = Joi.validate(stateMachineObj, schema, { allowUnknown: false });
        if (error) {
          const errorMessage = `State machine [${stateMachineName}] is malformed. `
            + 'Please check the README for more info. '
            + `${error}`;
          throw new this.serverless.classes.Error(errorMessage);
        }

        if (stateMachineObj.definition) {
          if (this.serverless.service.stepFunctions.validate) {
            const { isValid, errorsText } = aslValidator(stateMachineObj.definition);
            if (isValid) {
              this.serverless.cli.consoleLog(`✓ State machine "${stateMachineName}" definition is valid`);
            } else {
              const errorMessage = [
                `✕ State machine "${stateMachineName}" definition is invalid:`,
                errorsText(),
              ].join('\n');
              throw new this.serverless.classes.Error(errorMessage);
            }
          }
          if (typeof stateMachineObj.definition === 'string') {
            DefinitionString = JSON.stringify(stateMachineObj.definition)
              .replace(/\\n|\\r|\\n\\r/g, '');
          } else {
            const functionMappings = Array.from(getIntrinsicFunctions(stateMachineObj.definition));
            const { replaced, definition } = replacePseudoParameters(stateMachineObj.definition);
            const definitionString = JSON.stringify(definition, undefined, 2);

            if (!replaced && _.isEmpty(functionMappings)) {
              DefinitionString = definitionString;
            } else if (_.isEmpty(functionMappings)) {
              DefinitionString = {
                'Fn::Sub': definitionString,
              };
            } else {
              const f = translateLocalFunctionNames.bind(this);
              let processedDefinitionString = definitionString;
              functionMappings.forEach((functionMapping) => {
                if (functionMapping[2]) {
                  processedDefinitionString = processedDefinitionString.replace(
                    // eslint-disable-next-line no-useless-escape
                    new RegExp(`\\\"(\\\$\\\{${functionMapping[0]}\\\})\\\"`, 'g'),
                    '$1',
                  );
                }
              });
              const params = _.fromPairs(functionMappings.map(([k, v]) => [k, f(v)]));

              DefinitionString = {
                'Fn::Sub': [
                  processedDefinitionString,
                  params,
                ],
              };
            }
          }
        }
        if (stateMachineObj.useExactVersion === true && DefinitionString['Fn::Sub']) {
          const params = DefinitionString['Fn::Sub'][1];
          const f = convertToFunctionVersion.bind(this);
          const converted = _.mapValues(params, f);
          DefinitionString['Fn::Sub'][1] = converted;
        }

        if (stateMachineObj.role) {
          RoleArn = stateMachineObj.role;
        } else {
          const roleLogicalId = `${stateMachineLogicalId}Role`;
          RoleArn = {
            'Fn::GetAtt': [
              roleLogicalId,
              'Arn',
            ],
          };
          DependsOn.push(roleLogicalId);
        }

        if (stateMachineObj.dependsOn) {
          const dependsOn = stateMachineObj.dependsOn;

          if (_.isArray(dependsOn)) {
            DependsOn = _.concat(DependsOn, dependsOn);
          } else {
            DependsOn.push(dependsOn);
          }
        }

        if (stateMachineObj.tags) {
          const stateMachineTags = toTags(stateMachineObj.tags);
          _.forEach(stateMachineTags, tag => Tags.push(tag));
        }

        if (value.loggingConfig) {
          const Destinations = (value.loggingConfig.destinations || [])
            .map(arn => ({
              CloudWatchLogsLogGroup: {
                LogGroupArn: arn,
              },
            }));
          LoggingConfiguration = {
            Level: value.loggingConfig.level,
            IncludeExecutionData: value.loggingConfig.includeExecutionData,
            Destinations,
          };
        }

        if (value.tracingConfig) {
          TracingConfiguration = {
            Enabled: value.tracingConfig.enabled,
          };
        }

        const stateMachineOutputLogicalId = this
          .getStateMachineOutputLogicalId(stateMachineName, stateMachineObj);

        const stateMachineTemplate = {
          Type: 'AWS::StepFunctions::StateMachine',
          Properties: {
            DefinitionString,
            RoleArn,
            StateMachineType: stateMachineObj.type,
            LoggingConfiguration,
            TracingConfiguration,
          },
          DependsOn,
        };
        if (Tags.length > 0) {
          stateMachineTemplate.Properties.Tags = Tags;
        }

        const newStateMachineObject = {
          [stateMachineLogicalId]: stateMachineTemplate,
        };

        if (stateMachineObj.retain) {
          newStateMachineObject[stateMachineLogicalId].DeletionPolicy = 'Retain';
        }

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

        if (this.serverless.service.stepFunctions.noOutput !== true) {
          _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Outputs,
            newStateMachineOutPutObject);
        }

        return BbPromise.resolve();
      });
    }
  },
};
