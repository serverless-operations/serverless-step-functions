'use strict';
const BbPromise = require('bluebird');

module.exports = {
  setTimeout() {
    return new BbPromise((resolve) => {
      setTimeout(resolve, 5000);
    });
  },
};
