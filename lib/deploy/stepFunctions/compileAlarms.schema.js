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
    'Fn::ImportValue': Joi.alternatives().try(
      Joi.string(),
      Joi.object(),
    ),
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

const topics = Joi.object().keys({
  ok: arn,
  alarm: arn,
  insufficientData: arn,
}).or('ok', 'alarm', 'insufficientData');

const treatMissingData = Joi.string()
  .allow('missing', 'ignore', 'breaching', 'notBreaching')
  .default('missing');

const simpleMetric = Joi.string()
  .allow('executionsTimedOut', 'executionsFailed', 'executionsAborted', 'executionThrottled',
    'executionsSucceeded');

const complexMetric = Joi.object().keys({
  metric: simpleMetric.required(),
  logicalId: Joi.string(),
  treatMissingData,
});

const metric = Joi.alternatives().try(
  simpleMetric,
  complexMetric,
);

const metrics = Joi.array().items(metric).min(1);

const schema = Joi.object().keys({
  topics: topics.required(),
  metrics: metrics.required(),
  treatMissingData,
});

module.exports = schema;
