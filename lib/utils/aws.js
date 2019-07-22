const _ = require('lodash');

function isIntrinsic(obj) {
  return _.isObjectLike(obj)
    && Object.keys(obj).some(k => k.startsWith('Fn::') || k === 'Ref');
}

module.exports = {
  isIntrinsic,
};
