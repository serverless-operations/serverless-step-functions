'use strict';

const sns = require('./sns');
const sqs = require('./sqs');
const kinesis = require('./kinesis');
const firehose = require('./firehose');
const lambda = require('./lambda');
const stepFunctions = require('./stepFunctions');

const registry = new Map([
  ['sns', sns],
  ['sqs', sqs],
  ['kinesis', kinesis],
  ['firehose', firehose],
  ['lambda', lambda],
  ['stepFunctions', stepFunctions],
]);

function getStrategy(targetObj) {
  for (const [type, strategy] of registry) {
    if (Object.hasOwn(targetObj, type)) {
      return { type, strategy };
    }
  }
  return null;
}

module.exports = { registry, getStrategy };
