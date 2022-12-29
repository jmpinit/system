/**
 * Use Puppeteer to render a page for the invoice and save it as a PDF
 */

const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');
const Mustache = require('mustache');
const { makeTempFile, fileExists, roundTwo } = require('./util');

function formatDate(date) {
  return date.toLocaleDateString('en-US');
}

async function getPaymentTemplate(paymentMethod) {
  const paymentTemplatePath = path.join(__dirname, `./templates/${paymentMethod}.html`);

  // Assert that the payment template file exists
  if (!(await fileExists(paymentTemplatePath))) {
    throw new Error(`Payment method "${paymentMethod}" does not exist`);
  }

  return fs.readFile(paymentTemplatePath, 'utf-8');
}

async function renderToPDF(pagePath, pdfPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`file://${pagePath}`, { waitUntil: 'networkidle2' });
  await page.pdf({ path: pdfPath, format: 'A4' });

  await browser.close();
}

async function renderInvoice(templateFilePath, startDate, endDate, timeLog, config, outputPath) {
  const displayProject = config.client.fields === undefined
    ? true
    : config.client.fields.indexOf('Project') !== -1;

  // Format the time log
  const formattedTimeLog = timeLog.map(({ Description, Hours }) => ({
    Description,
    Hours: roundTwo(Hours),
  }));

  // Calculate report values

  const issueDate = formatDate(new Date()); // Today
  const totalMinutes = timeLog.reduce((minutes, entry) => minutes + entry.Minutes, 0);
  const totalHours = totalMinutes / 60;
  const paymentDue = totalHours * config.client.rate;

  // Summarize by project

  const hoursByProject = timeLog.reduce((projects, entry) => {
    const hours = (projects[entry.Project] || 0) + entry.Minutes / 60;
    return { ...projects, [entry.Project]: hours };
  }, {});

  const projectSummary = Object.entries(hoursByProject)
    .map(([project, hours]) => ({
      project: displayProject ? project : undefined,
      hours: roundTwo(hours),
      cost: `$${roundTwo(hours * config.client.rate)}`,
    }));

  // Fill in the payment details

  const paymentInfoTemplate = await getPaymentTemplate('pay-by-direct-deposit');
  const paymentInfo = Mustache.render(paymentInfoTemplate, config);

  // Create a temporary HTML file to fill with the data for the invoice
  // const htmlPath = await makeTempFile({ postfix: '.html' });
  const htmlPath = '/tmp/index.html';

  // Read the template and fill it with the invoice data

  const template = await fs.readFile(templateFilePath, 'utf-8');

  // Write the templated HTML page

  const templated = Mustache.render(template, {
    client: config.client.name,
    issueDate,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    myName: config.user.name,
    totalHours: roundTwo(totalHours),
    rate: config.client.rate,
    paymentDue: roundTwo(paymentDue),
    paymentMethod: 'Direct Deposit',
    displayProject,
    projectSummary: displayProject ? projectSummary : undefined,
    timeLog: formattedTimeLog,
    paymentInfo,
  });
  await fs.writeFile(htmlPath, templated, 'utf-8');

  // Render the templated HTML page and save as PDF
  await renderToPDF(htmlPath, outputPath);
}

module.exports = {
  renderInvoice,
};
