[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![Build Status](https://travis-ci.org/horike37/serverless-step-functions.svg?branch=master)](https://travis-ci.org/horike37/serverless-step-functions) [![npm version](https://badge.fury.io/js/serverless-step-functions.svg)](https://badge.fury.io/js/serverless-step-functions)  [![Coverage Status](https://coveralls.io/repos/github/horike37/serverless-step-functions/badge.svg?branch=master)](https://coveralls.io/github/horike37/serverless-step-functions?branch=master) [![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)
# Serverless Step Functions (BETA)
Serverless plugin for AWS Step Functions.

This plugin requires Serverless v1.4.0 or later.

## Install
Run `npm install` in your Serverless project.
```
$ npm install --save serverless-step-functions
```

Add the plugin to your serverless.yml file
```yml
plugins:
  - serverless-step-functions
```

## Setup
Write definitions yaml using Amazon States Language in a `stepFunctions` statement in serverless.yml.
`Resource` statements refer to `functions` statements. Therefore, you do not need to write a function arn directly.
Of course, you can also specify arn directly.

```yml
functions:
  hellofunc:
    handler: handler.hello

stepFunctions:
  stateMachines:
    hellostepfunc:
      Comment: "A Hello World example of the Amazon States Language using an AWS Lambda Function"
      StartAt: HelloWorld
      States: 
        HelloWorld: 
          Type: Task
          Resource: hellofunc
          End: true
```

## Command
### deploy
#### All StateMachines deploy 
```
$ sls deploy stepf
```

#### Single StateMachine deploy 
```
$ sls deploy stepf --state <stepfunctionname>
```

#### options

- --state or -t The name of the step function in your service that you want to deploy.
- --stage or -s The stage in your service you want to deploy your step function.
- --region or -r The region in your stage that you want to deploy your step function.

### invoke
#### options

- --state or -t The name of the step function in your service that you want to invoke. Required.
- --stage or -s The stage in your service you want to invoke your step function.
- --region or -r The region in your stage that you want to invoke your step function.
- --data or -d String data to be passed as an event to your step function.
- --path or -p The path to a json file with input data to be passed to the invoked step function.
```
$ sls invoke stepf --state <stepfunctionname> --data '{"foo":"bar"}'
```

### remove
#### All StateMachines remove

```
$ sls remove stepf
```

#### Single StateMachine remove

```
$ sls remove stepf --state <stepfunctionname>
```

#### options

- --state or -t The name of the step function in your service that you want to remove. Required.
- --stage or -s The stage in your service you want to invoke your step remove.
- --region or -r The region in your stage that you want to invoke your step remove.

## Sample statemachines setting in serverless.yml
### Waite State
```yml
functions:
  hellofunc:
    handler: handler.hello

stepFunctions:
  stateMachines:
    yourWateMachine:
      Comment: "An example of the Amazon States Language using wait states"
      StartAt: FirstState
      States:
        FirstState:
          Type: Task
          Resource: hellofunc
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
          Resource: hellofunc
          End: true
```
### Retry Failture

```yml
functions:
  hellofunc:
    handler: handler.hello

stepFunctions:
  stateMachines:
    yourRetryMachine:
      Comment: "A Retry example of the Amazon States Language using an AWS Lambda Function"
      StartAt: HelloWorld
      States:
        HelloWorld:
          Type: Task
          Resource: hellofunc
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

```yml
stepFunctions:
  stateMachines:
    yourParallelMachine:
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

### Catch Failture

```yml
functions:
  hellofunc:
    handler: handler.hello
stepFunctions:
  stateMachines:
    yourCatchMachine:
      Comment: "A Catch example of the Amazon States Language using an AWS Lambda Function"
      StartAt: HelloWorld
      States:
        HelloWorld:
          Type: Task
          Resource: hellofunc
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

```yml
functions:
  hellofunc1:
    handler: handler.hello1
  hellofunc2:
    handler: handler.hello2
  hellofunc3:
    handler: handler.hello3
  hellofunc4:
    handler: handler.hello4
stepFunctions:
  stateMachines:
    yourChoiceMachine:
      Comment: "An example of the Amazon States Language using a choice state."
      StartAt: FirstState
      States:
        FirstState:
          Type: Task
          Resource: hellofunc1
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
          Resource: hellofunc2
          Next: NextState
        SecondMatchState:
          Type: Task
          Resource: hellofunc3
          Next: NextState
        DefaultState:
          Type: Fail
          Cause: "No Matches!"
        NextState:
          Type: Task
          Resource: hellofunc4
          End: true
