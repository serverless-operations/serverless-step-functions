const Joi = require('joi');

const arn = Joi.alternatives().try(
  Joi.string().regex(/^arn:aws/, 'ARN'),
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
    'Fn::Join': Joi.array().items(
      Joi.string(),
      Joi.array().items(
        Joi.string(),
        Joi.object().keys({
          Ref: Joi.string(),
        }),
      ),
    ),
  }),
);

const definition = Joi.alternatives().try(
  Joi.string(),
  Joi.object(),
);

const inheritGlobalTags = Joi.boolean();

const dependsOn = Joi.alternatives().try(
  Joi.string(),
  Joi.array().items(Joi.string()),
);

const loggingConfig = Joi.object().keys({
  level: Joi.string().valid('ALL', 'ERROR', 'FATAL', 'OFF').default('OFF'),
  includeExecutionData: Joi.boolean().default(false),
  destinations: Joi.array().items(arn),
});

const tracingConfig = Joi.object().keys({
  enabled: Joi.boolean().default(false),
});

const encryptionConfig = Joi.object().keys({
  KMSkeyReusePeriod: Joi.number().default(900),
  KMSkeyId: Joi.string().default(""),
  type: Joi.string().default("AWS_OWNED_KEY"),
});

const iamRoleStatements = Joi.array().items(
  Joi.object({
    Effect: Joi.string().valid('Allow', 'Deny'),
    Action: [Joi.string(), Joi.array().items(Joi.string())],
    Resource: [Joi.string(), Joi.array()],
  }),
);

const id = Joi.string();
const tags = Joi.object();
const name = Joi.string();
const events = Joi.array();
const alarms = Joi.object();
const notifications = Joi.object();
const useExactVersion = Joi.boolean().default(false);
const type = Joi.string().valid('STANDARD', 'EXPRESS').default('STANDARD');
const retain = Joi.boolean().default(false);

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
  type,
  retain,
  loggingConfig,
  tracingConfig,
  encryptionConfig,
  inheritGlobalTags,
  iamRoleStatements,
}).oxor('role', 'iamRoleStatements');

module.exports = schema;
