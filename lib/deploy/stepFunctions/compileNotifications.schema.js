const Joi = require('@hapi/joi');

const sqsWithParams = Joi.object().keys({
  arn: Joi.string().required(),
  messageGroupId: Joi.string().required(),
});

const kinesisWithParams = Joi.object().keys({
  arn: Joi.string().required(),
  partitionKeyPath: Joi.string(),
});

const target = Joi.object().keys({
  sns: Joi.string(),
  sqs: Joi.alternatives().try(sqsWithParams, Joi.string()),
  kinesis: Joi.alternatives().try(kinesisWithParams, Joi.string()),
  firehose: Joi.string(),
  lambda: Joi.string(),
  stepFunctions: Joi.string(),
});

const targets = Joi.array().items(target);

const schema = Joi.object().keys({
  ABORTED: targets,
  FAILED: targets,
  RUNNING: targets,
  SUCCEEDED: targets,
  TIMED_OUT: targets,
});

module.exports = schema;
