'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const schema = require('./compileAlarms.schema');
const logger = require('../../utils/logger');

const cloudWatchMetricNames = {
  executionsTimedOut: 'ExecutionsTimedOut',
  executionsFailed: 'ExecutionsFailed',
  executionsAborted: 'ExecutionsAborted',
  executionThrottled: 'ExecutionThrottled',
  executionsSucceeded: 'ExecutionsSucceeded',
};

const alarmDescriptions = {
  executionsTimedOut: 'executions timed out',
  executionsFailed: 'executions failed',
  executionsAborted: 'executions were aborted',
  executionThrottled: 'execution were throttled',
  executionsSucceeded: 'executions succeeded',
};

const supportedVariables = [
  'stateMachineName',
  'cloudWatchMetricName',
  'metricName',
];
const variableRegxPattern = /(?<=\$\[)[^\][]*(?=])/g;

function getAlarmNameFromTemplate(nameTemplate, variables) {
  let alarmName = null;
  if (!_.isNil(nameTemplate)) {
    const matches = nameTemplate.match(variableRegxPattern);
    let validVariables = true;
    for (const match of matches) {
      if (!supportedVariables.includes(match)) {
        logger.log(
          `Invalid alarms.nameTemplate property, variable '${match}' `
          + `does not match with the supported variables: ${supportedVariables.join(', ')}`,
        );
        validVariables = false;
      }
    }

    if (validVariables) {
      alarmName = nameTemplate;
      for (const match of matches) {
        alarmName = alarmName.replace(`$[${match}]`, variables[match]);
      }
    }
  }

  return alarmName;
}

function getCloudWatchAlarms(
  serverless, region, stage, stateMachineName, stateMachineLogicalId, alarmsObj,
) {
  const okAction = _.get(alarmsObj, 'topics.ok');
  const okActions = okAction ? [okAction] : [];
  const alarmAction = _.get(alarmsObj, 'topics.alarm');
  const alarmActions = alarmAction ? [alarmAction] : [];
  const insufficientDataAction = _.get(alarmsObj, 'topics.insufficientData');
  const insufficientDataActions = insufficientDataAction ? [insufficientDataAction] : [];
  const defaultTreatMissingData = _.get(alarmsObj, 'treatMissingData', 'missing');
  const nameTemplate = _.get(alarmsObj, 'nameTemplate', null);

  const metrics = _.uniq(_.get(alarmsObj, 'metrics', []));
  const [valid, invalid] = _.partition(
    metrics,
    m => _.has(cloudWatchMetricNames, _.get(m, 'metric', m)),
  );

  if (!_.isEmpty(invalid)) {
    logger.log(
      `state machine [${stateMachineName}] : alarms.metrics has invalid metrics `,
      `[${invalid.join(',')}]. `
      + 'No CloudWatch Alarms would be created for these. '
      + 'Please see https://github.com/horike37/serverless-step-functions for supported metrics',
    );
  }

  return valid.map((metric) => {
    // metric can be either a string or object
    const metricName = _.get(metric, 'metric', metric);
    const cloudWatchMetricName = cloudWatchMetricNames[metricName];
    const AlarmDescription = `${stateMachineName}[${stage}][${region}]: ${alarmDescriptions[metricName]}`;
    const defaultLogicalId = `${stateMachineLogicalId}${cloudWatchMetricName}Alarm`;
    const logicalId = _.get(metric, 'logicalId', defaultLogicalId);
    const treatMissingData = _.get(metric, 'treatMissingData', defaultTreatMissingData);

    const templateAlarmName = getAlarmNameFromTemplate(nameTemplate, {
      metricName,
      cloudWatchMetricName,
      stateMachineName,
    });

    const alarmName = _.get(metric, 'alarmName', templateAlarmName);

    const cfnResource = {
      logicalId,
      alarm: {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
          Namespace: 'AWS/States',
          MetricName: cloudWatchMetricName,
          AlarmDescription,
          Threshold: 1,
          Period: 60,
          EvaluationPeriods: 1,
          ComparisonOperator: 'GreaterThanOrEqualToThreshold',
          Statistic: 'Sum',
          OKActions: okActions,
          AlarmActions: alarmActions,
          InsufficientDataActions: insufficientDataActions,
          TreatMissingData: treatMissingData,
          Dimensions: [
            {
              Name: 'StateMachineArn',
              Value: {
                Ref: stateMachineLogicalId,
              },
            },
          ],
        },
      },
    };

    if (alarmName) {
      cfnResource.alarm.Properties.AlarmName = alarmName;
    }

    return cfnResource;
  });
}

function validateConfig(serverless, stateMachineName, alarmsObj) {
  // no alarms defined at all
  if (!_.isObject(alarmsObj)) {
    return false;
  }

  const { error } = schema.validate(alarmsObj, { allowUnknown: false });

  if (error) {
    logger.log(
      `State machine [${stateMachineName}] : alarms config is malformed. `
      + 'Please see https://github.com/horike37/serverless-step-functions for examples. '
      + `${error}`,
    );
    return false;
  }

  return true;
}

module.exports = {
  compileAlarms() {
    logger.config(this.serverless, this.v3Api);
    const cloudWatchAlarms = _.flatMap(this.getAllStateMachines(), (name) => {
      const stateMachineObj = this.getStateMachine(name);
      const stateMachineLogicalId = this.getStateMachineLogicalId(name, stateMachineObj);
      const stateMachineName = stateMachineObj.name || name;
      const alarmsObj = stateMachineObj.alarms;

      if (!validateConfig(this.serverless, stateMachineName, alarmsObj)) {
        return [];
      }

      return getCloudWatchAlarms(
        this.serverless,
        this.region,
        this.stage,
        stateMachineName,
        stateMachineLogicalId,
        alarmsObj,
      );
    });

    const newResources = _.mapValues(_.keyBy(cloudWatchAlarms, 'logicalId'), 'alarm');

    _.merge(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newResources,
    );
    return BbPromise.resolve();
  },
};
