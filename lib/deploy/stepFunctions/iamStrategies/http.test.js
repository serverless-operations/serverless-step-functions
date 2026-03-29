'use strict';

const expect = require('chai').expect;
const { getPermissions } = require('./http');

describe('http strategy', () => {
  it('should give states:InvokeHTTPEndpoint on *, events:RetrieveConnectionCredentials on static ConnectionArn, and secretsmanager permissions', () => {
    const connectionArn = 'arn:aws:events:us-east-1:123456789012:connection/my-connection/abc';
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::http:invoke',
      Parameters: {
        ApiEndpoint: 'https://api.example.com/endpoint',
        Method: 'GET',
        Authentication: {
          ConnectionArn: connectionArn,
        },
      },
    };
    const result = getPermissions(state);
    const invokePerm = result.find((p) => p.action === 'states:InvokeHTTPEndpoint');
    expect(invokePerm).to.not.equal(undefined);
    expect(invokePerm.resource).to.equal('*');

    const connPerm = result.find((p) => p.action === 'events:RetrieveConnectionCredentials');
    expect(connPerm).to.not.equal(undefined);
    expect(connPerm.resource).to.equal(connectionArn);

    const secretsPerm = result.find((p) => p.action.includes('secretsmanager:GetSecretValue'));
    expect(secretsPerm).to.not.equal(undefined);
    expect(secretsPerm.resource).to.deep.equal({
      'Fn::Sub': 'arn:${AWS::Partition}:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:events!connection/*',
    });
  });

  it('should give events:RetrieveConnectionCredentials on * when ConnectionArn.$ is dynamic', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::http:invoke',
      Parameters: {
        'ApiEndpoint.$': '$.apiUrl',
        'Method.$': '$.method',
        Authentication: {
          'ConnectionArn.$': '$.connectionArn',
        },
      },
    };
    const result = getPermissions(state);
    const connPerm = result.find((p) => p.action === 'events:RetrieveConnectionCredentials');
    expect(connPerm.resource).to.equal('*');
  });

  it('should give events:RetrieveConnectionCredentials on * when no Authentication is provided', () => {
    const state = {
      Type: 'Task',
      Resource: 'arn:aws:states:::http:invoke',
      Parameters: {
        ApiEndpoint: 'https://api.example.com/endpoint',
        Method: 'GET',
      },
    };
    const result = getPermissions(state);
    const connPerm = result.find((p) => p.action === 'events:RetrieveConnectionCredentials');
    expect(connPerm.resource).to.equal('*');
  });
});
