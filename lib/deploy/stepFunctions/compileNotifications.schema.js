const Joi = require('@hapi/joi');

const arn = Joi.alternatives().try(
  Joi.string(),
  Joi.object().keys({
    Ref: Joi.string(),
  }),
  Joi.object().keys({
    'Fn::GetAtt': Joi.array().items(Joi.string()),
  }),
  Joi.object().keys({
    'Fn::Join': Joi.array().items([
      Joi.string(),
      Joi.array().items([
        Joi.string(),
        Joi.object().keys({
          Ref: Joi.string(),
        }),
      ]),
    ]),
  }),
);

const sqsWithParams = Joi.object().keys({
  arn: arn.required(),
  messageGroupId: Joi.string().required(),
});

const kinesisWithParams = Joi.object().keys({
  arn: arn.required(),
  partitionKeyPath: Joi.string(),
});

const target = Joi.object().keys({
  sns: arn,
  sqs: Joi.alternatives().try(sqsWithParams, arn),
  kinesis: Joi.alternatives().try(kinesisWithParams, arn),
  firehose: arn,
  lambda: arn,
  stepFunctions: arn,
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
