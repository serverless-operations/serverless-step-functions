const expect = require('chai').expect;
const ArnUtils = require('./arn');

describe('#arnUtils', () => {
  describe('#getArnPartition', () => {
    it('should return aws-us-gov partition for Gov Cloud regions.', () => {
      expect(ArnUtils.getArnPartition('us-gov-east-1')).to.equal('aws-us-gov');
      expect(ArnUtils.getArnPartition('us-gov-west-1')).to.equal('aws-us-gov');
    });

    it('should return aws-cn for chinese AWS regions', () => {
      expect(ArnUtils.getArnPartition('cn-north-1')).to.equal('aws-cn');
      expect(ArnUtils.getArnPartition('cn-northwest-1')).to.equal('aws-cn');
    });

    it('should return aws for standard AWS regions', () => {
      expect(ArnUtils.getArnPartition('us-east-1')).to.equal('aws');
      expect(ArnUtils.getArnPartition('ap-east-1')).to.equal('aws');
    });
  });
});
