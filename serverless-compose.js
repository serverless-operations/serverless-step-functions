'use strict';

// This file must live at the repo root so that `osls deploy` can find it
// (osls compose uses lstat, which does not follow symlinks, so a symlink here
// would not work). The real configuration lives in fixtures/serverless-compose.js
// — edit that file, not this one.
module.exports = require('./fixtures/serverless-compose');
