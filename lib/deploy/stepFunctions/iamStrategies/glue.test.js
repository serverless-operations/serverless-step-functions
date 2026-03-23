'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./glue');

describe('glue strategy', () => {
  it('should return glue:StartJobRun/GetJobRun/GetJobRuns/BatchStopJobRun permissions on *', () => {
    const result = getPermissions();
    expect(result).to.have.lengthOf(1);
    expect(result[0].action).to.equal('glue:StartJobRun,glue:GetJobRun,glue:GetJobRuns,glue:BatchStopJobRun');
    expect(result[0].resource).to.equal('*');
  });
});
