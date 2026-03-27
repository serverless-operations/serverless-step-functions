'use strict';

function getPermissions() {
  return [{ action: 'ses:SendEmail', resource: '*' }];
}

module.exports = { getPermissions };
