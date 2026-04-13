'use strict';

/**
 * Runs an ordered list of compiler steps sequentially on a given context.
 * Each step is a method name that exists on the context object.
 * Steps are reorderable and conditionally includable without modifying callers.
 */
class CompilationPipeline {
  constructor(steps) {
    this.steps = steps;
  }

  run(context) {
    return this.steps.reduce(
      (promise, step) => promise.then(() => context[step]()),
      Promise.resolve(),
    );
  }
}

module.exports = CompilationPipeline;
