'use strict';

function getPermissions(state) {
  const modelId = state.Parameters.ModelId;
  const modelArn = modelId.startsWith('arn:') ? modelId : {
    'Fn::Sub': [
      `arn:\${AWS::Partition}:bedrock:$\{AWS::Region}::foundation-model/${modelId}`,
      {},
    ],
  };

  return [{
    action: 'bedrock:InvokeModel',
    resource: modelArn,
  }];
}

module.exports = { getPermissions };
