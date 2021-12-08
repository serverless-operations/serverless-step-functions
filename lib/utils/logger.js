'use strict';

class Logger {
  config(serverless, v3Api) {
    if (v3Api) {
      this.log = v3Api.log;
    } else {
      this.log = serverless.cli && serverless.cli.consoleLog;
    }

    return this;
  }
}

module.exports = new Logger();
