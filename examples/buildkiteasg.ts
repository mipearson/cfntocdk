import * as cdk from "@aws-cdk/core";
import * as autoscaling from "@aws-cdk/aws-autoscaling";

export class BuildkiteasgStack extends cdk.Stack {
  constructor(parent: cdk.App, id: string, props?: cdk.StackProps) {
    super(parent, id, props);

    const subnets = new cdk.CfnParameter(this, "Subnets", {
      type: "CommaDelimitedList",
      description:
        "Optional - Comma separated list of two existing VPC subnet ids where EC2 instances will run. Required if setting VpcId.",
      default: ""
    });

    const maxSize = new cdk.CfnParameter(this, "MaxSize", {
      description: "Maximum number of instances",
      type: "Number",
      default: 10,
      minValue: 1
    });

    const minSize = new cdk.CfnParameter(this, "MinSize", {
      description: "Minimum number of instances",
      type: "Number",
      default: 0
    });

    const buildkiteAgentRelease = new cdk.CfnParameter(
      this,
      "BuildkiteAgentRelease",
      {
        type: "String",
        allowedValues: ["stable", "beta", "edge"],
        default: "stable"
      }
    );

    const buildkiteQueue = new cdk.CfnParameter(this, "BuildkiteQueue", {
      description:
        'Queue name that agents will use, targeted in pipeline steps using "queue={value}"',
      type: "String",
      default: "default",
      minLength: 1
    });

    const costAllocationTagName = new cdk.CfnParameter(
      this,
      "CostAllocationTagName",
      {
        type: "String",
        description:
          "The name of the Cost Allocation Tag used for billing purposes",
        default: "aws:createdBy"
      }
    );

    const costAllocationTagValue = new cdk.CfnParameter(
      this,
      "CostAllocationTagValue",
      {
        type: "String",
        description:
          "The value of the Cost Allocation Tag used for billing purposes",
        default: "buildkite-elastic-ci-stack-for-aws"
      }
    );

    const instanceCreationTimeout = new cdk.CfnParameter(
      this,
      "InstanceCreationTimeout",
      {
        description: "Timeout period for Autoscaling Group Creation Policy",
        type: "String",
        default: "PT5M"
      }
    );

    const agentLaunchConfiguration = new autoscaling.CfnLaunchConfiguration(
      this,
      "AgentLaunchConfiguration",
      { imageId: "ami-fff", instanceType: "m4.large" }
    );

    const agentAutoScaleGroup = new autoscaling.CfnAutoScalingGroup(
      this,
      "AgentAutoScaleGroup",
      {
        vpcZoneIdentifier: [subnets.value as any],
        launchConfigurationName: agentLaunchConfiguration.ref,
        minSize: minSize.value as any,
        maxSize: maxSize.value as any,
        metricsCollection: [
          {
            granularity: "1Minute",
            metrics: [
              "GroupMinSize",
              "GroupMaxSize",
              "GroupInServiceInstances",
              "GroupTerminatingInstances",
              "GroupPendingInstances"
            ]
          }
        ],
        terminationPolicies: [
          "OldestLaunchConfiguration",
          "ClosestToNextInstanceHour"
        ],
        tags: [
          { key: "Role", value: "buildkite-agent", propagateAtLaunch: true },
          { key: "Name", value: "buildkite-agent", propagateAtLaunch: true },
          {
            key: "BuildkiteAgentRelease",
            value: buildkiteAgentRelease.value as any,
            propagateAtLaunch: true
          },
          {
            key: "BuildkiteQueue",
            value: buildkiteQueue.value as any,
            propagateAtLaunch: true
          }
        ]
      }
    );
    agentAutoScaleGroup.cfnOptions.creationPolicy = {
      resourceSignal: {
        timeout: instanceCreationTimeout.value as any,
        count: minSize.value as any
      }
    };
    agentAutoScaleGroup.cfnOptions.updatePolicy = {
      autoScalingReplacingUpdate: { willReplace: true }
    };
  }
}
