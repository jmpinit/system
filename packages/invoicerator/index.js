const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const yaml = require('js-yaml');
const { Command } = require('commander');
const { getEntriesBetween } = require('./from-sqlite3');
const { renderInvoicePDF } = require('./render-invoice');
const { fileExists } = require('./util');
const { validateConfig } = require('./config');

const templateFilePath = path.join(__dirname, './templates/main-template.html');

function parseDate(dateString) {
  const millis = Date.parse(dateString);

  if (Number.isNaN(millis)) {
    throw new Error('Invalid date');
  }

  return new Date(millis);
}

function loadConfig(fileNames) {
  return fileNames.reduce((config, fn) => {
    const part = yaml.load(fs.readFileSync(fn, 'utf8'));
    return { ...config, ...part };
  }, {});
}

async function main() {
  const program = new Command();

  program
    .name('invoicerator')
    .description('Generate PDF invoices from time and expense logs')
    .version('1.0.0')
    .option('--start <date>', 'Start date', parseDate, new Date(0))
    .option('--end <date>', 'End date (inclusive)', parseDate, new Date())
    .requiredOption('--configs <configs...>', 'Configuration files')
    .option('--output <name>', 'Output PDF path', 'invoice.pdf')
    .argument('<sqlite time log>')
    .action(async (timeLogPath, options) => {
      if (!(await fileExists(timeLogPath))) {
        program.error('Time log SQLite3 database file does not exist');
      }

      const config = loadConfig(options.configs);

      const configValid = validateConfig(config);

      if (!configValid) {
        validateConfig.errors.forEach((err) => console.log(err.message));
        program.error('Config invalid');
      }

      const db = new sqlite3.Database(timeLogPath);
      const timeLogEntries = await getEntriesBetween(db, options.start, options.end);
      await renderInvoicePDF(
        templateFilePath,
        options.start,
        options.end,
        timeLogEntries,
        config,
        options.output,
      );
      db.close();

      console.log(`Generated "${options.output}"`);
    });

  program.parse();
}

main().then();
