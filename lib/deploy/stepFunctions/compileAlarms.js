'use strict';
const _ = require('lodash');
const BbPromise = require('bluebird');

const cloudWatchMetricNames = {
  executionsTimeOut: 'ExecutionsTimeOut',
  executionsFailed: 'ExecutionsFailed',
  executionsAborted: 'ExecutionsAborted',
  executionThrottled: 'ExecutionThrottled',
};

const alarmDescriptions = {
  executionsTimeOut: 'executions timed out',
  executionsFailed: 'executions failed',
  executionsAborted: 'executions were aborted',
  executionThrottled: 'execution were throttled',
};

function getCloudWatchAlarms(
  serverless, region, stage, stateMachineName, stateMachineLogicalId, alarmsObj) {
  const okAction = _.get(alarmsObj, 'topics.ok');
  const okActions = okAction ? [okAction] : [];
  const alarmAction = _.get(alarmsObj, 'topics.alarm');
  const alarmActions = alarmAction ? [alarmAction] : [];
  const insufficientDataAction = _.get(alarmsObj, 'topics.insufficientData');
  const insufficientDataActions = insufficientDataAction ? [insufficientDataAction] : [];

  const metrics = _.uniq(_.get(alarmsObj, 'metrics', []));
  const [valid, invalid] = _.partition(metrics, m => _.has(cloudWatchMetricNames, m));

  if (!_.isEmpty(invalid)) {
    serverless.cli.consoleLog(
      `state machine [${stateMachineName}] : alarms.metrics has invalid metrics `,
      `[${invalid.join(',')}]. ` +
      'No CloudWatch Alarms would be created for these. ' +
      'Please see https://github.com/horike37/serverless-step-functions for supported metrics');
  }

  return valid.map(metric => {
    const MetricName = cloudWatchMetricNames[metric];
    const AlarmDescription =
      `${stateMachineName}[${stage}][${region}]: ${alarmDescriptions[metric]}`;
    const logicalId = `${stateMachineLogicalId}${MetricName}Alarm`;

    return {
      logicalId,
      alarm: {
        Type: 'AWS::CloudWatch::Alarm',
        Properties: {
          Namespace: 'AWS/States',
          MetricName,
          AlarmDescription,
          Threshold: 1,
          Period: 60,
          EvaluationPeriods: 1,
          ComparisonOperator: 'GreaterThanOrEqualToThreshold',
          Statistic: 'Sum',
          OKActions: okActions,
          AlarmActions: alarmActions,
          InsufficientDataActions: insufficientDataActions,
          TreatMissingData: 'missing',
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
  });
}

function validateConfig(serverless, stateMachineName, alarmsObj) {
  // no alarms defined at all
  if (!_.isObject(alarmsObj)) {
    return false;
  }

  if (!_.isObject(alarmsObj) ||
      !_.isObject(alarmsObj.topics) ||
      !_.isArray(alarmsObj.metrics) ||
      !_.every(alarmsObj.metrics, _.isString)) {
    serverless.cli.consoleLog(
      `state machine [${stateMachineName}] : alarms config is malformed. ` +
      'Please see https://github.com/horike37/serverless-step-functions for examples');
    return false;
  }

  if (!_.has(alarmsObj.topics, 'ok') &&
      !_.has(alarmsObj.topics, 'alarm') &&
      !_.has(alarmsObj.topics, 'insufficientData')) {
    serverless.cli.consoleLog(
      `state machine [${stateMachineName}] : alarms config is malformed. ` +
      "alarms.topics must specify 'ok', 'alarms' or 'insufficientData'"
    );
    return false;
  }

  return true;
}

module.exports = {
  compileAlarms() {
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
        alarmsObj);
    });

    const newResources = _.mapValues(_.keyBy(cloudWatchAlarms, 'logicalId'), 'alarm');

    _.merge(
      this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
      newResources);
    return BbPromise.resolve();
  },
};
