[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![Build Status](https://travis-ci.org/horike37/serverless-step-functions.svg?branch=master)](https://travis-ci.org/horike37/serverless-step-functions) [![npm version](https://badge.fury.io/js/serverless-step-functions.svg)](https://badge.fury.io/js/serverless-step-functions) [![Coverage Status](https://coveralls.io/repos/github/horike37/serverless-step-functions/badge.svg?branch=master)](https://coveralls.io/github/horike37/serverless-step-functions?branch=master) [![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)
# Serverless Step Functions
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
