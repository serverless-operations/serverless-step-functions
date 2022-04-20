'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileCloudWatchEventEvents() {
    _.forEach(this.getAllStateMachines(), (stateMachineName) => {
      const stateMachineObj = this.getStateMachine(stateMachineName);
      let eventRuleNumberInFunction = 0;

      if (stateMachineObj.events) {
        _.forEach(stateMachineObj.events, (event) => {
          const eventRule = event.cloudwatchEvent || event.eventBridge;

          if (eventRule) {
            eventRuleNumberInFunction++;
            let EventPattern;
            let State;
            let Input;
            let InputPath;
            let Description;
            let Name;
            let EventBusName;
            let IamRole;
            let InputTransformer;
            let InputPathsMap;
            let InputTemplate;
            let DeadLetterConfig;

            if (typeof eventRule === 'object') {
              if (!eventRule.event) {
                const errorMessage = [
                  `Missing "event" property for cloudwatch event in stateMachine ${stateMachineName}`, // eslint-disable-line max-len
                  ' Please check the docs for more info.',
                ].join('');
                throw new this.serverless.classes
                  .Error(errorMessage);
              }

              EventPattern = JSON.stringify(eventRule.event);
              State = 'ENABLED';
              if (eventRule.enabled === false) {
                State = 'DISABLED';
              }
              Input = eventRule.input;
              InputPath = eventRule.inputPath;
              InputTransformer = eventRule.inputTransformer;
              InputPathsMap = InputTransformer && eventRule.inputTransformer.inputPathsMap;
              InputTemplate = InputTransformer && eventRule.inputTransformer.inputTemplate;
              Description = eventRule.description;
              Name = eventRule.name;
              EventBusName = JSON.stringify(eventRule.eventBusName);
              IamRole = JSON.stringify(eventRule.iamRole);
              DeadLetterConfig = JSON.stringify(eventRule.deadLetterConfig);

              if ([Input, InputPath, InputTransformer].filter(Boolean).length > 1) {
                const errorMessage = [
                  'You can\'t set input, inputPath and inputTransformer properties at the',
                  'same time for cloudwatch events.',
                  'Please check the AWS docs for more info',
                ].join('');
                throw new this.serverless.classes.Error(errorMessage);
              }

              if (Input && typeof Input === 'object') {
                Input = JSON.stringify(Input);
              }
              if (Input && typeof Input === 'string') {
                // escape quotes to favor JSON.parse
                Input = Input.replace(/\"/g, '\\"'); // eslint-disable-line
              }

              // no need to escape quotes in inputPathsMap
              // because we add it as an object to the template
              if (InputPathsMap && typeof InputPathsMap === 'object') {
                InputPathsMap = JSON.stringify(InputPathsMap);
              }
              if (InputTemplate && typeof InputTemplate === 'string') {
                // escape quotes to favor JSON.parse
                InputTemplate = InputTemplate.replace(/\"/g, '\\"'); // eslint-disable-line
              }
            } else {
              const errorMessage = [
                `CloudWatch event of stateMachine "${stateMachineName}" is not an object`,
                ' Please check the docs for more info.',
              ].join('');
              throw new this.serverless.classes
                .Error(errorMessage);
            }

            const stateMachineLogicalId = this
              .getStateMachineLogicalId(stateMachineName, stateMachineObj);
            const cloudWatchLogicalId = this
              .getCloudWatchEventLogicalId(stateMachineName, eventRuleNumberInFunction);
            const cloudWatchIamRoleLogicalId = this
              .getCloudWatchEventToStepFunctionsIamRoleLogicalId(stateMachineName);
            const cloudWatchId = this.getCloudWatchEventId(stateMachineName);
            const policyName = this.getCloudWatchEventPolicyName(stateMachineName);

            const cloudWatchEventRuleTemplate = `
              {
                "Type": "AWS::Events::Rule",
                "Properties": {
                  ${EventBusName ? `"EventBusName": ${EventBusName},` : ''}
                  "EventPattern": ${EventPattern.replace(/\\n|\\r/g, '')},
                  "State": "${State}",
                  ${Description ? `"Description": "${Description}",` : ''}
                  ${Name ? `"Name": "${Name}",` : ''}
                  "Targets": [{
                    ${Input ? `"Input": "${Input.replace(/\\n|\\r/g, '')}",` : ''}
                    ${InputPath ? `"InputPath": "${InputPath.replace(/\r?\n/g, '')}",` : ''}
                    ${InputTransformer ? `"InputTransformer": {
                      "InputPathsMap": ${InputPathsMap},
                      "InputTemplate": "${InputTemplate}"
                    },` : ''}
                    "Arn": { "Ref": "${stateMachineLogicalId}" },
                    "Id": "${cloudWatchId}",
                    ${DeadLetterConfig ? `"DeadLetterConfig":{ "Arn" : ${DeadLetterConfig} },` : ''}
                    ${IamRole ? `"RoleArn": ${IamRole}` : `"RoleArn": {
                      "Fn::GetAtt": [
                        "${cloudWatchIamRoleLogicalId}",
                        "Arn"
                      ]
                    }`}
                  }]
                }
              }
            `;

            const iamRoleTemplate = `
            {
              "Type": "AWS::IAM::Role",
              "Properties": {
                "AssumeRolePolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {
                        "Service": "events.amazonaws.com"
                      },
                      "Action": "sts:AssumeRole"
                    }
                  ]
                },
                "Policies": [
                  {
                    "PolicyName": "${policyName}",
                    "PolicyDocument": {
                      "Version": "2012-10-17",
                      "Statement": [
                        {
                          "Effect": "Allow",
                          "Action": [
                            "states:StartExecution"
                          ],
                          "Resource": {
                            "Ref": "${stateMachineLogicalId}"
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
            `;

            const newCloudWatchEventRuleObject = {
              [cloudWatchLogicalId]: JSON.parse(cloudWatchEventRuleTemplate),
            };

            const objectsToMerge = [newCloudWatchEventRuleObject];

            if (!IamRole) {
              const newPermissionObject = {
                [cloudWatchIamRoleLogicalId]: JSON.parse(iamRoleTemplate),
              };

              objectsToMerge.push(newPermissionObject);
            }

            _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
              ...objectsToMerge);
          }
        });
      }
    });
    return BbPromise.resolve();
  },
};
