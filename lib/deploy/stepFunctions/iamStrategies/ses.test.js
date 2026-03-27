'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./ses');

describe('ses strategy', () => {
  it('should give ses:SendEmail permission on *', () => {
    const result = getPermissions();
    expect(result).to.deep.equal([{ action: 'ses:SendEmail', resource: '*' }]);
  });
});
