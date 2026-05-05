'use strict';

const assert = require('node:assert/strict');
const configureTaskTimeouts = require('./configureTaskTimeouts');

const { planTaskTimeouts, applyTaskTimeoutDecisions } = configureTaskTimeouts;

const upperFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const getLambdaLogicalId = (key) => `${upperFirst(key)}LambdaFunction`;

const buildDefinition = (states) => ({ StartAt: Object.keys(states)[0], States: states });

describe('planTaskTimeouts', () => {
  it('plans an inject for service-integration lambda:invoke (Fn::GetAtt)', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke',
        Parameters: { FunctionName: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] } },
        End: true,
      },
    });
    const functions = { hello: { timeout: 30 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan, [{
      action: 'inject',
      statePath: ['States', 'Hello'],
      stateName: 'Hello',
      fnKey: 'hello',
      lambdaTimeout: 30,
    }]);
  });

  it('plans an inject for legacy direct invoke (Resource: Fn::GetAtt)', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        End: true,
      },
    });
    const functions = { hello: { timeout: 45 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.equal(plan.length, 1);
    assert.equal(plan[0].lambdaTimeout, 45);
  });

  it('resolves Ref by serverless function key (waitForTaskToken variant)', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: 'arn:aws:states:::lambda:invoke.waitForTaskToken',
        Parameters: { FunctionName: { Ref: 'hello' } },
        End: true,
      },
    });
    const functions = { hello: { timeout: 12 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.equal(plan[0].lambdaTimeout, 12);
  });

  it('falls back to Serverless Framework default of 6 seconds when nothing is set', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        End: true,
      },
    });
    const functions = { hello: { handler: 'h.fn' } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.equal(plan[0].lambdaTimeout, 6);
  });

  it('falls back to provider.timeout when function has no explicit timeout', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        End: true,
      },
    });
    const functions = { hello: { handler: 'h.fn' } };

    const plan = planTaskTimeouts({
      definition, functions, providerTimeout: 60, getLambdaLogicalId,
    });

    assert.equal(plan[0].lambdaTimeout, 60);
  });

  it('prefers function.timeout over provider.timeout', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        End: true,
      },
    });
    const functions = { hello: { timeout: 15 } };

    const plan = planTaskTimeouts({
      definition, functions, providerTimeout: 60, getLambdaLogicalId,
    });

    assert.equal(plan[0].lambdaTimeout, 15);
  });

  it('emits no decision when user TimeoutSeconds <= lambda timeout', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        TimeoutSeconds: 10,
        End: true,
      },
    });
    const functions = { hello: { timeout: 30 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan, []);
  });

  it('plans warn-overlong when user TimeoutSeconds is strictly greater than lambda timeout', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        TimeoutSeconds: 60,
        End: true,
      },
    });
    const functions = { hello: { timeout: 30 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan, [{
      action: 'warn-overlong',
      statePath: ['States', 'Hello'],
      stateName: 'Hello',
      fnKey: 'hello',
      lambdaTimeout: 30,
      userTimeout: 60,
    }]);
  });

  it('emits no decision when user TimeoutSeconds equals the lambda timeout', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        TimeoutSeconds: 30,
        End: true,
      },
    });
    const functions = { hello: { timeout: 30 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan, []);
  });

  it('emits no decision when TimeoutSecondsPath is set (runtime value unknown)', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        TimeoutSecondsPath: '$.maxTime',
        End: true,
      },
    });
    const functions = { hello: { timeout: 30 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan, []);
  });

  it('skips Task states that do not reference a project Lambda', () => {
    const definition = buildDefinition({
      Sns: {
        Type: 'Task',
        Resource: 'arn:aws:states:::sns:publish',
        Parameters: { TopicArn: 'arn:aws:sns:us-east-1:1:t', Message: 'hi' },
        End: true,
      },
      Foreign: {
        Type: 'Task',
        Resource: 'arn:aws:lambda:us-east-1:1234567890:function:not-mine',
        End: true,
      },
    });
    const functions = { hello: { timeout: 30 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan, []);
  });

  it('addresses nested states under Parallel branches with full statePath', () => {
    const definition = buildDefinition({
      P: {
        Type: 'Parallel',
        End: true,
        Branches: [
          {
            StartAt: 'A',
            States: {
              A: {
                Type: 'Task',
                Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
                End: true,
              },
            },
          },
          {
            StartAt: 'B',
            States: {
              B: {
                Type: 'Task',
                Resource: 'arn:aws:states:::lambda:invoke',
                Parameters: { FunctionName: { Ref: 'world' } },
                End: true,
              },
            },
          },
        ],
      },
    });
    const functions = { hello: { timeout: 15 }, world: { timeout: 25 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan.map((d) => d.statePath), [
      ['States', 'P', 'Branches', 0, 'States', 'A'],
      ['States', 'P', 'Branches', 1, 'States', 'B'],
    ]);
    assert.deepEqual(plan.map((d) => d.lambdaTimeout), [15, 25]);
  });

  it('addresses nested states under Map ItemProcessor', () => {
    const definition = buildDefinition({
      M: {
        Type: 'Map',
        End: true,
        ItemProcessor: {
          StartAt: 'Inner',
          States: {
            Inner: {
              Type: 'Task',
              Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
              End: true,
            },
          },
        },
      },
    });
    const functions = { hello: { timeout: 7 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan[0].statePath, ['States', 'M', 'ItemProcessor', 'States', 'Inner']);
  });

  it('addresses nested states under Map Iterator (legacy)', () => {
    const definition = buildDefinition({
      M: {
        Type: 'Map',
        End: true,
        Iterator: {
          StartAt: 'Inner',
          States: {
            Inner: {
              Type: 'Task',
              Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
              End: true,
            },
          },
        },
      },
    });
    const functions = { hello: { timeout: 8 } };

    const plan = planTaskTimeouts({ definition, functions, getLambdaLogicalId });

    assert.deepEqual(plan[0].statePath, ['States', 'M', 'Iterator', 'States', 'Inner']);
  });

  it('returns an empty plan for missing or stateless definitions', () => {
    assert.deepEqual(planTaskTimeouts({
      definition: undefined, functions: {}, getLambdaLogicalId,
    }), []);
    assert.deepEqual(planTaskTimeouts({
      definition: {}, functions: {}, getLambdaLogicalId,
    }), []);
  });

  it('does not mutate the input definition', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        End: true,
      },
    });
    const before = JSON.stringify(definition);

    planTaskTimeouts({
      definition, functions: { hello: { timeout: 30 } }, getLambdaLogicalId,
    });

    assert.equal(JSON.stringify(definition), before);
  });
});

