# Serverless Step Functions

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) [![Build Status](https://travis-ci.org/serverless-operations/serverless-step-functions.svg?branch=master)](https://travis-ci.org/serverless-operations/serverless-step-functions) [![npm version](https://badge.fury.io/js/serverless-step-functions.svg)](https://badge.fury.io/js/serverless-step-functions) [![Coverage Status](https://coveralls.io/repos/github/horike37/serverless-step-functions/badge.svg?branch=master)](https://coveralls.io/github/horike37/serverless-step-functions?branch=master) [![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE) [![serverless-step-functions Dev Token](https://badge.devtoken.rocks/serverless-step-functions)](https://devtoken.rocks/package/serverless-step-functions)

This is the Serverless Framework plugin for AWS Step Functions.

## TOC

 - [Install](#install)
 - [Setup](#Setup)
     - [Adding a custom name for a state machine](#adding-a-custom-name-for-a-statemachine)
     - [Adding a custom logical id for a stateMachine](#adding-a-custom-logical-id-for-a-statemachine)
     - [Depending on another logical id](#depending-on-another-logical-id)
     - [Adding retain property for a state machine](#adding-retain-property-for-a-statemachine)
     - [CloudWatch Alarms](#cloudwatch-alarms)
     - [CloudWatch Notifications](#cloudwatch-notifications)
     - [Blue-Green deployments](#blue-green-deployment)
     - [Pre-deployment validation](#pre-deployment-validation)
     - [Express Workflow](#express-workflow)
     - [CloudWatch Logs](#cloudwatch-logs)
     - [X-Ray](#x-ray)
 - [Current Gotcha](#current-gotcha)
 - [Events](#events)
     - [API Gateway](#api-gateway)
         - [Simple HTTP endpoint](#simple-http-endpoint)
         - [Custom Step Functions Action](#custom-step-functions-action)
         - [HTTP Endpoint with custom IAM Role](#http-endpoint-with-custom-iam-role)
         - [Share API Gateway and API Resources](#share-api-gateway-and-api-resources)
         - [Enabling CORS](#enabling-cors)
         - [HTTP Endpoints with AWS_IAM Authorizers](#http-endpoints-with-aws_iam-authorizers)
         - [HTTP Endpoints with Custom Authorizers](#http-endpoints-with-custom-authorizers)
         - [Shared Authorizer](#shared-authorizer)
         - [LAMBDA_PROXY request template](#lambda_proxy-request-template)
         - [Customizing request body mapping templates](#customizing-request-body-mapping-templates)
         - [Customizing response headers and templates](#customizing-response-headers-and-templates)
         - [Send request to an API](#send-request-to-an-api)
         - [Setting API keys for your Rest API](#setting-api-keys-for-your-rest-api)
     - [Schedule](#schedule)
         - [Enabling / Disabling](#enabling--disabling)
         - [Specify Name and Description](#specify-name-and-description)
         - [Scheduled Events IAM Role](#scheduled-events-iam-role)
     - [CloudWatch Event](#cloudwatch-event)
         - [Simple event definition](#simple-event-definition)
         - [Enabling / Disabling](#enabling--disabling-1)
         - [Specify Input or Inputpath](#specify-input-or-inputpath)
         - [Specifying a Description](#specifying-a-description)
         - [Specifying a Name](#specifying-a-name)
         - [Specifying a RoleArn](#specifying-a-rolearn)
         - [Specifying a custom CloudWatch EventBus](#specifying-a-custom-cloudwatch-eventbus)
 - [Tags](#tags)
 - [Commands](#commands)
     - [deploy](#deploy)
     - [invoke](#invoke)
 - [IAM Role](#iam-role)
 - [Tips](#tips)
     - [How to specify the stateMachine ARN to environment variables](#how-to-specify-the-statemachine-arn-to-environment-variables)
     - [How to split up state machines into files](#how-to-split-up-state-machines-into-files)
 - [Sample statemachines setting in serverless.yml](#sample-statemachines-setting-in-serverlessyml)
     - [Wait State](#wait-state)
     - [Retry Failure](#retry-failure)
     - [Parallel](#parallel)
     - [Catch Failure](#catch-failure)
     - [Choice](#choice)
     - [Map](#map)

## Install

Run `npm install` in your Serverless project.

`$ npm install --save-dev serverless-step-functions`

Add the plugin to your serverless.yml file

```yml
plugins:
  - serverless-step-functions
```

## Setup

Specify your state machine definition using Amazon States Language in a `definition` statement in serverless.yml. You can use CloudFormation intrinsic functions such as `Ref` and `Fn::GetAtt` to reference Lambda functions, SNS topics, SQS queues and DynamoDB tables declared in the same `serverless.yml`. Since `Ref` returns different things (ARN, ID, resource name, etc.) depending on the type of CloudFormation resource, please refer to [this page](https://theburningmonk.com/cloudformation-ref-and-getatt-cheatsheet/) to see whether you need to use `Ref` or `Fn::GetAtt`.

Alternatively, you can also provide the raw ARN, or SQS queue URL, or DynamoDB table name as a string. If you need to construct the ARN by hand, then we recommend to use the [serverless-pseudo-parameters](https://www.npmjs.com/package/serverless-pseudo-parameters) plugin together to make your life easier.

```yml
functions:
  hello:
    handler: handler.hello

stepFunctions:
  stateMachines:
    hellostepfunc1:
      events:
        - http:
            path: gofunction
            method: GET
        - schedule:
            rate: rate(10 minutes)
            enabled: true
            input:
              key1: value1
              key2: value2
              stageParams:
                stage: dev
      name: myStateMachine
      definition:
        Comment: "A Hello World example of the Amazon States Language using an AWS Lambda Function"
        StartAt: HelloWorld1
        States:
          HelloWorld1:
            Type: Task
            Resource:
              Fn::GetAtt: [hello, Arn]
            End: true
      dependsOn: CustomIamRole
      tags:
        Team: Atlantis
      alarms:
        topics:
          ok: arn:aws:sns:us-east-1:1234567890:NotifyMe
          alarm: arn:aws:sns:us-east-1:1234567890:NotifyMe
          insufficientData: arn:aws:sns:us-east-1:1234567890:NotifyMe
        metrics:
          - executionsTimedOut
          - executionsFailed
          - executionsAborted
          - metric: executionThrottled
            treatMissingData: breaching # overrides below default
          - executionsSucceeded
        treatMissingData: ignore # optional
    hellostepfunc2:
      definition:
        StartAt: HelloWorld2
        States:
          HelloWorld2:
            Type: Task
            Resource:
              Fn::GetAtt: [hello, Arn]
            End: true
      dependsOn:
        - DynamoDBTable
        - KinesisStream
        - CUstomIamRole
      tags:
        Team: Atlantis
  activities:
    - myTask
    - yourTask
  validate: true # enable pre-deployment definition validation (disabled by default)

plugins:
  - serverless-step-functions
  - serverless-pseudo-parameters
```

In the example above, notice that we used `Fn::GetAtt: [hello, Arn]` to get the ARN for the `hello` function defined earlier. This means you don't have to know how the `Serverless` framework converts these local names to CloudFormation logical IDs (e.g. `hello-world` becomes `HelloDashworldLambdaFunction`).

However, if you prefer to work with logical IDs, you can. You can also express the above `Fn::GetAtt` function as `Fn::GetAtt: [HelloLambdaFunction, Arn]`. If you're unfamiliar with the convention the `Serverless` framework uses, then the easiest thing to do is to first run `sls package` then look in the `.serverless` folder for the generated CloudFormation template. Here you can find the logical resource names for the functions you want to reference.

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

### Adding a custom logical id for a stateMachine

You can use a custom logical id that is only unique within the stack as opposed to the name that needs to be unique globally. This can make referencing the state machine easier/simpler because you don't have to duplicate the interpolation logic everywhere you reference the state machine.

```yml
service: messager

functions:
  sendMessage:
    handler: handler.sendMessage

stepFunctions:
  stateMachines:
    sendMessageFunc:
      id: SendMessageStateMachine
      name: sendMessageFunc-${self:custom.service}-${opt:stage}
      definition:
        <your definition>

plugins:
  - serverless-step-functions
```

You can then `Ref: SendMessageStateMachine` in various parts of CloudFormation or serverless.yml

### Depending on another logical id

If your state machine depends on another resource defined in your `serverless.yml` then you can add a `dependsOn` field to the state machine `definition`. This would add the `DependsOn`clause to the generated CloudFormation template.

This `dependsOn` field can be either a string, or an array of strings.

```yaml
stepFunctions:
  stateMachines:
    myStateMachine:
      dependsOn: myDB

    myOtherStateMachine:
      dependsOn:
        - myOtherDB
        - myStream
```
### Adding retain property for a stateMachine
There are some practical cases when you would like to prevent state machine from deletion on stack delete or update. This can be achieved by adding `retain` property to the state machine section.

```yaml
stepFunctions:
  stateMachines:
    myStateMachine:
      retain: true
```

Configuring in such way adds `"DeletionPolicy" : "Retain"` to the state machine within CloudFormation template.

### CloudWatch Alarms

It's common practice to want to monitor the health of your state machines and be alerted when something goes wrong. You can either:

* do this using the [serverless-plugin-aws-alerts](https://github.com/ACloudGuru/serverless-plugin-aws-alerts), which lets you configure custom CloudWatch Alarms against the various metrics that Step Functions publishes.
* or, you can use the built-in `alarms` configuration from this plugin, which gives you an opinionated set of default alarms (see below)

```yaml
stepFunctions:
  stateMachines:
    myStateMachine:
      alarms:
        topics:
          ok: arn:aws:sns:us-east-1:1234567890:NotifyMe
          alarm: arn:aws:sns:us-east-1:1234567890:NotifyMe
          insufficientData: arn:aws:sns:us-east-1:1234567890:NotifyMe
        metrics:
          - executionsTimedOut
          - executionsFailed
          - executionsAborted
          - executionThrottled
          - executionsSucceeded
        treatMissingData: missing
```

Both `topics` and `metrics` are required properties. There are 4 supported metrics, each map to the CloudWatch Metrics that Step Functions publishes for your executions.

You can configure how the CloudWatch Alarms should treat missing data:

* `missing` (AWS default): The alarm does not consider missing data points when evaluating whether to change state.
* `ignore`: The current alarm state is maintained.
* `breaching`: Missing data points are treated as breaching the threshold.
* `notBreaching`: Missing data points are treated as being within the threshold.

For more information, please refer to the [official documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html#alarms-and-missing-data).

The generated CloudWatch alarms would have the following configurations:

```yaml
namespace: 'AWS/States'
metric: <ExecutionsTimedOut | ExecutionsFailed | ExecutionsAborted | ExecutionThrottled>
threshold: 1
period: 60
evaluationPeriods: 1
ComparisonOperator: GreaterThanOrEqualToThreshold
Statistic: Sum
treatMissingData: <missing (default) | ignore | breaching | notBreaching>
Dimensions:
  - Name: StateMachineArn
    Value: <ArnOfTheStateMachine>
```

You can also override the default `treatMissingData` setting for a particular alarm by specifying an override:

```yml
alarms:
  topics:
    ok: arn:aws:sns:us-east-1:1234567890:NotifyMe
    alarm: arn:aws:sns:us-east-1:1234567890:NotifyMe
    insufficientData: arn:aws:sns:us-east-1:1234567890:NotifyMe
  metrics:
    - executionsTimedOut
    - executionsFailed
    - executionsAborted
    - metric: executionThrottled
      treatMissingData: breaching # override
    - executionsSucceeded
  treatMissingData: ignore # default
```

### CloudWatch Notifications

You can monitor the execution state of your state machines [via CloudWatch Events](https://aws.amazon.com/about-aws/whats-new/2019/05/aws-step-functions-adds-support-for-workflow-execution-events/). It allows you to be alerted when the status of your state machine changes to `ABORTED`, `FAILED`, `RUNNING`, `SUCCEEDED` or `TIMED_OUT`.

You can configure CloudWatch Events to send notification to a number of targets. Currently this plugin supports `sns`, `sqs`, `kinesis`, `firehose`, `lambda` and `stepFunctions`.

To configure status change notifications to your state machine, you can add a `notifications` like below:

```yml
stepFunctions:
  stateMachines:
    hellostepfunc1:
      name: test
      definition:
        ...
      notifications:
        ABORTED:
          - sns: SNS_TOPIC_ARN
          - sqs: SQS_TOPIC_ARN
          - sqs: # for FIFO queues, which requires you to configure the message group ID
              arn: SQS_TOPIC_ARN
              messageGroupId: 12345
          - lambda: LAMBDA_FUNCTION_ARN
          - kinesis: KINESIS_STREAM_ARN
          - kinesis:
               arn: KINESIS_STREAM_ARN
               partitionKeyPath: $.id # used to choose the parition key from payload
          - firehose: FIREHOSE_STREAM_ARN
          - stepFunctions: STATE_MACHINE_ARN
        FAILED:
          ... # same as above
        ... # other status
```

As you can see from the above example, you can configure different notification targets for each type of status change. If you want to configure the same targets for multiple status changes, then consider using [YML anchors](https://blog.daemonl.com/2016/02/yaml.html) to keep your YML succinct.

CloudFormation intrinsic functions such as `Ref` and `Fn::GetAtt` are supported.

When setting up a notification target against a FIFO SQS queue, the queue must enable the content-based deduplication option and you must configure the `messageGroupId`.

### Blue green deployment

To implement a [blue-green deployment with Step Functions](https://theburningmonk.com/2019/08/how-to-do-blue-green-deployment-for-step-functions/) you need to reference the exact versions of the functions.

To do this, you can specify `useExactVersion: true` in the state machine.

```yml
stepFunctions:
  stateMachines:
    hellostepfunc1:
      useExactVersion: true
      definition:
        ...
```

### Pre-deployment validation

By default, your state machine definition will be validated during deployment by StepFunctions. This can be cumbersome when developing because you have to upload your service for every typo in your definition. In order to go faster, you can enable pre-deployment validation using [asl-validator](https://www.npmjs.com/package/asl-validator) which should detect most of the issues (like a missing state property).

```yaml
stepFunctions:
  validate: true
```

### Disable Output Cloudformation Outputs section

Disables the generation of outputs in the CloudFormation Outputs section. If you define many state machines in serverless.yml you may reach the CloudFormation limit of 60 outputs. If you define `noOutput: true` then this plugin will not generate outputs automatically.

```yaml
stepFunctions:
  noOutput: true
```

### Express Workflow

At re:invent 2019, AWS [introduced Express Workflows](https://aws.amazon.com/about-aws/whats-new/2019/12/introducing-aws-step-functions-express-workflows/) as a cheaper, more scalable alternative (but with a cut-down set of features). See [this page](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html) for differences between standard and express workflows.

To declare an express workflow, specify `type` as `EXPRESS` and you can specify the logging configuration:

```yaml
stepFunctions:
  stateMachines:
    hellostepfunc1:
      type: EXPRESS
      loggingConfig:
        level: ERROR
        includeExecutionData: true
        destinations:
          - Fn::GetAtt: [MyLogGroup, Arn]
```

### CloudWatch Logs

You can enable CloudWatch Logs for standard Step Functions, the syntax is
exactly like with Express Workflows.

```yaml
stepFunctions:
  stateMachines:
    hellostepfunc1:
      loggingConfig:
        level: ERROR
        includeExecutionData: true
        destinations:
          - Fn::GetAtt: [MyLogGroup, Arn]
```

### X-Ray

You can enable X-Ray for your state machine, specify `tracingConfig` as shown below.

```yaml
stepFunctions:
  stateMachines:
    hellostepfunc1:
      tracingConfig:
        enabled: true
```

## Current Gotcha

Please keep this gotcha in mind if you want to reference the `name` from the `resources` section. To generate Logical ID for CloudFormation, the plugin transforms the specified name in serverless.yml based on the following scheme.

* Transform a leading character into uppercase
* Transform `-` into Dash
* Transform `_` into Underscore

If you want to use variables system in name statement, you can't put the variables as a prefix like this:`${self:service}-${opt:stage}-myStateMachine` since the variables are transformed within Output section, as a result, the reference will be broken.

The correct sample is here.

```yaml
stepFunctions:
  stateMachines:
    myStateMachine:
      name: myStateMachine-${self:service}-${opt:stage}
...

resources:
  Outputs:
    myStateMachine:
      Value:
        Ref: MyStateMachineDash${self:service}Dash${opt:stage}
```

## Events

### API Gateway

To create HTTP endpoints as Event sources for your StepFunctions statemachine

#### Simple HTTP Endpoint

This setup specifies that the hello state machine should be run when someone accesses the API gateway at hello via a GET request.

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

#### Custom Step Functions Action

Step Functions have custom actions like DescribeExecution or StopExecution to fetch and control them. You can use custom actions like this:

```yml
stepFunctions:
  stateMachines:
    start:
      events:
        - http:
            path: action/start
            method: POST
      definition:
        ...
    status:
      events:
        - http:
            path: action/status
            method: POST
            action: DescribeExecution
      definition:
        ...
    stop:
      events:
        - http:
            path: action/stop
            method: POST
            action: StopExecution
      definition:
        ...
```

Request template is not used when action is set because there're a bunch of actions. However if you want to use request template you can use [Customizing request body mapping templates](#customizing-request-body-mapping-templates).

#### HTTP Endpoint with custom IAM Role

The plugin would generate an IAM Role for you by default. However, if you wish to use an IAM role that you have provisioned separately, then you can override the IAM Role like this:

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: posts/create
            method: POST
            iamRole: arn:aws:iam::<accountId>:role/<roleName>
      definition:
```

#### Share API Gateway and API Resources

You can [share the same API Gateway](https://serverless.com/framework/docs/providers/aws/events/apigateway/#share-api-gateway-and-api-resources) between multiple projects by referencing its REST API ID and Root Resource ID in serverless.yml as follows:

```yml
service: service-name
provider:
  name: aws
  apiGateway:
    # REST API resource ID. Default is generated by the framework
    restApiId: xxxxxxxxxx
    # Root resource, represent as / path
    restApiRootResourceId: xxxxxxxxxx

functions:
  ...
```

If your application has many nested paths, you might also want to break them out into smaller services.

However, Cloudformation will throw an error if we try to generate an existing path resource. To avoid that, we reference the resource ID:

```yml
service: service-a
provider:
  apiGateway:
    restApiId: xxxxxxxxxx
    restApiRootResourceId: xxxxxxxxxx
    # List of existing resources that were created in the REST API. This is required or the stack will be conflicted
    restApiResources:
      /users: xxxxxxxxxx

functions:
  ...
```

Now we can define endpoints using existing API Gateway ressources

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: users/create
            method: POST
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
To enable the Access-Control-Max-Age preflight response header, set the maxAge property in the cors object:

```yml
stepFunctions:
  stateMachines:
    SfnApiGateway:
      events:
        - http:
            path: /playground/start
            method: post
            cors:
              origin: '*'
              maxAge: 86400
```

#### HTTP Endpoints with AWS_IAM Authorizers

If you want to require that the caller submit the IAM user's access keys in order to be authenticated to invoke your Lambda Function, set the authorizer to AWS_IAM as shown in the following example:

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: posts/create
            method: POST
            authorizer: aws_iam
      definition:
```

#### HTTP Endpoints with Custom Authorizers

[Custom Authorizers](https://serverless.com/framework/docs/providers/aws/events/apigateway/#http-endpoints-with-custom-authorizers) allow you to run an AWS Lambda Function before your targeted AWS Lambda Function. This is useful for Microservice Architectures or when you simply want to do some Authorization before running your business logic.

You can enable Custom Authorizers for your HTTP endpoint by setting the Authorizer in your http event to another function in the same service, as shown in the following example:

```yml
stepFunctions:
  stateMachines:
    hello:
      - http:
          path: posts/create
          method: post
          authorizer: authorizerFunc
      definition:
```

If the Authorizer function does not exist in your service but exists in AWS, you can provide the ARN of the Lambda function instead of the function name, as shown in the following example:

```yml
stepFunctions:
  stateMachines:
    hello:
      - http:
          path: posts/create
          method: post
          authorizer: xxx:xxx:Lambda-Name
      definition:
```

#### Shared Authorizer

Auto-created Authorizer is convenient for conventional setup. However, when you need to define your custom Authorizer, or use COGNITO_USER_POOLS authorizer with shared API Gateway, it is painful because of AWS limitation. Sharing Authorizer is a better way to do.

```yml
stepFunctions:
  stateMachines:
    createUser:
      ...
      events:
        - http:
            path: /users
            ...
            authorizer:
              # Provide both type and authorizerId
              type: COGNITO_USER_POOLS # TOKEN, CUSTOM or COGNITO_USER_POOLS, same as AWS Cloudformation documentation
              authorizerId:
                Ref: ApiGatewayAuthorizer  # or hard-code Authorizer ID
              # [Optional] you can also specify the OAuth scopes for Cognito
              scopes:
                - scope1
                ...
```

#### LAMBDA_PROXY request template

The plugin generates default body mapping templates for `application/json` and `application/x-www-form-urlencoded` content types. The default template would pass the request body as input to the state machine. If you need access to other contextual information about the HTTP request such as headers, path parameters, etc. then you can also use the `lambda_proxy` request template like this:

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: posts/create
            method: POST
            request:
              template: lambda_proxy
```

This would generate the normal LAMBDA_PROXY template used for API Gateway integration with Lambda functions.

#### Customizing request body mapping templates

If you'd like to add content types or customize the default templates, you can do so by including your custom [API Gateway request mapping template](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html) in `serverless.yml` like so:

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: posts/create
            method: POST
            request:
              template:
                application/json: |
                  #set( $body = $util.escapeJavaScript($input.json('$')) )
                  #set( $name = $util.escapeJavaScript($input.json('$.data.attributes.order_id')) )
                  {
                    "input": "$body",
                    "name": "$name",
                    "stateMachineArn":"arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:processOrderFlow-${opt:stage}"
                  }
      name: processOrderFlow-${opt:stage}
      definition:
```

#### Customizing response headers and templates

If you'd like to add custom headers in the HTTP response, or customize the default response template (which just returns the response from Step Function's StartExecution API), then you can do so by including your custom headers and [API Gateway response mapping template](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html) in `serverless.yml` like so:

```yml
stepFunctions:
  stateMachines:
    hello:
      events:
        - http:
            path: posts/create
            method: POST
            response:
              headers:
                Content-Type: "'application/json'"
                X-Application-Id: "'my-app'"
              template:
                application/json: |
                  {
                    "status": 200,
                    "info": "OK"
                  }
      definition:
```

#### Send request to an API

You can input an value as json in request body, the value is passed as the input value of your statemachine

`$ curl -XPOST https://xxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/posts/create -d '{"foo":"bar"}'`

#### Setting API keys for your Rest API

You can specify a list of API keys to be used by your service Rest API by adding an apiKeys array property to the provider object in serverless.yml. You'll also need to explicitly specify which endpoints are private and require one of the api keys to be included in the request by adding a private boolean property to the http event object you want to set as private. API Keys are created globally, so if you want to deploy your service to different stages make sure your API key contains a stage variable as defined below. When using API keys, you can optionally define usage plan quota and throttle, using usagePlan object.

Here's an example configuration for setting API keys for your service Rest API:

```yml
service: my-service
provider:
  name: aws
  apiKeys:
    - myFirstKey
    - ${opt:stage}-myFirstKey
    - ${env:MY_API_KEY} # you can hide it in a serverless variable
  usagePlan:
    quota:
      limit: 5000
      offset: 2
      period: MONTH
    throttle:
      burstLimit: 200
      rateLimit: 100
functions:
  hello:
    handler: handler.hello

    stepFunctions:
      stateMachines:
        statemachine1:
          name: ${self:service}-${opt:stage}-statemachine1
          events:
            - http:
                path: /hello
                method: post
                private: true
          definition:
            Comment: "A Hello World example of the Amazon States Language using an AWS Lambda Function"
            StartAt: HelloWorld1
            States:
              HelloWorld1:
                Type: Task
                Resource:
                  Fn::GetAtt: [hello, Arn]
                End: true


    plugins:
      - serverless-step-functions
      - serverless-pseudo-parameters
```

Please note that those are the API keys names, not the actual values. Once you deploy your service, the value of those API keys will be auto generated by AWS and printed on the screen for you to use. The values can be concealed from the output with the --conceal deploy option.

Clients connecting to this Rest API will then need to set any of these API keys values in the x-api-key header of their request. This is only necessary for functions where the private property is set to true.

### Schedule

The following config will attach a schedule event and causes the stateMachine `crawl` to be called every 2 hours. The configuration allows you to attach multiple schedules to the same stateMachine. You can either use the `rate` or `cron` syntax. Take a look at the [AWS schedule syntax documentation](http://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html) for more details.

```yaml
stepFunctions:
  stateMachines:
    crawl:
      events:
        - schedule: rate(2 hours)
        - schedule: cron(0 12 * * ? *)
      definition:
```

#### Enabling / Disabling

**Note:** `schedule` events are enabled by default.

This will create and attach a schedule event for the `aggregate` stateMachine which is disabled. If enabled it will call
the `aggregate` stateMachine every 10 minutes.

```yaml
stepFunctions:
  stateMachines:
    aggregate:
      events:
        - schedule:
            rate: rate(10 minutes)
            enabled: false
            input:
              key1: value1
              key2: value2
              stageParams:
                stage: dev
        - schedule:
            rate: cron(0 12 * * ? *)
            enabled: false
            inputPath: '$.stageVariables'
```

#### Specify Name and Description

Name and Description can be specified for a schedule event. These are not required properties.

```yaml
events:
  - schedule:
      name: your-scheduled-rate-event-name
      description: 'your scheduled rate event description'
      rate: rate(2 hours)
```

#### Scheduled Events IAM Role

By default, the plugin will create a new IAM role that allows AWS Events to start your state machine. Note that this role is different than the role assumed by the state machine. You can specify your own role instead (it must allow `events.amazonaws.com` to assume it, and it must be able to run `states:StartExecution` on your state machine):

```yaml
events:
  - schedule:
      rate: rate(2 hours)
      role: arn:aws:iam::xxxxxxxx:role/yourRole
```

### CloudWatch Event / EventBridge

#### Simple event definition

This will enable your Statemachine to be called by an EC2 event rule.
Please check the page of [Event Types for CloudWatch Events](http://docs.aws.amazon.com/AmazonCloudWatch/latest/events/EventTypes.html).

```yml
stepFunctions:
  stateMachines:
    first:
      events:
        - cloudwatchEvent:
            event:
              source:
                - "aws.ec2"
              detail-type:
                - "EC2 Instance State-change Notification"
              detail:
                state:
                  - pending
      definition:
        ...
```

You can alternatively use EventBridge:

```yml
stepFunctions:
  stateMachines:
    first:
      events:
        - eventBridge:
            event:
              source:
                - "aws.ec2"
              detail-type:
                - "EC2 Instance State-change Notification"
              detail:
                state:
                  - pending
      definition:
        ...
```

All the configurations in this section applies to both `cloudwatchEvent` and `eventBridge`.

#### Enabling / Disabling

**Note:** `cloudwatchEvent` and `eventBridge` events are enabled by default.

This will create and attach a disabled `cloudwatchEvent` event for the `myCloudWatch` statemachine.

```yml
stepFunctions:
  stateMachines:
    cloudwatchEvent:
      events:
        - cloudwatchEvent:
            event:
              source:
                - "aws.ec2"
              detail-type:
                - "EC2 Instance State-change Notification"
              detail:
                state:
                  - pending
            enabled: false
      definition:
        ...
```

#### Specify Input or Inputpath

You can specify input values ​​to the Lambda function.

```yml
stepFunctions:
  stateMachines:
    cloudwatchEvent:
      events:
        - cloudwatchEvent:
            event:
              source:
                - "aws.ec2"
              detail-type:
                - "EC2 Instance State-change Notification"
              detail:
                state:
                  - pending
            input:
              key1: value1
              key2: value2
              stageParams:
                stage: dev
        - cloudwatchEvent:
            event:
              source:
                - "aws.ec2"
              detail-type:
                - "EC2 Instance State-change Notification"
              detail:
                state:
                  - pending
            inputPath: '$.stageVariables'
      definition:
        ...
```

#### Specifying a Description

You can also specify a CloudWatch Event description.

```yml
stepFunctions:
  stateMachines:
    cloudwatchEvent:
      events:
        - cloudwatchEvent:
            description: 'CloudWatch Event triggered on EC2 Instance pending state'
            event:
              source:
                - "aws.ec2"
              detail-type:
                - "EC2 Instance State-change Notification"
              detail:
                state:
                  - pending
      definition:
        ...
```

#### Specifying a Name

You can also specify a CloudWatch Event name. Keep in mind that the name must begin with a letter; contain only ASCII letters, digits, and hyphens; and not end with a hyphen or contain two consecutive hyphens. More infomation [here](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-name.html).

```yml
stepFunctions:
  stateMachines:
    cloudwatchEvent:
      events:
        - cloudwatchEvent:
            name: 'my-cloudwatch-event-name'
            event:
              source:
                - "aws.ec2"
              detail-type:
                - "EC2 Instance State-change Notification"
              detail:
                state:
                  - pending
      definition:
        ...
```

#### Specifying a RoleArn

You can also specify a CloudWatch Event RoleArn.
The Amazon Resource Name (ARN) of the role that is used for target invocation.

Required: No

```yml
stepFunctions:
  stateMachines:
    cloudwatchEvent:
      events:
        - cloudwatchEvent:
            name: 'my-cloudwatch-event-name'
            iamRole: 'arn:aws:iam::012345678910:role/Events-InvokeStepFunctions-Role'
            event:
              source:
                - "aws.ec2"
              detail-type:
                - "EC2 Instance State-change Notification"
              detail:
                state:
                  - pending
      definition:
        ...
```

#### Specifying a custom CloudWatch EventBus

You can choose which CloudWatch Event bus to listen to:

```yml
stepFunctions:
  stateMachines:
    cloudwatchEvent:
      events:
        - cloudwatchEvent:
            eventBusName: 'my-custom-event-bus'
            event:
              source:
                - "my.custom.source"
              detail-type:
                - "My Event Type"
              detail:
                state:
                  - pending
      definition:
        ...
```

## Tags

You can specify tags on each state machine. Additionally any global tags (specified under `provider` section in your `serverless.yml`) would be merged in as well.

If you _don't_ want for global tags to be merged into your state machine, you can include the `inheritGlobalTags` property for your state machine.

```yaml
provider:
  tags:
    app: myApp
    department: engineering
stepFunctions:
  stateMachines:
    hellostepfunc1:
      name: myStateMachine
      inheritGlobalTags: false
      tags:
        score: 42
      definition: something
```

As a result, `hellostepfunc1` will only have the tag of `score: 42`, and _not_ the tags at the provider level

## Commands

### deploy

Run `sls deploy`, the defined Stepfunctions are deployed.

### invoke

`$ sls invoke stepf --name <stepfunctionname> --data '{"foo":"bar"}'`

#### options

* --name or -n The name of the step function in your service that you want to invoke. Required.
* --stage or -s The stage in your service you want to invoke your step function.
* --region or -r The region in your stage that you want to invoke your step function.
* --data or -d String data to be passed as an event to your step function.
* --path or -p The path to a json file with input data to be passed to the invoked step function.

## IAM Role

The IAM roles required to run Statemachine are automatically generated for each state machine in the `serverless.yml`, with the IAM role name of `StatesExecutionPolicy-<environment>`. These roles are tailored to the services that the state machine integrates with, for example with Lambda the `InvokeFunction` is applied. You can also specify a custom ARN directly to the step functions lambda.

Here's an example:

```yml
stepFunctions:
  stateMachines:
    hello:
      role: arn:aws:iam::xxxxxxxx:role/yourRole
      definition:
```

It is also possible to use the [CloudFormation intrinsic functions](https://docs.aws.amazon.com/en_en/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html) to reference resources from elsewhere. This allows for an IAM role to be created, and applied to the state machines all within the serverless file.

The below example shows the policy needed if your step function needs the ability to send a message to an sqs queue. To apply the role either the RoleName can be used as a reference in the state machine, or the role ARN can be used like in the example above. It is important to note that if you want to store your state machine role at a certain path, this must be specified on the `Path` property on the new role.

```yml
stepFunctions:
  stateMachines:
    hello:
      role:
        Fn::GetAtt: ["StateMachineRole", "Arn"]
      definition:
        ...

resources:
  Resources:
    StateMachineRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: RoleName
        Path: /path_of_state_machine_roles/
        AssumeRolePolicyDocument:
          Statement:
          - Effect: Allow
            Principal:
              Service:
                - states.amazonaws.com
            Action:
              - sts:AssumeRole
        Policies:
          - PolicyName: statePolicy
            PolicyDocument:
              Version: "2012-10-17"
              Statement:
                - Effect: Allow
                  Action:
                    - lambda:InvokeFunction
                  Resource:
                    - arn:aws:lambda:lambdaName
                - Effect: Allow
                  Action:
                    - sqs:SendMessage
                  Resource:
                    - arn:aws:sqs::xxxxxxxx:queueName
```

The short form of the intrinsic functions (i.e. `!Sub`, `!Ref`) is not supported at the moment.

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

### How to split up state machines into files

When you have a large serverless project with lots of state machines
your serverless.yml file can grow to a point where it is unmaintainable.

You can split step functions into external files and import them
into your serverless.yml file.

There are two ways you can do this:

#### Single external file

You can define the entire `stateMachines` block in a separate file
and import it in its entirety.

includes/state-machines.yml:

```yml
stateMachines:
  hellostepfunc1:
    name: myStateMachine1
    definition:
      <your definition>
  hellostepfunc2:
    name: myStateMachine2
    definition:
      <your definition>
```

serverless.yml:

```yml
stepFunctions:
  ${file(includes/state-machines.yml)}

plugins:
  - serverless-step-functions
```

#### Separate Files

You can split up the `stateMachines` block into separate files.

includes/state-machine-1.yml:

```yml
name: myStateMachine1
definition:
  <your definition>
```

includes/state-machine-2.yml:

```yml
name: myStateMachine2
definition:
  <your definition>
```

serverless.yml:

```yml
stepFunctions:
  stateMachines:
    hellostepfunc1:
      ${file(includes/state-machine-1.yml)}
    hellostepfunc2:
      ${file(includes/state-machine-2.yml)}

plugins:
  - serverless-step-functions
```

## Sample statemachines setting in serverless.yml

### Wait State

``` yaml
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
            Resource:
              Fn::GetAtt: [hello, Arn]
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
            Resource:
              Fn::GetAtt: [hello, Arn]
            End: true
plugins:
  - serverless-step-functions
  - serverless-pseudo-parameters
```

### Retry Failure

``` yaml
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
            Resource:
              Fn::GetAtt: [hello, Arn]
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
plugins:
  - serverless-step-functions
  - serverless-pseudo-parameters
```

### Parallel

```yaml
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
plugins:
  - serverless-step-functions
  - serverless-pseudo-parameters
```

### Catch Failure

```yaml
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
            Resource:
              Fn::GetAtt: [hello, Arn]
            Catch:
            - ErrorEquals: ["HandledError"]
              Next: CustomErrorFallback
            - ErrorEquals: ["States.TaskFailed"]
              Next: ReservedTypeFallback
            - ErrorEquals: ["States.ALL"]
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
plugins:
  - serverless-step-functions
  - serverless-pseudo-parameters
```

### Choice

```yaml
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
            Resource:
              Fn::GetAtt: [hello, Arn]
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
            Resource:
              Fn::GetAtt: [hello2, Arn]
            Next: NextState
          SecondMatchState:
            Type: Task
            Resource:
              Fn::GetAtt: [hello3, Arn]
            Next: NextState
          DefaultState:
            Type: Fail
            Cause: "No Matches!"
          NextState:
            Type: Task
            Resource:
              Fn::GetAtt: [hello4, Arn]
            End: true
plugins:
  - serverless-step-functions
  - serverless-pseudo-parameters
```

### Map

```yaml

functions:
  entry:
    handler: handler.entry
  mapTask:
    handler: handler.mapTask

stepFunctions:
  stateMachines:
    yourMapMachine:
      definition:
        Comment: "A Map example of the Amazon States Language using an AWS Lambda Function"
        StartAt: FirstState
        States:
          FirstState:
            Type: Task
            Resource:
              Fn::GetAtt: [entry, Arn]
            Next: mapped_task
          mapped_task:
            Type: Map
            Iterator:
              StartAt: FirstMapTask
              States:
                FirstMapTask:
                  Type: Task
                  Resource:
                    Fn::GetAtt: [mapTask, Arn]
                  End: true
            End: true

plugins:
  - serverless-step-functions
```
