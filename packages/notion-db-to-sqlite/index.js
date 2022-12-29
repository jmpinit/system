const fs = require('fs');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const { Command } = require('commander');
const { Client } = require('@notionhq/client');
const sqlite3 = require('sqlite3');
const { escape } = require('sqlstring');
const { fileExists } = require('./util');

const configSchema = {
  type: 'object',
  properties: {
    notion: {
      type: 'object',
      properties: {
        secret: { type: 'string' },
      },
      required: ['secret'],
    },
    client: {
      type: 'object',
      properties: {
        database: { type: 'string' },
      },
      required: ['database'],
    },
  },
};

function loadConfig(fileNames) {
  return fileNames.reduce((config, fn) => {
    const part = yaml.load(fs.readFileSync(fn, 'utf8'));
    return { ...config, ...part };
  }, {});
}

/**
 * Turn a Notion value object into an appropriate JS object
 * @param {Object} valueObj - Notion
 * @returns {*|Date|string}
 */
function simplifyNotionValue(valueObj) {
  // https://developers.notion.com/reference/property-object
  // > Each database property object contains the following keys. In addition,
  // > it must contain a key corresponding with the value of type. The value is an
  // > object containing type-specific configuration.

  // See https://developers.notion.com/reference/property-object#database-properties
  // for the list of available types

  switch (valueObj.type) {
    case 'title':
      // https://developers.notion.com/reference/property-object#title-configuration
      // https://developers.notion.com/reference/property-value-object#title-property-values
      // Title property value objects contain an array of rich text objects
      // within the title property.

      // Return the rich text objects in the title converted to plain text and joined with newlines
      return valueObj.title
        .map(simplifyNotionValue)
        .join('\n'); // TODO: Do newlines separate these?
    case 'rich_text':
      // https://developers.notion.com/reference/rich-text
      // https://developers.notion.com/reference/property-value-object#rich-text-property-values
      return valueObj.rich_text.plain_text;
    case 'text':
      return valueObj.plain_text;
    case 'number':
      // https://developers.notion.com/reference/property-object#number-configuration
      // https://developers.notion.com/reference/property-value-object#number-property-values
      return valueObj.number;
    case 'select':
      // https://developers.notion.com/reference/property-object#select-configuration
      // https://developers.notion.com/reference/property-value-object#select-property-values

      // At the moment it looks like the API docs are wrong? There is no options field
      if (valueObj.select === null) {
        // No selection
        return undefined;
      }

      // Return the name of the tag
      return valueObj.select.name;
    case 'multi_select':
      // https://developers.notion.com/reference/property-object#multi-select-configuration
      // https://developers.notion.com/reference/property-object#multi-select-options
      return valueObj.multi_select
        .reduce((opts, opt) => opts.add(opt.name), new Set());
    case 'date': {
      // https://developers.notion.com/reference/property-value-object#date-property-values
      // ISO 8601 formatted dates
      const parseIso8601 = (dateStr) => new Date(Date.parse(dateStr));

      if (valueObj.date === null) {
        // Date is not set
        return undefined;
      }

      if ('end' in valueObj.date && valueObj.date.end !== null) {
        // Having an end date means this is a date range
        return {
          start: parseIso8601(valueObj.date.start),
          end: parseIso8601(valueObj.date.end),
        };
      }

      return parseIso8601(valueObj.date.start);
    }
    case 'people':
      // https://developers.notion.com/reference/property-value-object#people-property-values
      // Return an array of the names of the people
      return valueObj.people.map((person) => person.name);
    case 'files':
      // https://developers.notion.com/reference/property-value-object#files-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'checkbox':
      // https://developers.notion.com/reference/property-value-object#checkbox-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'url':
      // https://developers.notion.com/reference/property-value-object#url-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'email':
      // https://developers.notion.com/reference/property-value-object#email-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'phone_number':
      // https://developers.notion.com/reference/property-value-object#phone-number-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'formula':
      // https://developers.notion.com/reference/property-object#formula-configuration
      // https://developers.notion.com/reference/property-value-object#formula-property-values
      return simplifyNotionValue(valueObj.formula);
    case 'relation':
      // https://developers.notion.com/reference/property-object#relation-configuration
      // https://developers.notion.com/reference/property-value-object#relation-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'rollup':
      // https://developers.notion.com/reference/property-object#rollup-configuration
      // https://developers.notion.com/reference/property-value-object#rollup-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'created_time':
      // https://developers.notion.com/reference/property-object#created-time-configuration
      // https://developers.notion.com/reference/property-value-object#created-time-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'created_by':
      // https://developers.notion.com/reference/property-object#created-by-configuration
      // https://developers.notion.com/reference/property-value-object#created-by-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'last_edited_time':
      // https://developers.notion.com/reference/property-object#last-edited-time-configuration
      // https://developers.notion.com/reference/property-value-object#last-edited-time-property-values
      // TODO
      throw new Error('Unimplemented');
    case 'last_edited_by':
      // https://developers.notion.com/reference/property-object#last-edited-by-configuration
      // https://developers.notion.com/reference/property-value-object#last-edited-by-property-values
      // TODO
      throw new Error('Unimplemented');
    default:
      // This should not be hit because we exhaustively include the types listed
      // in the documentation so if this is hit there may be a typo or Notion
      // may have added a new type
      // Check the changelog: https://developers.notion.com/changelog
      throw new Error(`Unrecognized value type for: ${JSON.stringify(valueObj)}`);
  }
}

