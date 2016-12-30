[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![Build Status](https://travis-ci.org/horike37/serverless-step-functions.svg?branch=master)](https://travis-ci.org/horike37/serverless-step-functions)
# Serverless Step Functions
Serverless plugin for AWS Step Functions.

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

## Usage
### deploy
```
$ sls deploy stepf --state <stepfunctionname>
```

### invoke
```
$ sls invoke stepf --state <stepfunctionname> --data '{"foo":"bar"}'
```

### remove
```
$ sls remove stepf --state <stepfunctionname>
```
