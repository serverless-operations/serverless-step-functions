'use strict';

const { resolveS3BucketReference, resolveS3BucketReferences } = require('./utils');

function getPermissions(action, state) {
  const bucket = state.Parameters.Bucket || '*';
  const key = state.Parameters.Key || '*';
  const prefix = state.Parameters.Prefix;
  let arn;

  if (action === 's3:listObjectsV2') {
    return [{
      action: 's3:Get*',
      resource: resolveS3BucketReferences(bucket, [
        'arn:${AWS::Partition}:s3:::${bucket}',
        'arn:${AWS::Partition}:s3:::${bucket}/*',
      ]),
    }, {
      action: 's3:List*',
      resource: resolveS3BucketReferences(bucket, [
        'arn:${AWS::Partition}:s3:::${bucket}',
        'arn:${AWS::Partition}:s3:::${bucket}/*',
      ]),
    }];
  }

  if (prefix) {
    arn = resolveS3BucketReference(bucket, `arn:\${AWS::Partition}:s3:::\${bucket}/${prefix}/${key}`);
  } else if (bucket === '*' && key === '*') {
    arn = '*';
  } else {
    arn = resolveS3BucketReference(bucket, `arn:\${AWS::Partition}:s3:::\${bucket}/${key}`);
  }

  return [{ action, resource: [arn] }];
}

module.exports = { getPermissions };
