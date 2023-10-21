const path = require('path');
const fs = require('fs');
const mustache = require('mustache');
const configRewire = require('../config');

function getMustacheTags(template) {
  const tags = mustache.parse(template);

  return tags
    .filter((tag) => tag[0] === 'name')
    .map((tag) => tag[1]);
}

function schemaHasProperty(schema, property) {
  const parts = property.split('.');

  let root = schema;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];

    if (!('properties' in root)) {
      return false;
    }

    if (!(part in root.properties)) {
      return false;
    }

    root = root.properties[part];
  }

  return true;
}

describe('Configuration schema', () => {
  it('contains any value needed by any template', () => {
    const configSchema = configRewire.__get__('configSchema');

    const templateDir = path.join(__dirname, '../templates/payment-methods');
    const templateFiles = fs.readdirSync(templateDir)
      .map((file) => path.join(templateDir, file));

    templateFiles
      .forEach((templateFile) => {
        const template = fs.readFileSync(templateFile, 'utf8');

        const missingTag = getMustacheTags(template)
          .find((tag) => !schemaHasProperty(configSchema, tag));

        expect(missingTag).toBeUndefined();
      });
  });
});
