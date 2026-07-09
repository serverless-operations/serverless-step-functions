'use strict';

const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
const {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
} = require('@aws-sdk/client-sfn');

// Map the (service, method) pairs this plugin uses to their AWS SDK v3 client and command.
const REGISTRY = {
  CloudFormation: {
    Client: CloudFormationClient,
    commands: { describeStacks: DescribeStacksCommand },
  },
  StepFunctions: {
    Client: SFNClient,
    commands: {
      startExecution: StartExecutionCommand,
      describeExecution: DescribeExecutionCommand,
      getExecutionHistory: GetExecutionHistoryCommand,
    },
  },
};

// Drop-in replacement for the removed osls v4 provider.request() (the AWS SDK v2 surface).
//
// When the provider exposes getAwsSdkV3Config() (osls v4), build the matching SDK v3 client and
// send the command. Otherwise fall back to the legacy provider.request() (serverless v3). The
// argument list mirrors provider.request() so call sites stay unchanged, and the request params
// and response fields already match between the v2 and v3 APIs used here.
module.exports = async function awsRequest(provider, service, method, params, stage, region) {
  if (typeof provider.getAwsSdkV3Config !== 'function') {
    return provider.request(service, method, params, stage, region);
  }

  const entry = REGISTRY[service];
  const Command = entry && entry.commands[method];
  if (!Command) {
    throw new Error(`awsRequest: unsupported AWS call ${service}.${method} on osls v4`);
  }

  const config = await provider.getAwsSdkV3Config();
  if (region) {
    config.region = region;
  }
  const client = new entry.Client(config);
  return client.send(new Command(params));
};