async function queryTimeLog(databaseId, secret) {
  const notion = new Client({ auth: secret });

  const pages = [];
  let cursor;

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { results, next_cursor: nextCursor } = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });

    pages.push(...results);

    if (!nextCursor) {
      break;
    }

    cursor = nextCursor;
  }

  return pages;
}

function dbToTable(dbPages) {
  return dbPages.map((rowObject) => {
    const row = {};

    Object.entries(rowObject.properties).forEach(([columnName, value]) => {
      row[columnName] = simplifyNotionValue(value);
    });

    return row;
  });
}

/**
 * Return the SQLite data type most appropriate for the given JS value
 * @param value
 * @returns Object with fields for the SQLite type and value
 */
function sqliteValueFrom(value) {
  if (value === undefined || value === null) {
    return {
      type: 'NULL',
      value: undefined,
    };
  }

  if (typeof value === 'number') {
    return {
      type: 'REAL',
      value,
    };
  }

  if (typeof value === 'string') {
    return {
      type: 'TEXT',
      value,
    };
  }

  if (value instanceof Date) {
    // Dates are converted to the number of milliseconds since 1 January 1970 00:00:00 UTC
    return {
      type: 'INTEGER',
      value: value.valueOf(),
    };
  }

  console.log(value);
  throw new Error('No appropriate SQLite type for value');
}

function writeTable(db, table) {
  if (table.length === 0) {
    return;
  }

  // Isolate the columns containing multiple values because we will create separate tables for those

  const setColumns = Object.entries(table[0])
    .filter(([, jsVal]) => jsVal instanceof Set)
    .map(([columnName]) => columnName);
  const nonSetColumns = Object.entries(table[0])
    .filter(([, jsVal]) => !(jsVal instanceof Set))
    .map(([columnName]) => columnName);

  const columnDefs = nonSetColumns
    .map((columnName) => {
      const { type } = sqliteValueFrom(table[0][columnName]);
      return `${escape(columnName)} ${type}`;
    })
    .join(', ');

  // Create main table
  db.serialize(() => {
    db.run(`CREATE TABLE main (id INTEGER PRIMARY KEY, ${columnDefs})`);

    const columnCount = nonSetColumns.length;
    // One extra for the ID
    const questionMarks = Array.from(Array(columnCount + 1)).map(() => '?').join(', ');
    const statement = db.prepare(`INSERT INTO main VALUES (${questionMarks})`);

    // For each row of the table insert the non-multiselect values from the row
    table.forEach((row, i) => {
      const values = nonSetColumns.reduce((vs, columnName) => {
        const { value } = sqliteValueFrom(row[columnName]);
        return vs.concat(value);
      }, []);

      statement.run([i, ...values]);
    });

    statement.finalize();
  });

  // Create multiselect tables
  setColumns
    .forEach((columnName) => {
      db.serialize(() => {
        const tableName = escape(columnName);

        // Create a table for this multiselect column
        db.run(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, row INTEGER, selectName TEXT)`);

        const statement = db.prepare(`INSERT INTO ${tableName} VALUES (?, ?, ?)`);

        // For each row in the main table add the values for this multiselect in its table
        // Each member of each multiselect creates its own row
        let id = 0;
        table
          .map((row, rowId) => [rowId, row[columnName]]) // Get the multiselect value
          .filter(([, multiSelect]) => multiSelect !== undefined) // Filter out empty multiselects
          .forEach(([rowId, multiSelect]) => Array.from(multiSelect.values())
            // eslint-disable-next-line no-plusplus
            .forEach((selectName) => statement.run([id++, rowId, selectName])));

        statement.finalize();
      });
    });
}

async function dbToSqlite(dbPath, dbId, secret) {
  // Retrieve the data from the database in Notion
  const table = dbToTable(await queryTimeLog(dbId, secret));

  // Write the data into SQLite
  const db = new sqlite3.Database(dbPath);
  // db.on('trace', (query) => console.log(query));
  writeTable(db, table);
  db.close();
}

function main() {
  const program = new Command();

  program
    .name('notion-db-to-sqlite')
    .description('Notion database to sqlite3 database')
    .version('1.0.0')
    .requiredOption('--configs <configs...>', 'Configuration files')
    .option('--output <name>', 'Output PDF path', 'timelog.sqlite3')
    .action(async (options) => {
      if (await fileExists(options.output)) {
        program.error('File already exists at output path');
      }

      const config = loadConfig(options.configs);

      const ajv = new Ajv();
      const validateConfig = ajv.compile(configSchema);
      const configValid = validateConfig(config);

      if (!configValid) {
        validateConfig.errors.forEach((err) => console.log(err.message));
        program.error('Config invalid');
      }

      await dbToSqlite(options.output, config.client.database, config.notion.secret);

      console.log(`Wrote database to ${options.output}`);
    });

  program.parse();
}

main();

module.exports = {
  dbToSqlite,
};
