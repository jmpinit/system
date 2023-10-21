/**
 * Use Puppeteer to render a page for the invoice and save it as a PDF
 */

const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');
const Mustache = require('mustache');
const { makeTempFile, fileExists, roundTwo, roundUpTwo } = require('./util');

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

  // Format the time log
  const formattedTimeLog = timeLog.map(({ Project, Description, Minutes }) => ({
    Project,
    Description,
    Hours: roundUpTwo(Minutes / 60),
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

  // Find when the work started and ended exactly
  // This can be different than the window of time specified to search for work
  const workDates = timeLog.map((entry) => entry.Date);
  const workStartDate = new Date(Math.min(...workDates));
  const workEndDate = new Date(Math.max(...workDates));

  const projectSummary = Object.entries(hoursByProject)
    .map(([project, hours]) => ({
      project: displayProject ? project : undefined,
      hours: roundUpTwo(hours),
      cost: `$${roundTwo(hours * config.client.rate)}`,
    }));

  // Sort the projects in the summary by hours in descending order
  projectSummary.sort((a, b) => (parseFloat(a.hours) < parseFloat(b.hours) ? 1 : -1));

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

  const templated = Mustache.render(template, {
    client: config.client.name,
    issueDate,
    // Handle the case where all the work happened on one day
    sameDay: workStartDate.getTime() === workEndDate.getTime(),
    startDate: formatDate(workStartDate),
    endDate: formatDate(workEndDate),
    myName: config.user.name,
    totalHours: roundUpTwo(totalHours),
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
