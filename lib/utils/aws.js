function isIntrinsic(obj) {
  return typeof obj === 'object' &&
    Object.keys(obj).some((k) => k.startsWith('Fn::') || k.startsWith('Ref'));
}

module.exports = {
  isIntrinsic,
};
