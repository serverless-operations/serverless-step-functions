'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const CompilationPipeline = require('./compilationPipeline');

describe('CompilationPipeline', () => {
  it('should call all steps in order', async () => {
    const callOrder = [];
    const context = {
      stepA: sinon.stub().callsFake(() => {
        callOrder.push('A');
        return Promise.resolve();
      }),
      stepB: sinon.stub().callsFake(() => {
        callOrder.push('B');
        return Promise.resolve();
      }),
      stepC: sinon.stub().callsFake(() => {
        callOrder.push('C');
        return Promise.resolve();
      }),
    };

    const pipeline = new CompilationPipeline(['stepA', 'stepB', 'stepC']);
    await pipeline.run(context);

    expect(callOrder).to.deep.equal(['A', 'B', 'C']);
  });

  it('should call each step on the given context', async () => {
    const context = {
      step: sinon.stub().returns(Promise.resolve()),
    };

    const pipeline = new CompilationPipeline(['step']);
    await pipeline.run(context);

    expect(context.step.callCount).to.equal(1);
  });

  it('should wait for an async step to resolve before calling the next', async () => {
    let firstResolved = false;
    const context = {
      stepA: sinon.stub().returns(
        new Promise((resolve) => {
          setTimeout(() => {
            firstResolved = true;
            resolve();
          }, 10);
        }),
      ),
      stepB: sinon.stub().callsFake(() => {
        expect(firstResolved).to.equal(true);
        return Promise.resolve();
      }),
    };

    const pipeline = new CompilationPipeline(['stepA', 'stepB']);
    await pipeline.run(context);

    expect(context.stepB.callCount).to.equal(1);
  });

  it('should resolve immediately with an empty steps array', async () => {
    const pipeline = new CompilationPipeline([]);
    await pipeline.run({});
  });
});
