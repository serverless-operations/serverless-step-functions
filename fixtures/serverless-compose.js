'use strict';

const fs = require('node:fs');
const path = require('node:path');

const fixturesDir = __dirname;

const services = fs
  .readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => fs.existsSync(path.join(fixturesDir, entry.name, 'serverless.yml')))
  .reduce((acc, entry) => {
    acc[entry.name] = { path: path.join(fixturesDir, entry.name) };
    return acc;
  }, {});

module.exports = { services };
