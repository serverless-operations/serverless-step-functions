'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const utils = require('./utils');

describe('utils', () => {
  describe('#setTimeout()', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers(new Date(Date.UTC(2016, 9, 1)).getTime());
    });

    afterEach(() => {
      clock.restore();
    });

    it('should do settimeout', () => {
      utils.setTimeout().then((result) =>
        expect(result).to.be.undefined);
      clock.tick(5000);
    });
  });
});
