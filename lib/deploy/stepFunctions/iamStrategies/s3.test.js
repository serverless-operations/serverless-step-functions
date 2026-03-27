'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./s3');

describe('s3 strategy', () => {
  it('should give s3:GetObject permission for specific bucket and key', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:s3:getObject',
      Parameters: {
        Bucket: 'test-bucket',
        Key: 'hello.txt',
      },
    };
    const result = getPermissions('s3:GetObject', state);
    expect(result).to.deep.equal([{
      action: 's3:GetObject',
      resource: [{ 'Fn::Sub': 'arn:${AWS::Partition}:s3:::test-bucket/hello.txt' }],
    }]);
  });

  it('should give s3:PutObject permission for specific bucket and key', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:s3:putObject',
      Parameters: {
        Bucket: 'test-bucket',
        Key: 'world.txt',
        Body: {},
      },
    };
    const result = getPermissions('s3:PutObject', state);
    expect(result).to.deep.equal([{
      action: 's3:PutObject',
      resource: [{ 'Fn::Sub': 'arn:${AWS::Partition}:s3:::test-bucket/world.txt' }],
    }]);
  });

  it('should give s3:listObjectsV2 permissions for bucket', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::s3:listObjectsV2',
      Parameters: {
        Bucket: 'my-bucket',
        Prefix: 'data/',
      },
    };
    const result = getPermissions('s3:listObjectsV2', state);
    expect(result).to.have.lengthOf(2);
    expect(result[0].action).to.equal('s3:Get*');
    expect(result[1].action).to.equal('s3:List*');
    expect(result[0].resource[0]).to.deep.equal({ 'Fn::Sub': 'arn:${AWS::Partition}:s3:::my-bucket' });
    expect(result[0].resource[1]).to.deep.equal({ 'Fn::Sub': 'arn:${AWS::Partition}:s3:::my-bucket/*' });
  });

  it('should use Fn::Sub array form when Bucket is a Ref', () => {
    const bucketRef = { Ref: 'MyS3Bucket' };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:s3:getObject',
      Parameters: {
        Bucket: bucketRef,
        Key: 'test-key.txt',
      },
    };
    const result = getPermissions('s3:GetObject', state);
    expect(result[0].resource[0]).to.deep.equal({
      'Fn::Sub': [
        'arn:${AWS::Partition}:s3:::${bucket}/test-key.txt',
        { bucket: bucketRef },
      ],
    });
  });

  it('should use Fn::Sub array form for listObjectsV2 when Bucket is a Ref', () => {
    const bucketRef = { Ref: 'MyS3Bucket' };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::s3:listObjectsV2',
      Parameters: {
        Bucket: bucketRef,
        Prefix: 'data',
      },
    };
    const result = getPermissions('s3:listObjectsV2', state);
    expect(result[0].resource[0]).to.deep.equal({
      'Fn::Sub': [
        'arn:${AWS::Partition}:s3:::${bucket}',
        { bucket: bucketRef },
      ],
    });
    expect(result[0].resource[1]).to.deep.equal({
      'Fn::Sub': [
        'arn:${AWS::Partition}:s3:::${bucket}/*',
        { bucket: bucketRef },
      ],
    });
  });

  it('should include prefix in ResultWriter resource (Prefix parameter treated as key prefix)', () => {
    const state = {
      Type: 'Map',
      ResultWriter: {
        Resource: 'arn:aws:states:::s3:putObject',
        Parameters: {
          Bucket: 'test-bucket',
          Prefix: 'results',
        },
      },
      Parameters: {
        Bucket: 'test-bucket',
        Prefix: 'results',
      },
    };
    // getPermissions uses state.Parameters.Prefix when present
    const result = getPermissions('s3:PutObject', state);
    expect(result[0].resource[0]).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:s3:::test-bucket/results/*',
    });
  });

  it('should use Fn::Sub array form for ResultWriter with reference bucket', () => {
    const bucketRef = { Ref: 'MyS3Bucket' };
    const state = {
      Parameters: {
        Bucket: bucketRef,
        Prefix: 'results',
      },
    };
    const result = getPermissions('s3:PutObject', state);
    expect(result[0].resource[0]).to.deep.equal({
      'Fn::Sub': [
        'arn:${AWS::Partition}:s3:::${bucket}/results/*',
        { bucket: bucketRef },
      ],
    });
  });

  it('should use Fn::GetAtt for Fn::GetAtt bucket reference', () => {
    const bucketRef = { 'Fn::GetAtt': ['MyS3Bucket', 'Arn'] };
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::aws-sdk:s3:putObject',
      Parameters: {
        Bucket: bucketRef,
        Key: 'output.json',
        Body: { result: 'success' },
      },
    };
    const result = getPermissions('s3:PutObject', state);
    expect(result[0].resource[0]).to.deep.equal({
      'Fn::Sub': [
        'arn:${AWS::Partition}:s3:::${bucket}/output.json',
        { bucket: bucketRef },
      ],
    });
  });
});
