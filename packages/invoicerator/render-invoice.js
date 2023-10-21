/**
 * Use Puppeteer to render a page for the invoice and save it as a PDF
 */

const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');
const Mustache = require('mustache');
const { makeTempFile, fileExists, roundTwo, roundUpTwo } = require('./util');
const { calculateReportValues } = require('./calculate-report');

function formatDate(date) {
  // HACK:
  // Dates are assumed to be recorded in America/New_York time but are stored as UTC
  // so when we format them we need to use a timezone with a UTC offset of zero
  return date.toLocaleDateString('en-US', { timeZone: 'Africa/Abidjan' });
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

async function renderInvoiceHTML(templateFilePath, startDate, endDate, timeLog, config) {
  const displayProject = config.client.fields === undefined
    ? true
    : config.client.fields.indexOf('Project') !== -1;

  // Fill in the payment details

  let paymentInfo; // Payment info is optional

  if (config.client.paymentMethod !== undefined) {
    const paymentInfoTemplate = await getPaymentTemplate(config.client.paymentMethod);
    paymentInfo = Mustache.render(paymentInfoTemplate, config);
  }

  // Create a temporary HTML file to fill with the data for the invoice
  const htmlPath = await makeTempFile({ postfix: '.html' });

  // Read the template and fill it with the invoice data

  const template = await fs.readFile(templateFilePath, 'utf-8');

  // Write the templated HTML page

  const {
    workStartDate,
    workEndDate,
    totalHours,
    discountedHours,
    paymentDue,
    projectSummary,
    formattedTimeLog,
  } = calculateReportValues(timeLog, config.client.rate);

  const templated = Mustache.render(template, {
    client: config.client.name,
    issueDate: formatDate(new Date()), // Today
    // Handle the case where all the work happened on one day
    sameDay: workStartDate.getTime() === workEndDate.getTime(),
    startDate: formatDate(workStartDate),
    endDate: formatDate(workEndDate),
    myName: config.user.name,
    totalHours: roundUpTwo(totalHours),
    discountedHours: roundUpTwo(discountedHours),
    rate: config.client.rate,
    paymentDue: roundTwo(paymentDue),
    displayProject,
    projectSummary: displayProject ? projectSummary : undefined,
    timeLog: formattedTimeLog,
    paymentInfo,
  });

  await fs.writeFile(htmlPath, templated, 'utf-8');

  return htmlPath;
}

async function renderInvoicePDF(templateFilePath, startDate, endDate, timeLog, config, outputPath) {
  const htmlPath = await renderInvoiceHTML(templateFilePath, startDate, endDate, timeLog, config);

  // Render the templated HTML page and save as PDF
  await renderToPDF(htmlPath, outputPath);
}

module.exports = {
  renderInvoicePDF,
  renderInvoiceHTML,
};
