'use strict';

const _ = require('lodash');
const aslValidator = require('asl-validator');
const BbPromise = require('bluebird');
const crypto = require('node:crypto');
const schema = require('./compileStateMachines.schema');
const configureTaskTimeouts = require('./configureTaskTimeouts');
const {
  isIntrinsic, translateLocalFunctionNames, convertToFunctionVersion, resolveLambdaFunctionName,
} = require('../../utils/aws');
const logger = require('../../utils/logger');

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
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      const value = obj[key];

      if (Array.isArray(value)) {
        // eslint-disable-next-line guard-for-in
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
        const stateMachineLogicalId = this.getStateMachineLogicalId(
          stateMachineName,
          stateMachineObj,
        );
        let DefinitionString;
        let RoleArn;
        let DependsOn = [];
        let LoggingConfiguration;
        let TracingConfiguration;
        let EncryptionConfiguration;
        let Tags;
        if (stateMachineObj.inheritGlobalTags === false) {
          Tags = [];
        } else {
          Tags = toTags(this.serverless.service.provider.tags);
        }
        const { error, value } = schema.validate(stateMachineObj, { allowUnknown: false });
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
              logger.log(`✓ State machine "${stateMachineName}" definition is valid`);
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
            if (stateMachineObj.configureTaskTimeouts === true) {
              configureTaskTimeouts({
                definition: stateMachineObj.definition,
                functions: this.serverless.service.functions,
                providerTimeout: this.serverless.service.provider.timeout,
                getLambdaLogicalId: (key) => this.provider.naming.getLambdaLogicalId(key),
                stateMachineName,
              });
            }
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
              const params = {};
              functionMappings.forEach(([k, v]) => {
                const translated = f(v);
                const functionName = resolveLambdaFunctionName(translated, this);
                if (functionName) {
                  // Inline a static Fn::Sub ARN directly into the definition string.
                  // Using { Ref: LambdaFunction } resolves to the function *name* at
                  // CF evaluation time, not its ARN — Step Functions rejects that.
                  // A static ARN eliminates the CF resource dependency that causes the
                  // circular dependency error reported in #470.
                  const staticArn = `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${functionName}`;
                  processedDefinitionString = processedDefinitionString.replace(
                    new RegExp(`\\$\\{${k}\\}`, 'g'),
                    staticArn,
                  );
                } else {
                  params[k] = translated;
                }
              });

              DefinitionString = _.isEmpty(params)
                ? { 'Fn::Sub': processedDefinitionString }
                : { 'Fn::Sub': [processedDefinitionString, params] };
            }
          }
        }
        if (stateMachineObj.useExactVersion === true && DefinitionString['Fn::Sub']) {
          if (!Array.isArray(DefinitionString['Fn::Sub'])) {
            DefinitionString['Fn::Sub'] = [DefinitionString['Fn::Sub'], {}];
          }
          const params = DefinitionString['Fn::Sub'][1];
          const f = convertToFunctionVersion.bind(this);
          const converted = _.mapValues(params, f);

          // When a Lambda function's layers change, the function code hash (and
          // therefore the Serverless-generated version logical ID) stays the same,
          // so CloudFormation sees no definition change and skips the state machine
          // update. To fix this, we create a layer-hash-aware AWS::Lambda::Version
          // resource whose logical ID incorporates a hash of the function's layer
          // version logical IDs. When layers change, the hash changes, a new version
          // resource is created (publishing a new Lambda version), and the state
          // machine DefinitionString changes so CloudFormation updates it.
          const resources = this.serverless.service.provider.compiledCloudFormationTemplate
            .Resources;
          Object.keys(converted).forEach((paramKey) => {
            const paramValue = converted[paramKey];
            if (!_.has(paramValue, 'Ref')) return;

            const sfVersionLogicalId = paramValue.Ref;
            const sfVersionResource = resources[sfVersionLogicalId];
            if (!sfVersionResource || sfVersionResource.Type !== 'AWS::Lambda::Version') return;

            const functionLogicalId = _.get(sfVersionResource, 'Properties.FunctionName.Ref');
            if (!functionLogicalId) return;

            const functionResource = resources[functionLogicalId];
            const layers = _.get(functionResource, 'Properties.Layers', []);
            if (layers.length === 0) return;
            // Serialize each layer entry to a stable string regardless of form:
            // {Ref: 'LogicalId'}, 'arn:...', {Fn::Sub: '...'}, {Fn::ImportValue: '...'}, etc.
            const layerRefs = layers
              .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
              .sort();

            const layerHash = crypto
              .createHash('md5')
              .update(layerRefs.join(','))
              .digest('hex')
              .slice(0, 8);

            const layerAwareVersionLogicalId = `${sfVersionLogicalId}L${layerHash}`;
            if (!resources[layerAwareVersionLogicalId]) {
              resources[layerAwareVersionLogicalId] = _.cloneDeep(sfVersionResource);
            }
            converted[paramKey] = { Ref: layerAwareVersionLogicalId };
          });

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
          _.forEach(stateMachineTags, (tag) => Tags.push(tag));
        }

        if (value.loggingConfig) {
          LoggingConfiguration = {
            Level: value.loggingConfig.level,
            IncludeExecutionData: value.loggingConfig.includeExecutionData,
          };
          if (value.loggingConfig.destinations && value.loggingConfig.destinations.length > 0) {
            LoggingConfiguration.Destinations = value.loggingConfig.destinations.map((arn) => ({
              CloudWatchLogsLogGroup: {
                LogGroupArn: arn,
              },
            }));
          }
        }

        if (value.tracingConfig) {
          TracingConfiguration = {
            Enabled: value.tracingConfig.enabled,
          };
        }

        if (value.encryptionConfig) {
          EncryptionConfiguration = {
            KmsDataKeyReusePeriodSeconds: value.encryptionConfig.KmsDataKeyReusePeriodSeconds,
            KmsKeyId: {
              'Fn::Sub': value.encryptionConfig.KmsKeyId,
            },
            Type: value.encryptionConfig.Type,
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
            EncryptionConfiguration,
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

        _.merge(
          this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
          newStateMachineObject,
        );

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
          _.merge(
            this.serverless.service.provider.compiledCloudFormationTemplate.Outputs,
            newStateMachineOutPutObject,
          );
        }
      });
    }
    return BbPromise.resolve();
  },
};
