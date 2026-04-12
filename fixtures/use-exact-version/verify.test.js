'use strict';

const fs = require('node:fs');
const path = require('node:path');
const expect = require('chai').expect;

const templatePath = path.join(__dirname, '.serverless', 'cloudformation-template-update-stack.json');

describe('use-exact-version fixture — CloudFormation template', () => {
  let resources;

  before(() => {
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    resources = template.Resources;
  });

  it('should create a layer-aware AWS::Lambda::Version resource for the function with layers', () => {
    // When useExactVersion: true and the function has layers, the plugin creates a new
    // AWS::Lambda::Version resource whose logical ID incorporates a hash of the layer
    // version logical IDs. This ensures a new version is published (and the state
    // machine DefinitionString changes) whenever layers are updated — even if the
    // function's own code artifact is unchanged.
    const layerAwareVersionLogicalId = Object.keys(resources).find(
      (k) => resources[k].Type === 'AWS::Lambda::Version'
        && /L[0-9a-f]{8}$/.test(k)
        && resources[k].Properties.FunctionName.Ref === 'HelloLambdaFunction',
    );

    expect(
      layerAwareVersionLogicalId,
      'should have a layer-aware AWS::Lambda::Version resource (logical ID ending in L + 8 hex chars)',
    ).to.not.equal(undefined);
  });

  it('should reference the layer-aware version (not the plain SF version) in the state machine definition', () => {
    // Find the layer-aware version resource logical ID.
    const layerAwareVersionLogicalId = Object.keys(resources).find(
      (k) => resources[k].Type === 'AWS::Lambda::Version'
        && /L[0-9a-f]{8}$/.test(k)
        && resources[k].Properties.FunctionName.Ref === 'HelloLambdaFunction',
    );
    expect(layerAwareVersionLogicalId, 'layer-aware version resource must exist').to.not.equal(undefined);

    // Find the state machine resource.
    const stateMachine = Object.values(resources).find(
      (r) => r.Type === 'AWS::StepFunctions::StateMachine',
    );
    expect(stateMachine, 'state machine must exist').to.not.equal(undefined);

    const { DefinitionString } = stateMachine.Properties;
    expect(DefinitionString, 'DefinitionString must be an Fn::Sub').to.haveOwnProperty('Fn::Sub');
    expect(Array.isArray(DefinitionString['Fn::Sub']), 'Fn::Sub must be array form').to.equal(true);

    const [, params] = DefinitionString['Fn::Sub'];
    const referencedVersionLogicalIds = Object.values(params)
      .filter((v) => v && v.Ref)
      .map((v) => v.Ref)
      .filter((ref) => resources[ref] && resources[ref].Type === 'AWS::Lambda::Version');

    expect(
      referencedVersionLogicalIds,
      'state machine Fn::Sub params must reference at least one Lambda version',
    ).to.have.length.greaterThan(0);

    expect(
      referencedVersionLogicalIds,
      'state machine must reference the layer-aware version, not the plain SF version',
    ).to.include(layerAwareVersionLogicalId);

    // The plain SF-generated version (without layer hash suffix) must NOT be directly
    // referenced by the state machine — the layer-aware one replaces it.
    const plainSFVersionLogicalId = layerAwareVersionLogicalId.replace(/L[0-9a-f]{8}$/, '');
    expect(
      referencedVersionLogicalIds,
      'state machine must not reference the plain SF version directly',
    ).to.not.include(plainSFVersionLogicalId);
  });

  it('should have the AWS::Lambda::LayerVersion resource for the utils layer', () => {
    const layerVersion = Object.values(resources).find(
      (r) => r.Type === 'AWS::Lambda::LayerVersion',
    );
    expect(layerVersion, 'utils layer version resource must exist').to.not.equal(undefined);
  });
});
