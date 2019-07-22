'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileActivities() {
    if (this.isActivities()) {
      this.getAllActivities().forEach((activityName) => {
        const Name = this.getActivity(activityName);
        const activityLogicalId = this.getActivityLogicalId(activityName);
        const activityOutputLogicalId = this.getActivityOutputLogicalId(activityName);
        const activityTemplate = `
          {
            "Type": "AWS::StepFunctions::Activity",
            "Properties": {
              "Name": "${Name}"
            }
          }
        `;

        const newActivityObject = {
          [activityLogicalId]: JSON.parse(activityTemplate),
        };

        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
          newActivityObject);

        const activityOutPutObject = {
          Description: 'Current StateMachine Arn',
          Value: {
            Ref: activityLogicalId,
          },
        };

        const newActivityOutPutObject = {
          [activityOutputLogicalId]: activityOutPutObject,
        };

        _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Outputs,
          newActivityOutPutObject);
        return BbPromise.resolve();
      });
    }
  },
};
