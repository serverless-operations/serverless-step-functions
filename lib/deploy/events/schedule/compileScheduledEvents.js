'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

const METHOD_SCHEDULER = 'scheduler';
const METHOD_EVENT_BUS = 'eventBus';
module.exports = {
  compileScheduledEvents() {
    const service = this.serverless.service;
    const permissionsBoundary = service.provider.rolePermissionsBoundary;
    _.forEach(this.getAllStateMachines(), (stateMachineName) => {
      const stateMachineObj = this.getStateMachine(stateMachineName);
      let scheduleNumberInFunction = 0;

      if (stateMachineObj.events) {
        _.forEach(stateMachineObj.events, (event) => {
          if (event.schedule) {
            scheduleNumberInFunction++;
            let ScheduleExpression;
            let State;
            let Input;
            let InputPath;
            let InputTransformer;
            let InputTemplate;
            let InputPathsMap;
            let Name;
            let Description;
            let method;
            let timezone;

            // TODO validate rate syntax
            if (typeof event.schedule === 'object') {
              if (!event.schedule.rate) {
                const errorMessage = [
                  `Missing "rate" property for schedule event in stateMachine ${stateMachineName}`,
                  ' The correct syntax is: schedule: rate(10 minutes)',
                  ' OR an object with "rate" property.',
                  ' Please check the README for more info.',
                ].join('');
                throw new this.serverless.classes
                  .Error(errorMessage);
              }
              ScheduleExpression = event.schedule.rate;
              State = 'ENABLED';
              if (event.schedule.enabled === false) {
                State = 'DISABLED';
              }
              Input = event.schedule.input;
              InputPath = event.schedule.inputPath;
              InputTransformer = event.schedule.inputTransformer;
              InputPathsMap = InputTransformer && event.schedule.inputTransformer.inputPathsMap;
              InputTemplate = InputTransformer && event.schedule.inputTransformer.inputTemplate;
              Name = event.schedule.name;
              Description = event.schedule.description;
              method = event.schedule.method || METHOD_EVENT_BUS;
              timezone = event.schedule.timezone;

              if ([Input, InputPath, InputTransformer].filter(Boolean).length > 1) {
                const errorMessage = [
                  'You can\'t set both input & inputPath properties at the',
                  'same time for schedule events.',
                  'Please check the AWS docs for more info',
                ].join('');
                throw new this.serverless.classes
                  .Error(errorMessage);
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
              if (InputTransformer) {
                if (method === METHOD_SCHEDULER) {
                  const errorMessage = [
                    'Cannot setup "schedule" event: "inputTransformer" is not supported with "scheduler" mode',
                  ].join('');
                  throw new this.serverless.classes
                    .Error(errorMessage);
                }
              }
              if (InputPath && method === METHOD_SCHEDULER) {
                const errorMessage = [
                  'Cannot setup "schedule" event: "inputPath" is not supported with "scheduler" mode',
                ].join('');
                throw new this.serverless.classes
                  .Error(errorMessage);
              }
              if (timezone && method !== METHOD_SCHEDULER) {
                const errorMessage = [
                  'Cannot setup "schedule" event: "timezone" is only supported with "scheduler" mode',
                ].join('');
                throw new this.serverless.classes
                  .Error(errorMessage);
              }
            } else if (typeof event.schedule === 'string') {
              ScheduleExpression = event.schedule;
              State = 'ENABLED';
            } else {
              const errorMessage = [
                `Schedule event of stateMachine ${stateMachineName} is not an object nor a string`,
                ' The correct syntax is: schedule: rate(10 minutes)',
                ' OR an object with "rate" property.',
                ' Please check the README for more info.',
              ].join('');
              throw new this.serverless.classes
                .Error(errorMessage);
            }

            const stateMachineLogicalId = this
              .getStateMachineLogicalId(stateMachineName, stateMachineObj);
            const scheduleLogicalId = method !== METHOD_SCHEDULER ? this
              .getScheduleLogicalId(stateMachineName, scheduleNumberInFunction) : this
              .getSchedulerScheduleLogicalId(stateMachineName, scheduleNumberInFunction);
            const scheduleIamRoleLogicalId = this
              .getScheduleToStepFunctionsIamRoleLogicalId(stateMachineName);
            const scheduleId = this.getScheduleId(stateMachineName);
            const policyName = this.getSchedulePolicyName(stateMachineName);

            const roleArn = event.schedule.role
              ? JSON.stringify(event.schedule.role)
              : `
                {
                  "Fn::GetAtt": [
                    "${scheduleIamRoleLogicalId}",
                    "Arn"
                  ]
                }
              `;

            let scheduleTemplate;
            let iamRoleTemplate;
            // If condition for the event bridge schedular and it define
            // resource template and iamrole for the same
            if (method === METHOD_SCHEDULER) {
              scheduleTemplate = `{
              "Type": "AWS::Scheduler::Schedule",
              "Properties": {
                "ScheduleExpression": "${ScheduleExpression}",
                "State": "${State}",
                ${timezone ? `"ScheduleExpressionTimezone": "${timezone}",` : ''}
                ${Name ? `"Name": "${Name}",` : ''}
                ${Description ? `"Description": "${Description}",` : ''}
                "Target": {
                  "Arn": { "Ref": "${stateMachineLogicalId}" },
                  "RoleArn": ${roleArn}
                  ${Input ? `,"Input": "${Input}"` : ''}
                },
                "FlexibleTimeWindow": {
                  "Mode": "OFF"
                }
              }
            }`;

              iamRoleTemplate = `{
            "Type": "AWS::IAM::Role",
            "Properties": {
              "AssumeRolePolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                  {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "scheduler.amazonaws.com"
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
          }`;
            } else {
              // else condition for the event rule and
              // it define resource template and iamrole for the same
              scheduleTemplate = `{
                "Type": "AWS::Events::Rule",
                "Properties": {
                  "ScheduleExpression": "${ScheduleExpression}",
                  "State": "${State}",
                  ${Name ? `"Name": "${Name}",` : ''}
                  ${Description ? `"Description": "${Description}",` : ''}
                  "Targets": [{
                    ${Input ? `"Input": "${Input}",` : ''}
                    ${InputPath ? `"InputPath": "${InputPath}",` : ''}
                    ${InputTransformer ? `"InputTransformer": {
                      "InputPathsMap": ${InputPathsMap},
                      "InputTemplate": "${InputTemplate}"
                    },` : ''}
                    "Arn": { "Ref": "${stateMachineLogicalId}" },
                    "Id": "${scheduleId}",
                    "RoleArn": ${roleArn}
                  }]
                }
              }`;
              iamRoleTemplate = `{
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
            }`;
            }
            if (permissionsBoundary) {
              const jsonIamRole = JSON.parse(iamRoleTemplate);
              jsonIamRole.Properties.PermissionsBoundary = permissionsBoundary;
              iamRoleTemplate = JSON.stringify(jsonIamRole);
            }

            const newScheduleObject = {
              [scheduleLogicalId]: JSON.parse(scheduleTemplate),
            };

            const newPermissionObject = event.schedule.role ? {} : {
              [scheduleIamRoleLogicalId]: JSON.parse(iamRoleTemplate),
            };

            _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
              newScheduleObject, newPermissionObject);
          }
        });
      }
    });
    return BbPromise.resolve();
  },
};
