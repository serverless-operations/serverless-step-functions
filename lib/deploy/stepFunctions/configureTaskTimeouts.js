'use strict';

const _ = require('lodash');
const logger = require('../../utils/logger');

// Serverless Framework's fallback when neither function.timeout nor
// provider.timeout is set (osls/lib/plugins/aws/package/compile/functions.js).
// AWS Lambda's own default is 3s, but the Serverless-deployed function gets
// this value baked into the CloudFormation template, so it's what we mirror.
const SERVERLESS_DEFAULT_TIMEOUT_SECONDS = 6;
const LAMBDA_INVOKE_RESOURCE_PREFIX = 'arn:aws:states:::lambda:invoke';

function getFunctionKeyFromRef(ref, functions, logicalIdToKey) {
  if (!ref || typeof ref !== 'object') return null;

  if (typeof ref.Ref === 'string') {
    const value = ref.Ref;
    if (Object.hasOwn(functions, value)) return value;
    return logicalIdToKey[value] || null;
  }

  if (Array.isArray(ref['Fn::GetAtt']) && typeof ref['Fn::GetAtt'][0] === 'string') {
    const logicalId = ref['Fn::GetAtt'][0];
    if (Object.hasOwn(functions, logicalId)) return logicalId;
    return logicalIdToKey[logicalId] || null;
  }

  return null;
}

function resolveTaskFunctionKey(state, functions, logicalIdToKey) {
  const resource = state.Resource;

  if (typeof resource === 'string' && resource.startsWith(LAMBDA_INVOKE_RESOURCE_PREFIX)) {
    const fnName = state.Parameters && state.Parameters.FunctionName;
    return getFunctionKeyFromRef(fnName, functions, logicalIdToKey);
  }

  return getFunctionKeyFromRef(resource, functions, logicalIdToKey);
}

// Yields [statePath, state] for every Task state, recursing through
// Parallel branches and Map iterators. Paths are arrays of property keys
// rooted at the definition object so _.get / _.set can address the state.
function* iterateTaskStates(states, basePath) {
  if (!states || typeof states !== 'object') return;
  for (const stateName of Object.keys(states)) {
    const state = states[stateName];
    if (state && typeof state === 'object') {
      const statePath = [...basePath, stateName];

      if (state.Type === 'Task') {
        yield [statePath, state];
      } else if (state.Type === 'Parallel' && Array.isArray(state.Branches)) {
        for (let i = 0; i < state.Branches.length; i += 1) {
          const branch = state.Branches[i];
          yield* iterateTaskStates(
            branch && branch.States,
            [...statePath, 'Branches', i, 'States'],
          );
        }
      } else if (state.Type === 'Map') {
        let wrapper = null;
        if (state.ItemProcessor) wrapper = 'ItemProcessor';
        else if (state.Iterator) wrapper = 'Iterator';
        if (wrapper) {
          yield* iterateTaskStates(
            state[wrapper].States,
            [...statePath, wrapper, 'States'],
          );
        }
      }
    }
  }
}

// Pure: returns a list of timeout decisions without mutating anything or
// emitting side effects. Each decision is plain data the caller can inspect,
// serialize, or feed to applyTaskTimeoutDecisions.
//
// Decision shapes:
//   { action: 'inject',        statePath, stateName, fnKey, lambdaTimeout }
//   { action: 'warn-overlong', statePath, stateName, fnKey, lambdaTimeout,
//                              userTimeout }
function planTaskTimeouts({
  definition,
  functions,
  providerTimeout,
  getLambdaLogicalId,
}) {
  if (!definition || typeof definition !== 'object' || !definition.States) return [];

  const fns = functions || {};
  const fallbackTimeout = typeof providerTimeout === 'number'
    ? providerTimeout
    : SERVERLESS_DEFAULT_TIMEOUT_SECONDS;

  const logicalIdToKey = {};
  for (const key of Object.keys(fns)) {
    const logicalId = getLambdaLogicalId(key);
    if (typeof logicalId === 'string') logicalIdToKey[logicalId] = key;
  }

  const decisions = [];
  for (const [statePath, state] of iterateTaskStates(definition.States, ['States'])) {
    const fnKey = resolveTaskFunctionKey(state, fns, logicalIdToKey);
    if (fnKey) {
      const fn = fns[fnKey];
      const lambdaTimeout = fn && typeof fn.timeout === 'number'
        ? fn.timeout
        : fallbackTimeout;
      const stateName = statePath[statePath.length - 1];
      const userHasTimeout = state.TimeoutSeconds !== undefined
        || state.TimeoutSecondsPath !== undefined;

      if (!userHasTimeout) {
        decisions.push({
          action: 'inject', statePath, stateName, fnKey, lambdaTimeout,
        });
      } else if (typeof state.TimeoutSeconds === 'number'
        && state.TimeoutSeconds > lambdaTimeout) {
        decisions.push({
          action: 'warn-overlong',
          statePath,
          stateName,
          fnKey,
          lambdaTimeout,
          userTimeout: state.TimeoutSeconds,
        });
      }
    }
  }

  return decisions;
}

// Effect: applies plan decisions to the definition (mutating in place) and
// emits warnings through the supplied `log` callback. Splitting effect from
// decision lets tests assert plans as data without stubbing the logger and
// keeps the door open for dry-run / report use cases.
function applyTaskTimeoutDecisions({
  definition,
  decisions,
  stateMachineName,
  log,
}) {
  for (const d of decisions) {
    if (d.action === 'inject') {
      _.set(definition, [...d.statePath, 'TimeoutSeconds'], d.lambdaTimeout);
    } else if (d.action === 'warn-overlong' && typeof log === 'function') {
      log(
        `⚠ State machine "${stateMachineName}" task "${d.stateName}": `
        + `TimeoutSeconds (${d.userTimeout}s) is greater than the Lambda function `
        + `"${d.fnKey}" timeout (${d.lambdaTimeout}s). The Lambda will fail before `
        + 'the state-level timeout fires.',
      );
    }
  }
}

function configureTaskTimeouts(opts) {
  const decisions = planTaskTimeouts(opts);
  applyTaskTimeoutDecisions({
    definition: opts.definition,
    decisions,
    stateMachineName: opts.stateMachineName,
    log: (msg) => logger.log(msg),
  });
  return decisions;
}

module.exports = configureTaskTimeouts;
module.exports.planTaskTimeouts = planTaskTimeouts;
module.exports.applyTaskTimeoutDecisions = applyTaskTimeoutDecisions;
module.exports.SERVERLESS_DEFAULT_TIMEOUT_SECONDS = SERVERLESS_DEFAULT_TIMEOUT_SECONDS;
