[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![Build Status](https://travis-ci.org/horike37/serverless-step-functions.svg?branch=master)](https://travis-ci.org/horike37/serverless-step-functions) [![npm version](https://badge.fury.io/js/serverless-step-functions.svg)](https://badge.fury.io/js/serverless-step-functions) [![Coverage Status](https://coveralls.io/repos/github/horike37/serverless-step-functions/badge.svg?branch=master)](https://coveralls.io/github/horike37/serverless-step-functions?branch=master) [![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)
# Serverless Step Functions
Serverless plugin for AWS Step Functions.

This plugin requires Serverless v1.4.0 or later.

## Install
Run `npm install` in your Serverless project.
```
$ npm install --save-dev serverless-step-functions
```

Add the plugin to your serverless.yml file
```yml
plugins:
  - serverless-step-functions
```

## Setup
Specifies your statemachine definition using Amazon States Language in a `definition` statement in serverless.yml.

```yml
custom:
  accountId: xxxxxxxx

functions:
  hellofunc:
    handler: handler.hello

stepFunctions:
  stateMachines:
    hellostepfunc1:
      events:
        - http:
            path: gofunction
            method: GET
      name: myStateMachine
      definition:
        Comment: "A Hello World example of the Amazon States Language using an AWS Lambda Function"
        StartAt: HelloWorld1
        States:
          HelloWorld1:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello
            End: true
    hellostepfunc2:
      definition:
        StartAt: HelloWorld2
        States:
          HelloWorld2:
            Type: Task
            Resource: arn:aws:states:${opt:region}:${self:custom.accountId}:activity:myTask
            End: true
  activities:
    - myTask
    - yourTask
```

### Adding a custom name for a stateMachine
In case you need to interpolate a specific stage or service layer variable as the
stateMachines name you can add a `name` property to your yaml.

```yml
service: messager

functions:
  sendMessage:
    handler: handler.sendMessage

stepFunctions:
  stateMachines:
    sendMessageFunc:
      name: sendMessageFunc-${self:custom.service}-${opt:stage}
      definition:
        <your definition>

plugins:
  - serverless-step-functions
```

Please note, that during normalization some characters will be changed to adhere to CloudFormation templates.
You can get the real statemachine name using `{ "Fn::GetAtt": ["MyStateMachine", "Name"] }`.

## Events
### API Gateway
To create HTTP endpoints as Event sources for your StepFunctions statemachine

#### Simple HTTP Endpoint
This setup specifies that the hello statemachine should be run when someone accesses the API gateway at hello via a GET request.

Here's an example:

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: hello
            method: GET
      definition:
```
#### HTTP Endpoint with Extended Options

Here You can define an POST endpoint for the path posts/create.

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: posts/create
            method: POST
      definition:
```

#### Enabling CORS

To set CORS configurations for your HTTP endpoints, simply modify your event configurations as follows:

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: posts/create
            method: POST
            cors: true
      definition:
```

Setting cors to true assumes a default configuration which is equivalent to:

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: posts/create
            method: POST
            cors:
              origin: '*'
              headers:
                - Content-Type
                - X-Amz-Date
                - Authorization
                - X-Api-Key
                - X-Amz-Security-Token
                - X-Amz-User-Agent
              allowCredentials: false
      definition:
```

Configuring the cors property sets Access-Control-Allow-Origin, Access-Control-Allow-Headers, Access-Control-Allow-Methods,Access-Control-Allow-Credentials headers in the CORS preflight response.

#### Send request to an API
You can input an value as json in request body, the value is passed as the input value of your statemachine

```
$ curl -XPOST https://xxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/posts/create -d '{"foo":"bar"}'
```

## Command
### deploy
Runn `sls deploy`, the defined Stepfunctions are deployed.

### invoke
```
$ sls invoke stepf --name <stepfunctionname> --data '{"foo":"bar"}'
```

#### options

- --name or -n The name of the step function in your service that you want to invoke. Required.
- --stage or -s The stage in your service you want to invoke your step function.
- --region or -r The region in your stage that you want to invoke your step function.
- --data or -d String data to be passed as an event to your step function.
- --path or -p The path to a json file with input data to be passed to the invoked step function.

## IAM Role
The IAM roles required to run Statemachine are automatically generated. It is also possible to specify ARN directly.

Here's an example:

```yml
stepFunctions:
  stateMachines:
    hello:
      role: arn:aws:iam::xxxxxxxx:role/yourRole
      definition:
```
## Tips
### How to specify the stateMachine ARN to environment variables
Here is serverless.yml sample to specify the stateMachine ARN to environment variables.
This makes it possible to trigger your statemachine through Lambda events

```yml
functions:
  hello:
    handler: handler.hello
    environment:
      statemachine_arn: ${self:resources.Outputs.MyStateMachine.Value}

stepFunctions:
  stateMachines:
    hellostepfunc:
      name: myStateMachine
      definition:
        <your definition>

resources:
  Outputs:
    MyStateMachine:
      Description: The ARN of the example state machine
      Value:
        Ref: MyStateMachine

plugins:
  - serverless-step-functions
```
## Sample statemachines setting in serverless.yml
### Wait State
``` yaml
custom:
  accountId: <Here is your accountId>

functions:
  hello:
    handler: handler.hello

stepFunctions:
  stateMachines:
    yourWateMachine:
      definition:
        Comment: "An example of the Amazon States Language using wait states"
        StartAt: FirstState
        States:
          FirstState:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello
            Next: wait_using_seconds
          wait_using_seconds:
            Type: Wait
            Seconds: 10
            Next: wait_using_timestamp
          wait_using_timestamp:
            Type: Wait
            Timestamp: '2015-09-04T01:59:00Z'
            Next: wait_using_timestamp_path
          wait_using_timestamp_path:
            Type: Wait
            TimestampPath: "$.expirydate"
            Next: wait_using_seconds_path
          wait_using_seconds_path:
            Type: Wait
            SecondsPath: "$.expiryseconds"
            Next: FinalState
          FinalState:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello
            End: true
```

### Retry Failture
``` yaml
custom:
  accountId: <Here is your accountId>

functions:
  hello:
    handler: handler.hello

stepFunctions:
  stateMachines:
    yourRetryMachine:
      definition:
        Comment: "A Retry example of the Amazon States Language using an AWS Lambda Function"
        StartAt: HelloWorld
        States:
          HelloWorld:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello
            Retry:
            - ErrorEquals:
              - HandledError
              IntervalSeconds: 1
              MaxAttempts: 2
              BackoffRate: 2
            - ErrorEquals:
              - States.TaskFailed
              IntervalSeconds: 30
              MaxAttempts: 2
              BackoffRate: 2
            - ErrorEquals:
              - States.ALL
              IntervalSeconds: 5
              MaxAttempts: 5
              BackoffRate: 2
            End: true
```

### Parallel

```yaml
custom:
  accountId: <Here is your accountId>

functions:
  hello:
    handler: handler.hello

stepFunctions:
  stateMachines:
    yourParallelMachine:
      definition:
        Comment: "An example of the Amazon States Language using a parallel state to execute two branches at the same time."
        StartAt: Parallel
        States:
          Parallel:
            Type: Parallel
            Next: Final State
            Branches:
            - StartAt: Wait 20s
              States:
                Wait 20s:
                  Type: Wait
                  Seconds: 20
                  End: true
            - StartAt: Pass
              States:
                Pass:
                  Type: Pass
                  Next: Wait 10s
                Wait 10s:
                  Type: Wait
                  Seconds: 10
                  End: true
          Final State:
            Type: Pass
            End: true
```

### Catch Failure

```yaml
custom:
  accountId: <Here is your accountId>

functions:
  hello:
    handler: handler.hello

stepFunctions:
  stateMachines:
    yourCatchMachine:
      definition:
        Comment: "A Catch example of the Amazon States Language using an AWS Lambda Function"
        StartAt: HelloWorld
        States:
          HelloWorld:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello
            Catch:
            - ErrorEquals:
              - HandledError
              Next: CustomErrorFallback
            - ErrorEquals:
              - States.TaskFailed
              Next: ReservedTypeFallback
            - ErrorEquals:
              - States.ALL
              Next: CatchAllFallback
            End: true
          CustomErrorFallback:
            Type: Pass
            Result: "This is a fallback from a custom lambda function exception"
            End: true
          ReservedTypeFallback:
            Type: Pass
            Result: "This is a fallback from a reserved error code"
            End: true
          CatchAllFallback:
            Type: Pass
            Result: "This is a fallback from a reserved error code"
            End: true
```

### Choice

```yaml
custom:
  accountId: <Here is your account Id>

functions:
  hello1:
    handler: handler.hello1
  hello2:
    handler: handler.hello2
  hello3:
    handler: handler.hello3
  hello4:
    handler: handler.hello4

stepFunctions:
  stateMachines:
    yourChoiceMachine:
      definition:
        Comment: "An example of the Amazon States Language using a choice state."
        StartAt: FirstState
        States:
          FirstState:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello1
            Next: ChoiceState
          ChoiceState:
            Type: Choice
            Choices:
            - Variable: "$.foo"
              NumericEquals: 1
              Next: FirstMatchState
            - Variable: "$.foo"
              NumericEquals: 2
              Next: SecondMatchState
            Default: DefaultState
          FirstMatchState:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello2
            Next: NextState
          SecondMatchState:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello3
            Next: NextState
          DefaultState:
            Type: Fail
            Cause: "No Matches!"
          NextState:
            Type: Task
            Resource: arn:aws:lambda:${opt:region}:${self:custom.accountId}:function:${self:service}-${opt:stage}-hello4
            End: true
```
