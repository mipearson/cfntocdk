import * as cdk from "@aws-cdk/core";
import * as cloudtrail from "@aws-cdk/aws-cloudtrail";

export class CloudtrailStack extends cdk.Stack {
  constructor(parent: cdk.App, id: string, props?: cdk.StackProps) {
    super(parent, id, props);

    const loggingBucket = new cdk.CfnParameter(this, "LoggingBucket", {
      description: "The name of the bucket to send cloudtrail logs to",
      type: "String"
    });

    const unused = new cdk.CfnParameter(this, "Unused", {
      description: "An unused parameter to test ref checks",
      type: "String"
    });

    const cloudTrail = new cloudtrail.CfnTrail(this, "CloudTrail", {
      isLogging: true,
      isMultiRegionTrail: true,
      includeGlobalServiceEvents: true,
      s3BucketName: loggingBucket.value as any,
      s3KeyPrefix: "cloudtrails"
    });
  }
}
