const Joi = require('@hapi/joi');

const arn = Joi.alternatives().try(
  Joi.string().regex(/^arn:aws/, 'ARN'),
  Joi.object().keys({
    Ref: Joi.string(),
  }),
  Joi.object().keys({
    'Fn::GetAtt': Joi.array().items(Joi.string()),
  }),
);

const definition = Joi.alternatives().try(
  Joi.string(),
  Joi.object(),
);

const dependsOn = Joi.alternatives().try(
  Joi.string(),
  Joi.array().items(Joi.string()),
);

const id = Joi.string();
const tags = Joi.object();
const name = Joi.string();
const events = Joi.array();
const alarms = Joi.object();
const notifications = Joi.object();
const useExactVersion = Joi.boolean().default(false);

const schema = Joi.object().keys({
  id,
  events,
  name,
  role: arn,
  useExactVersion,
  definition: definition.required(),
  dependsOn,
  tags,
  alarms,
  notifications,
});

module.exports = schema;
