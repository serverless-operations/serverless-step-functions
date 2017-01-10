[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![Build Status](https://travis-ci.org/horike37/serverless-step-functions.svg?branch=master)](https://travis-ci.org/horike37/serverless-step-functions) [![npm version](https://badge.fury.io/js/serverless-step-functions.svg)](https://badge.fury.io/js/serverless-step-functions)  [![Coverage Status](https://coveralls.io/repos/github/horike37/serverless-step-functions/badge.svg?branch=master)](https://coveralls.io/github/horike37/serverless-step-functions?branch=master) [![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)
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
Write definitions yaml using Amazon States Language in a `stepFunctions` statement in serverless.yml.
`Resource` statements refer to `functions` statements. Therefore, you do not need to write a function arn directly.

```yml
functions:
  hellofunc:
    handler: handler.hello

stepFunctions:
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
- --state or -t The name of the step function in your service that you want to deploy. Required.
- --stage or -s The stage in your service you want to deploy your step function.
- --region or -r The region in your stage that you want to deploy your step function.
```
$ sls deploy stepf --state <stepfunctionname>
```

### invoke
- --state or -t The name of the step function in your service that you want to invoke. Required.
- --stage or -s The stage in your service you want to invoke your step function.
- --region or -r The region in your stage that you want to invoke your step function.
- --data or -d String data to be passed as an event to your step function.
- --path or -p The path to a json file with input data to be passed to the invoked step function.
```
$ sls invoke stepf --state <stepfunctionname> --data '{"foo":"bar"}'
```

### remove
- --state or -t The name of the step function in your service that you want to remove. Required.
- --stage or -s The stage in your service you want to invoke your step remove.
- --region or -r The region in your stage that you want to invoke your step remove.
```
$ sls remove stepf --state <stepfunctionname>
```
