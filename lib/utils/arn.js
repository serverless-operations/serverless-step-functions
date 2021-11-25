/**
 *
 * Returns the proper partition that is placed in an ARN.
 *
 * Examples:
 *
 * 'arn:aws:<rest of ARN>'
 * 'arn:aws-us-gov:<rest of ARN>'
 *
 * The 'aws' and 'aws-gov' are the partitions
 *
 * @param region - The region that the application is deploying to
 * @returns The proper partition for the given region.
 */
function getArnPartition(region) {
  if (region.startsWith('us-gov')) {
    return 'aws-us-gov';
  }
  if (region.startsWith('cn-')) {
    return 'aws-cn';
  }
  return 'aws';
}

module.exports = {
  getArnPartition,
};
