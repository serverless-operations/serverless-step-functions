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
  stateMachine:
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
  stateMachine:
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
