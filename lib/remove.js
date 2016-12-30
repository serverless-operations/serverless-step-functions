'use strict';
const BbPromise = require('bluebird');

module.exports = {
  remove() {
    BbPromise.bind(this)
    .then(this.getStateMachineArn)
    .then(this.deleteStateMachine);

    return BbPromise.resolve();
  },
};
