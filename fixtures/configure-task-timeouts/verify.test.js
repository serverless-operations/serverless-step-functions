'use strict';

const fs = require('node:fs');
const path = require('node:path');
const expect = require('chai').expect;

const templatePath = path.join(__dirname, '.serverless', 'cloudformation-template-update-stack.json');

const findStateMachine = (resources, namePrefix) => {
  const entry = Object.values(resources).find(
    (r) => r.Type === 'AWS::StepFunctions::StateMachine'
      && typeof r.Properties.StateMachineName === 'string'
      && r.Properties.StateMachineName.startsWith(namePrefix),
  );
  return entry || null;
};

const parseDefinition = (stateMachine) => {
  const ds = stateMachine.Properties.DefinitionString;
  if (typeof ds === 'string') return JSON.parse(ds);
  const sub = ds['Fn::Sub'];
  return JSON.parse(Array.isArray(sub) ? sub[0] : sub);
};

describe('configure-task-timeouts fixture — CloudFormation template', () => {
  let resources;

  before(() => {
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    resources = template.Resources;
  });

  describe('autoTimeoutsMachine (configureTaskTimeouts: true)', () => {
    let definition;

    before(() => {
      const sm = findStateMachine(resources, 'integration-configure-task-timeouts-');
      expect(sm, 'auto-timeouts state machine should exist').to.not.equal(null);
      definition = parseDefinition(sm);
    });

    it('injects TimeoutSeconds for legacy direct invoke (Resource: Fn::GetAtt) using function.timeout', () => {
      expect(definition.States.DirectInvoke.TimeoutSeconds).to.equal(12);
    });

    it('injects TimeoutSeconds for service-integration lambda:invoke using function.timeout', () => {
      expect(definition.States.ServiceIntegration.TimeoutSeconds).to.equal(90);
    });

    it('preserves a user-set TimeoutSeconds and does not overwrite it', () => {
      expect(definition.States.UserSetTimeout.TimeoutSeconds).to.equal(5);
    });

    it('falls back to the Serverless Framework default (6s) when the function has no timeout configured', () => {
      const nested = definition.States.ParallelStep.Branches[0].States.NestedTask;
      expect(nested.TimeoutSeconds).to.equal(6);
    });
  });

  describe('backCompatMachine (configureTaskTimeouts unset)', () => {
    it('does not inject TimeoutSeconds when the flag is off', () => {
      const sm = findStateMachine(resources, 'integration-back-compat-task-timeouts-');
      expect(sm, 'back-compat state machine should exist').to.not.equal(null);
      const definition = parseDefinition(sm);
      expect(definition.States.NoInjection.TimeoutSeconds).to.equal(undefined);
    });
  });
});
