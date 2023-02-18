const path = require('path');
const fs = require('fs');
const { renderInvoiceHTML } = require('../render-invoice');

test('Generate HTML for each template', () => {
  const templateDir = path.join(__dirname, '../templates');
  const templateFiles = fs.readdirSync(templateDir)
    .map((file) => path.join(templateDir, file));

  const startDate = new Date('2021-01-01');
  const endDate = new Date('2021-02-01');

  const timeLog = [
    {Project: 'Project 1', Description: 'Description 1', Hours: 1},
    {Project: 'Project 2', Description: 'Description 2', Hours: 2},
  ];
  const config = {
    user: {
      name: 'Bob',
    },
    client: {
      name: 'Acme',
      address: '123 Main St',
      rate: 100,
    },
  };

  templateFiles
    .forEach((templateFile) => expect(
      () => renderInvoiceHTML(templateFile, startDate, endDate, timeLog, config),
    ).not.toThrow());
});
