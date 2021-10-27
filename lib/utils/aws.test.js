const expect = require('chai').expect;
const AwsUtils = require('./aws');

describe('#awsUtils', () => {
  describe('#trimAliasFromLambdaArn', () => {
    it('should return the resource if it is an intrinsic function', () => {
      const resource = {
        'Fn::Sub': 'arn:aws:lambda:us-east-1:1111:function:testLambda',
      };
      expect(AwsUtils.trimAliasFromLambdaArn(resource)).to.equal(resource);
    });

    it('should return the resource if it is not a lambda arn', () => {
      const resource = 'arn:aws:dynamodb:us-east-1:1111:table/testTable';
      expect(AwsUtils.trimAliasFromLambdaArn(resource)).to.equal('arn:aws:dynamodb:us-east-1:1111:table/testTable');
    });

    it('should return the lambda arn if is not aliased.', () => {
      const resource = 'arn:aws:lambda:us-east-1:1111:function:testLambda:testLambda';
      expect(AwsUtils.trimAliasFromLambdaArn(resource)).to.equal('arn:aws:lambda:us-east-1:1111:function:testLambda');
    });

    it('should trim off the alias from the lambda ARN.', () => {
      const resource = 'arn:aws:lambda:us-east-1:1111:function:testLambda:testAlias';
      expect(AwsUtils.trimAliasFromLambdaArn(resource)).to.equal('arn:aws:lambda:us-east-1:1111:function:testLambda');
    });

    it('should trim off the alias from the lambda gov cloud ARN.', () => {
      const resource = 'arn:aws-us-gov:lambda:us-east-1:1111:function:testLambda:testAlias';
      expect(AwsUtils.trimAliasFromLambdaArn(resource)).to.equal('arn:aws-us-gov:lambda:us-east-1:1111:function:testLambda');
    });

    it('should trim off the alias from the lambda Chinese ARN.', () => {
      const resource = 'arn:aws-cn:lambda:us-east-1:1111:function:testLambda:testAlias';
      expect(AwsUtils.trimAliasFromLambdaArn(resource)).to.equal('arn:aws-cn:lambda:us-east-1:1111:function:testLambda');
    });
  });
});
