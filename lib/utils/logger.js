'use strict';

class Logger {
  constructor(serverless, v3Api) {
    if (v3Api) {
      this.log = v3Api.log;
    } else {
      this.log = serverless.cli && serverless.cli.consoleLog;
    }
  }
}

module.exports = Logger;
