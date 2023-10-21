const Ajv = require('ajv');

const configSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            line2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zip: { type: 'string' },
          },
        },
      },
      required: ['name'],
    },
    client: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        rate: { type: 'number' },
        fields: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
      required: ['name', 'rate'],
    },
    financial: {
      type: 'object',
      properties: {
        bank: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            routingNumber: { type: 'string' },
            accountNumber: { type: 'string' },
          },
          required: ['name', 'routingNumber', 'accountNumber'],
        },
        directDeposit: {
          type: 'object',
          properties: {
            receivingInstitution: { type: 'string' },
            abaRoutingNumber: { type: 'string' },
          },
          required: ['receivingInstitution'],
        },
        venmo: {
          type: 'object',
          properties: {
            username: { type: 'string' },
          },
          required: ['username'],
        },
      },
    },
  },
  required: ['user', 'client'],
  additionalProperties: false,
};

/**
 * Validate the config object against the schema
 * @param config
 * @returns {boolean} true if config is valid, false otherwise
 */
function validateConfig(config) {
  const ajv = new Ajv();
  const validate = ajv.compile(configSchema);

  return validate(config);
}

module.exports = {
  validateConfig,
};
