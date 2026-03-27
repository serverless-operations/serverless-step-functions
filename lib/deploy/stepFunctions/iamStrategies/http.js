'use strict';

function getPermissions(state) {
  const auth = state.Parameters && state.Parameters.Authentication;
  const connectionArn = (auth && auth.ConnectionArn) || '*';

  return [{
    action: 'states:InvokeHTTPEndpoint',
    resource: '*',
  }, {
    action: 'events:RetrieveConnectionCredentials',
    resource: connectionArn,
  }, {
    action: 'secretsmanager:GetSecretValue,secretsmanager:DescribeSecret',
    resource: {
      'Fn::Sub': 'arn:${AWS::Partition}:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:events!connection/*',
    },
  }];
}

module.exports = { getPermissions };