describe('applyTaskTimeoutDecisions', () => {
  it('writes TimeoutSeconds at the decision statePath for inject decisions', () => {
    const definition = buildDefinition({
      Hello: { Type: 'Task', End: true },
      P: {
        Type: 'Parallel',
        End: true,
        Branches: [{ StartAt: 'B', States: { B: { Type: 'Task', End: true } } }],
      },
    });
    const decisions = [
      {
        action: 'inject', statePath: ['States', 'Hello'], stateName: 'Hello', fnKey: 'h', lambdaTimeout: 30,
      },
      {
        action: 'inject', statePath: ['States', 'P', 'Branches', 0, 'States', 'B'], stateName: 'B', fnKey: 'b', lambdaTimeout: 12,
      },
    ];

    applyTaskTimeoutDecisions({
      definition, decisions, stateMachineName: 'sm', log: () => {},
    });

    assert.equal(definition.States.Hello.TimeoutSeconds, 30);
    assert.equal(definition.States.P.Branches[0].States.B.TimeoutSeconds, 12);
  });

  it('routes warn-overlong decisions through the log callback', () => {
    const messages = [];
    const definition = buildDefinition({
      Hello: { Type: 'Task', TimeoutSeconds: 60, End: true },
    });
    const decisions = [{
      action: 'warn-overlong',
      statePath: ['States', 'Hello'],
      stateName: 'Hello',
      fnKey: 'hello',
      lambdaTimeout: 30,
      userTimeout: 60,
    }];

    applyTaskTimeoutDecisions({
      definition, decisions, stateMachineName: 'mysm', log: (m) => messages.push(m),
    });

    assert.equal(definition.States.Hello.TimeoutSeconds, 60);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /mysm/);
    assert.match(messages[0], /Hello/);
    assert.match(messages[0], /60s/);
    assert.match(messages[0], /30s/);
  });
});

describe('configureTaskTimeouts (orchestrator)', () => {
  it('plans, applies, and returns the decision list', () => {
    const definition = buildDefinition({
      Hello: {
        Type: 'Task',
        Resource: { 'Fn::GetAtt': ['HelloLambdaFunction', 'Arn'] },
        End: true,
      },
    });

    const plan = configureTaskTimeouts({
      definition,
      functions: { hello: { timeout: 30 } },
      getLambdaLogicalId,
      stateMachineName: 'sm',
    });

    assert.equal(definition.States.Hello.TimeoutSeconds, 30);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].action, 'inject');
  });
});
