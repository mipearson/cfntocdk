import cdk = require("@aws-cdk/cdk");
import autoscaling = require("@aws-cdk/aws-autoscaling");

export class BuildkiteasgStack extends cdk.Stack {
  constructor(parent: cdk.App, id: string, props?: cdk.StackProps) {
    super(parent, id, props);

    const subnets = new cdk.Parameter(this, "Subnets", {
      type: "CommaDelimitedList",
      description:
        "Optional - Comma separated list of two existing VPC subnet ids where EC2 instances will run. Required if setting VpcId.",
      default: ""
    });

    const maxSize = new cdk.Parameter(this, "MaxSize", {
      description: "Maximum number of instances",
      type: "Number",
      default: 10,
      minValue: 1
    });

    const minSize = new cdk.Parameter(this, "MinSize", {
      description: "Minimum number of instances",
      type: "Number",
      default: 0
    });

    const buildkiteAgentRelease = new cdk.Parameter(
      this,
      "BuildkiteAgentRelease",
      {
        type: "String",
        allowedValues: ["stable", "beta", "edge"],
        default: "stable"
      }
    );

    const buildkiteQueue = new cdk.Parameter(this, "BuildkiteQueue", {
      description:
        'Queue name that agents will use, targeted in pipeline steps using "queue={value}"',
      type: "String",
      default: "default",
      minLength: 1
    });

    const costAllocationTagName = new cdk.Parameter(
      this,
      "CostAllocationTagName",
      {
        type: "String",
        description:
          "The name of the Cost Allocation Tag used for billing purposes",
        default: "aws:createdBy"
      }
    );

    const costAllocationTagValue = new cdk.Parameter(
      this,
      "CostAllocationTagValue",
      {
        type: "String",
        description:
          "The value of the Cost Allocation Tag used for billing purposes",
        default: "buildkite-elastic-ci-stack-for-aws"
      }
    );

    const agentLaunchConfiguration = new autoscaling.CfnLaunchConfiguration(
      this,
      "AgentLaunchConfiguration",
      { imageId: "ami-fff", instanceType: "m4.large" }
    );

    new autoscaling.CfnAutoScalingGroup(this, "AgentAutoScaleGroup", {
      vpcZoneIdentifier: [subnets.ref],
      launchConfigurationName: agentLaunchConfiguration.ref,
      minSize: minSize.ref,
      maxSize: maxSize.ref,
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
          value: buildkiteAgentRelease.ref,
          propagateAtLaunch: true
        },
        {
          key: "BuildkiteQueue",
          value: buildkiteQueue.ref,
          propagateAtLaunch: true
        },
        new cdk.FnIf(
          "UseCostAllocationTags",
          {
            Key: costAllocationTagName.ref,
            Value: costAllocationTagValue.ref,
            PropagateAtLaunch: true
          },
          new cdk.AwsNoValue()
        )
      ]
    });
  }
}
