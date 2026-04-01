'use strict';

const fs = require('node:fs');
const nodePath = require('node:path');
const fse = require('fs-extra');
const sinon = require('sinon');
const AwsProvider = require('osls/lib/plugins/aws/provider');

// Mirrors serverless/lib/utils/fs/readFileSync: reads and auto-parses JSON files.
function readFileSync(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    return JSON.parse(contents);
  }
  return contents.trim();
}

// Mirrors serverless/lib/utils/fs/writeFileSync: creates parent dirs before writing.
function writeFileSync(filePath, data) {
  fse.mkdirsSync(nodePath.dirname(filePath));
  const contents = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, contents);
}

/**
 * Returns a minimal Serverless-compatible stub that works with both
 * Serverless Framework v2 and v3 without importing from internal paths
 * that changed between versions (lib/Serverless, lib/classes/CLI).
 *
 * The stub satisfies the AwsProvider constructor and exposes the same
 * surface area that the plugin and its tests rely on:
 *   serverless.service, .cli, .configSchemaHandler, .servicePath,
 *   .setProvider(), .getProvider()
 *
 * All stub methods wrap real implementations via callsFake() so they
 * behave correctly by default but remain assertable and overridable
 * in tests. cli.log/consoleLog are plain functions (not stubs) to
 * avoid sinon double-wrap errors when tests spy on logger.log after
 * logger.config() assigns cli.consoleLog to it.
 */
function createServerless() {
  const providers = new Map();

  const serverless = {
    service: {
      service: 'step-functions',
      provider: {
        name: 'aws',
        stage: 'dev',
        region: 'us-east-1',
        compiledCloudFormationTemplate: { Resources: {} },
      },
      functions: {},
      resources: {},
      getFunction(name) {
        return this.functions[name];
      },
    },
    utils: {
      readFileSync: sinon.stub().callsFake((filePath) => readFileSync(filePath)),
      writeFileSync: sinon.stub().callsFake((filePath, data) => writeFileSync(filePath, data)),
      fileExistsSync: sinon.stub().callsFake((filePath) => fse.existsSync(filePath)),
    },
    configurationInput: {},
    serviceDir: process.cwd(),
    servicePath: true,
    cli: { log: () => {}, consoleLog: () => {} },
    pluginManager: { cliOptions: { stage: 'dev', region: 'us-east-1' } },
    config: { servicePath: process.cwd() },
    configSchemaHandler: {
      defineTopLevelProperty: sinon.stub(),
      defineFunctionProperties: sinon.stub(),
      defineCustomProperties: sinon.stub(),
      defineProvider: sinon.stub(),
    },
    getVersion() {
      return '3.0.0';
    },
    logDeprecation: sinon.stub(),
    classes: { Error },
    setProvider(name, provider) {
      providers.set(name, provider);
    },
    getProvider(name) {
      return providers.get(name);
    },
  };

  serverless.setProvider('aws', new AwsProvider(serverless, {}));

  return serverless;
}

module.exports = createServerless;
