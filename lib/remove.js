'use strict';
const BbPromise = require('bluebird');

module.exports = {
  remove() {
    BbPromise.bind(this)
    .then(this.getStateMachineArn)
    .then(this.deleteStateMachine)
    .then(() => {
      this.serverless.cli.log(`Remove ${this.options.state}`);
      return BbPromise.resolve();
    });

    return BbPromise.resolve();
  },
};
