'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileScheduledEvents() {
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
            let Name;
            let Description;

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
              Name = event.schedule.name;
              Description = event.schedule.description;

              if (Input && InputPath) {
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
            const scheduleLogicalId = this
              .getScheduleLogicalId(stateMachineName, scheduleNumberInFunction);
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

            const scheduleTemplate = `
              {
                "Type": "AWS::Events::Rule",
                "Properties": {
                  "ScheduleExpression": "${ScheduleExpression}",
                  "State": "${State}",
                  ${Name ? `"Name": "${Name}",` : ''}
                  ${Description ? `"Description": "${Description}",` : ''}
                  "Targets": [{
                    ${Input ? `"Input": "${Input}",` : ''}
                    ${InputPath ? `"InputPath": "${InputPath}",` : ''}
                    "Arn": { "Ref": "${stateMachineLogicalId}" },
                    "Id": "${scheduleId}",
                    "RoleArn": ${roleArn}
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
