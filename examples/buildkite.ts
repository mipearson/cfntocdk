import cdk = require("@aws-cdk/cdk");
import ec2 = require("@aws-cdk/aws-ec2");
import iam = require("@aws-cdk/aws-iam");
import s3 = require("@aws-cdk/aws-s3");
import autoscaling = require("@aws-cdk/aws-autoscaling");
import sns = require("@aws-cdk/aws-sns");
import cloudwatch = require("@aws-cdk/aws-cloudwatch");
import lambda = require("@aws-cdk/aws-lambda");
import events = require("@aws-cdk/aws-events");

export class BuildkiteStack extends cdk.Stack {
  constructor(parent: cdk.App, id: string, props?: cdk.StackProps) {
    super(parent, id, props);

    const keyName = new cdk.Parameter(this, "KeyName", {
      description:
        "Optional - SSH keypair used to access the buildkite instances, setting this will enable SSH ingress",
      type: "String",
      default: ""
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

    const buildkiteAgentToken = new cdk.Parameter(this, "BuildkiteAgentToken", {
      description: "Buildkite agent registration token",
      type: "String",
      noEcho: true,
      minLength: 1
    });

    const buildkiteAgentTags = new cdk.Parameter(this, "BuildkiteAgentTags", {
      description:
        "Additional tags seperated by commas to provide to the agent. E.g os=linux,llamas=always",
      type: "String",
      default: ""
    });

    const buildkiteAgentTimestampLines = new cdk.Parameter(
      this,
      "BuildkiteAgentTimestampLines",
      {
        description:
          "Set to true to prepend timestamps to every line of output",
        type: "String",
        allowedValues: ["true", "false"],
        default: "false"
      }
    );

    const buildkiteAgentExperiments = new cdk.Parameter(
      this,
      "BuildkiteAgentExperiments",
      {
        description:
          "Agent experiments to enable, comma delimited. See https://github.com/buildkite/agent/blob/master/EXPERIMENTS.md.",
        type: "String",
        default: ""
      }
    );

    const buildkiteQueue = new cdk.Parameter(this, "BuildkiteQueue", {
      description:
        'Queue name that agents will use, targeted in pipeline steps using "queue={value}"',
      type: "String",
      default: "default",
      minLength: 1
    });

    const agentsPerInstance = new cdk.Parameter(this, "AgentsPerInstance", {
      description: "Number of Buildkite agents to run on each instance",
      type: "Number",
      default: 1,
      minValue: 1
    });

    const secretsBucket = new cdk.Parameter(this, "SecretsBucket", {
      description:
        "Optional - Name of an existing S3 bucket containing pipeline secrets (Created if left blank)",
      type: "String",
      default: ""
    });

    const artifactsBucket = new cdk.Parameter(this, "ArtifactsBucket", {
      description:
        "Optional - Name of an existing S3 bucket for build artifact storage",
      type: "String",
      default: ""
    });

    const bootstrapScriptUrl = new cdk.Parameter(this, "BootstrapScriptUrl", {
      description:
        "Optional - HTTPS or S3 URL to run on each instance during boot",
      type: "String",
      default: ""
    });

    const authorizedUsersUrl = new cdk.Parameter(this, "AuthorizedUsersUrl", {
      description:
        "Optional - HTTPS or S3 URL to periodically download ssh authorized_keys from, setting this will enable SSH ingress",
      type: "String",
      default: ""
    });

    const vpcId = new cdk.Parameter(this, "VpcId", {
      type: "String",
      description:
        "Optional - Id of an existing VPC to launch instances into. Leave blank to have a new VPC created",
      default: ""
    });

    const subnets = new cdk.Parameter(this, "Subnets", {
      type: "CommaDelimitedList",
      description:
        "Optional - Comma separated list of two existing VPC subnet ids where EC2 instances will run. Required if setting VpcId.",
      default: ""
    });

    const availabilityZones = new cdk.Parameter(this, "AvailabilityZones", {
      type: "CommaDelimitedList",
      description:
        "Optional - Comma separated list of AZs that subnets are created in (if Subnets parameter is not specified)",
      default: ""
    });

    const instanceType = new cdk.Parameter(this, "InstanceType", {
      description: "Instance type",
      type: "String",
      default: "t2.nano",
      minLength: 1
    });

    const spotPrice = new cdk.Parameter(this, "SpotPrice", {
      description:
        "Spot bid price to use for the instances. 0 means normal (non-spot) instances",
      type: "String",
      default: 0
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

    const scaleUpAdjustment = new cdk.Parameter(this, "ScaleUpAdjustment", {
      description:
        "Number of instances to add on scale up events (ScheduledJobsCount > 0 for 1 min)",
      type: "Number",
      default: 5,
      minValue: 0
    });

    const scaleDownAdjustment = new cdk.Parameter(this, "ScaleDownAdjustment", {
      description:
        "Number of instances to remove on scale down events (UnfinishedJobs == 0 for ScaleDownPeriod)",
      type: "Number",
      default: -1,
      maxValue: 0
    });

    const scaleDownPeriod = new cdk.Parameter(this, "ScaleDownPeriod", {
      description:
        "Number of seconds UnfinishedJobs must equal 0 before scale down",
      type: "Number",
      default: 1800
    });

    const instanceCreationTimeout = new cdk.Parameter(
      this,
      "InstanceCreationTimeout",
      {
        description: "Timeout period for Autoscaling Group Creation Policy",
        type: "String",
        default: "PT5M"
      }
    );

    const rootVolumeSize = new cdk.Parameter(this, "RootVolumeSize", {
      description: "Size of each instance's root EBS volume (in GB)",
      type: "Number",
      default: 250,
      minValue: 10
    });

    const securityGroupId = new cdk.Parameter(this, "SecurityGroupId", {
      type: "String",
      description: "Optional - Security group id to assign to instances",
      default: ""
    });

    const imageId = new cdk.Parameter(this, "ImageId", {
      type: "String",
      description:
        "Optional - Custom AMI to use for instances (must be based on the stack's AMI)",
      default: ""
    });

    const managedPolicyArn = new cdk.Parameter(this, "ManagedPolicyARN", {
      type: "CommaDelimitedList",
      description:
        "Optional - Comma separated list of managed IAM policy ARNs to attach to the instance role",
      default: ""
    });

    const instanceRoleName = new cdk.Parameter(this, "InstanceRoleName", {
      type: "String",
      description:
        "Optional - A name for the IAM Role attached to the Instance Profile",
      default: ""
    });

    const ecrAccessPolicy = new cdk.Parameter(this, "ECRAccessPolicy", {
      type: "String",
      description: "ECR access policy to give container instances",
      allowedValues: ["none", "readonly", "poweruser", "full"],
      default: "none"
    });

    const associatePublicIpAddress = new cdk.Parameter(
      this,
      "AssociatePublicIpAddress",
      {
        type: "String",
        description: "Associate instances with public IP addresses",
        allowedValues: ["true", "false"],
        default: "true"
      }
    );

    const enableSecretsPlugin = new cdk.Parameter(this, "EnableSecretsPlugin", {
      type: "String",
      description: "Enables s3-secrets plugin for all pipelines",
      allowedValues: ["true", "false"],
      default: "true"
    });

    const enableEcrPlugin = new cdk.Parameter(this, "EnableECRPlugin", {
      type: "String",
      description: "Enables ecr plugin for all pipelines",
      allowedValues: ["true", "false"],
      default: "true"
    });

    const enableDockerLoginPlugin = new cdk.Parameter(
      this,
      "EnableDockerLoginPlugin",
      {
        type: "String",
        description: "Enables docker-login plugin for all pipelines",
        allowedValues: ["true", "false"],
        default: "true"
      }
    );

    const enableDockerUserNamespaceRemap = new cdk.Parameter(
      this,
      "EnableDockerUserNamespaceRemap",
      {
        type: "String",
        description:
          "Enables Docker user namespace remapping so docker runs as buildkite-agent",
        allowedValues: ["true", "false"],
        default: "true"
      }
    );

    const enableDockerExperimental = new cdk.Parameter(
      this,
      "EnableDockerExperimental",
      {
        type: "String",
        description: "Enables Docker experimental features",
        allowedValues: ["true", "false"],
        default: "false"
      }
    );

    const enableCostAllocationTags = new cdk.Parameter(
      this,
      "EnableCostAllocationTags",
      {
        type: "String",
        description:
          "Enables AWS Cost Allocation tags for all resources in the stack. See https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html",
        allowedValues: ["true", "false"],
        default: "false"
      }
    );

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

    new cdk.Mapping(this, "ECRManagedPolicy", {
      mapping: {
        none: { Policy: "" },
        readonly: {
          Policy: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
        },
        poweruser: {
          Policy: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
        },
        full: {
          Policy: "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
        }
      }
    });

    new cdk.Mapping(this, "MetricsLambdaBucket", {
      mapping: {
        "us-east-1": { Bucket: "buildkite-metrics" },
        "us-east-2": { Bucket: "buildkite-metrics-us-east-2" },
        "us-west-1": { Bucket: "buildkite-metrics-us-west-1" },
        "us-west-2": { Bucket: "buildkite-metrics-us-west-2" },
        "eu-west-1": { Bucket: "buildkite-metrics-eu-west-1" },
        "eu-west-2": { Bucket: "buildkite-metrics-eu-west-2" },
        "eu-central-1": { Bucket: "buildkite-metrics-eu-central-1" },
        "ap-northeast-1": { Bucket: "buildkite-metrics-ap-northeast-1" },
        "ap-northeast-2": { Bucket: "buildkite-metrics-ap-northeast-2" },
        "ap-southeast-1": { Bucket: "buildkite-metrics-ap-southeast-1" },
        "ap-southeast-2": { Bucket: "buildkite-metrics-ap-southeast-2" },
        "ap-south-1": { Bucket: "buildkite-metrics-ap-south-1" },
        "sa-east-1": { Bucket: "buildkite-metrics-sa-east-1" }
      }
    });

    new cdk.Mapping(this, "AWSRegion2AMI", {
      mapping: {
        "us-east-1": { AMI: "ami-08361b08a1bdc52ce" },
        "us-east-2": { AMI: "ami-0de84efc5bd5d8f45" },
        "us-west-1": { AMI: "ami-0d7b8f53098f0832e" },
        "us-west-2": { AMI: "ami-024906a3f49a723c0" },
        "eu-west-1": { AMI: "ami-081315bd246893405" },
        "eu-west-2": { AMI: "ami-0d8ad4c20a873b867" },
        "eu-central-1": { AMI: "ami-03889b1fc23df65d7" },
        "ap-northeast-1": { AMI: "ami-07e9586052fa7e87b" },
        "ap-northeast-2": { AMI: "ami-0846198638b500217" },
        "ap-southeast-1": { AMI: "ami-0a298ef89b00a97b9" },
        "ap-southeast-2": { AMI: "ami-0a541d0604bff3890" },
        "ap-south-1": { AMI: "ami-0283d0ab170de1f81" },
        "sa-east-1": { AMI: "ami-06e329498e6ae405b" }
      }
    });

    const useSpotInstances = new cdk.Condition(this, "UseSpotInstances", {
      expression: new cdk.FnNot(new cdk.FnEquals(spotPrice.resolve(), 0))
    });

    const createVpcResources = new cdk.Condition(this, "CreateVpcResources", {
      expression: new cdk.FnEquals(vpcId.resolve(), "")
    });

    const createSecurityGroup = new cdk.Condition(this, "CreateSecurityGroup", {
      expression: new cdk.FnEquals(securityGroupId.resolve(), "")
    });

    const createSecretsBucket = new cdk.Condition(this, "CreateSecretsBucket", {
      expression: new cdk.FnEquals(secretsBucket.resolve(), "")
    });

    const setInstanceRoleName = new cdk.Condition(this, "SetInstanceRoleName", {
      expression: new cdk.FnNot(
        new cdk.FnEquals(instanceRoleName.resolve(), "")
      )
    });

    const useSpecifiedSecretsBucket = new cdk.Condition(
      this,
      "UseSpecifiedSecretsBucket",
      {
        expression: new cdk.FnNot(new cdk.FnEquals(secretsBucket.resolve(), ""))
      }
    );

    const useSpecifiedAvailabilityZones = new cdk.Condition(
      this,
      "UseSpecifiedAvailabilityZones",
      {
        expression: new cdk.FnNot(
          new cdk.FnEquals(new cdk.FnJoin("", availabilityZones.resolve()), "")
        )
      }
    );

    const useArtifactsBucket = new cdk.Condition(this, "UseArtifactsBucket", {
      expression: new cdk.FnNot(new cdk.FnEquals(artifactsBucket.resolve(), ""))
    });

    const useDefaultAmi = new cdk.Condition(this, "UseDefaultAMI", {
      expression: new cdk.FnEquals(imageId.resolve(), "")
    });

    const useManagedPolicyArn = new cdk.Condition(this, "UseManagedPolicyARN", {
      expression: new cdk.FnNot(
        new cdk.FnEquals(new cdk.FnJoin("", managedPolicyArn.resolve()), "")
      )
    });

    const useEcr = new cdk.Condition(this, "UseECR", {
      expression: new cdk.FnNot(
        new cdk.FnEquals(ecrAccessPolicy.resolve(), "none")
      )
    });

    const useAutoscaling = new cdk.Condition(this, "UseAutoscaling", {
      expression: new cdk.FnNot(
        new cdk.FnEquals(maxSize.resolve(), minSize.resolve())
      )
    });

    const createMetricsStack = new cdk.Condition(this, "CreateMetricsStack", {
      expression: new cdk.Fn("Condition", "UseAutoscaling")
    });

    const useCostAllocationTags = new cdk.Condition(
      this,
      "UseCostAllocationTags",
      {
        expression: new cdk.FnEquals(enableCostAllocationTags.resolve(), "true")
      }
    );

    const hasKeyName = new cdk.Condition(this, "HasKeyName", {
      expression: new cdk.FnNot(new cdk.FnEquals(keyName.resolve(), ""))
    });

    const enableSshIngress = new cdk.Condition(this, "EnableSshIngress", {
      expression: new cdk.FnAnd(
        new cdk.Fn("Condition", "CreateSecurityGroup"),
        new cdk.FnOr(
          new cdk.Fn("Condition", "HasKeyName"),
          new cdk.FnNot(new cdk.FnEquals(authorizedUsersUrl.resolve(), ""))
        )
      )
    });

    const hasManagedPolicies = new cdk.Condition(this, "HasManagedPolicies", {
      expression: new cdk.FnOr(
        new cdk.Fn("Condition", "UseManagedPolicyARN"),
        new cdk.Fn("Condition", "UseECR")
      )
    });

    const lambdaExecutionRole = new iam.CfnRole(this, "LambdaExecutionRole", {
      assumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: ["lambda.amazonaws.com"] },
            Action: ["sts:AssumeRole"]
          }
        ]
      },
      path: "/"
    });
    lambdaExecutionRole.options.condition = createMetricsStack;

    const lambdaExecutionPolicy = new iam.CfnPolicy(
      this,
      "LambdaExecutionPolicy",
      {
        policyName: "AccessToCloudwatchForBuildkiteMetrics",
        roles: [lambdaExecutionRole.ref],
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "cloudwatch:PutMetricData"
              ],
              Resource: ["*"]
            }
          ]
        }
      }
    );
    lambdaExecutionPolicy.options.condition = createMetricsStack;

    const buildkiteMetricsFunction = new lambda.CfnFunction(
      this,
      "BuildkiteMetricsFunction",
      {
        code: {
          s3Bucket: new cdk.FnFindInMap(
            "MetricsLambdaBucket",
            `${new cdk.AwsRegion()}`,
            "Bucket"
          ),
          s3Key: "buildkite-metrics-v3.0.0-lambda.zip"
        },
        role: new cdk.FnGetAtt("LambdaExecutionRole", "Arn"),
        timeout: 120,
        handler: "handler.handle",
        runtime: "python2.7",
        memorySize: 128,
        environment: {
          variables: {
            BUILDKITE_AGENT_TOKEN: buildkiteAgentToken.resolve(),
            BUILDKITE_QUEUE: buildkiteQueue.resolve(),
            AWS_STACK_ID: `${new cdk.AwsStackId()}`,
            AWS_STACK_NAME: `${new cdk.AwsStackName()}`,
            AWS_ACCOUNT_ID: `${new cdk.AwsAccountId()}`
          }
        }
      }
    );
    buildkiteMetricsFunction.options.condition = createMetricsStack;
    buildkiteMetricsFunction.addDependency(lambdaExecutionPolicy);

    const permissionForEventsToInvokeLambda = new lambda.CfnPermission(
      this,
      "PermissionForEventsToInvokeLambda",
      {
        functionName: buildkiteMetricsFunction.ref,
        action: "lambda:InvokeFunction",
        principal: "events.amazonaws.com",
        sourceArn: new cdk.FnGetAtt("ScheduledRule", "Arn")
      }
    );
    permissionForEventsToInvokeLambda.options.condition = createMetricsStack;

    const scheduledRule = new events.CfnRule(this, "ScheduledRule", {
      description: "ScheduledRule",
      scheduleExpression: "rate(1 minute)",
      state: "ENABLED",
      targets: [
        {
          arn: new cdk.FnGetAtt("BuildkiteMetricsFunction", "Arn"),
          id: "TargetBuildkiteMetricsFunction"
        }
      ]
    });
    scheduledRule.options.condition = createMetricsStack;

    const managedSecretsLoggingBucket = new s3.CfnBucket(
      this,
      "ManagedSecretsLoggingBucket",
      { accessControl: "LogDeliveryWrite" }
    );
    managedSecretsLoggingBucket.options.deletionPolicy =
      cdk.DeletionPolicy.Retain;
    managedSecretsLoggingBucket.options.condition = createSecretsBucket;

    const managedSecretsBucket = new s3.CfnBucket(
      this,
      "ManagedSecretsBucket",
      {
        loggingConfiguration: {
          destinationBucketName: managedSecretsLoggingBucket.ref
        },
        versioningConfiguration: { status: "Enabled" }
      }
    );
    managedSecretsBucket.options.deletionPolicy = cdk.DeletionPolicy.Retain;
    managedSecretsBucket.options.condition = createSecretsBucket;

    const iamRole = new iam.CfnRole(this, "IAMRole", {
      roleName: new cdk.FnIf(
        "SetInstanceRoleName",
        instanceRoleName.resolve(),
        new cdk.FnSub("${AWS::StackName}-Role")
      ),
      managedPolicyArns: new cdk.FnIf(
        "HasManagedPolicies",
        new cdk.FnSplit(
          ",",
          new cdk.FnJoin(",", [
            new cdk.FnIf(
              "UseECR",
              new cdk.FnFindInMap(
                "ECRManagedPolicy",
                ecrAccessPolicy.resolve(),
                "Policy"
              ),
              `${new cdk.AwsNoValue()}`
            ),
            new cdk.FnIf(
              "UseManagedPolicyARN",
              new cdk.FnJoin(",", managedPolicyArn.resolve()),
              `${new cdk.AwsNoValue()}`
            )
          ])
        ),
        `${new cdk.AwsNoValue()}`
      ),
      assumeRolePolicyDocument: {
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: ["autoscaling.amazonaws.com", "ec2.amazonaws.com"]
            },
            Action: "sts:AssumeRole"
          }
        ]
      },
      path: "/"
    });

    const iamInstanceProfile = new iam.CfnInstanceProfile(
      this,
      "IAMInstanceProfile",
      { path: "/", roles: [iamRole.ref] }
    );

    const vpc = new ec2.CfnVPC(this, "Vpc", {
      cidrBlock: "10.0.0.0/16",
      instanceTenancy: "default",
      tags: [{ key: "Name", value: `${new cdk.AwsStackName()}` }]
    });
    vpc.options.condition = createVpcResources;

    const securityGroup = new ec2.CfnSecurityGroup(this, "SecurityGroup", {
      groupDescription: "Enable access to agents",
      vpcId: new cdk.FnIf("CreateVpcResources", vpc.ref, vpcId.resolve()),
      tags: [{ key: "Name", value: `${new cdk.AwsStackName()}` }]
    });
    securityGroup.options.condition = createSecurityGroup;

    const agentLaunchConfiguration = new autoscaling.CfnLaunchConfiguration(
      this,
      "AgentLaunchConfiguration",
      {
        associatePublicIpAddress: associatePublicIpAddress.resolve(),
        securityGroups: [
          new cdk.FnIf(
            "CreateSecurityGroup",
            securityGroup.ref,
            securityGroupId.resolve()
          )
        ],
        keyName: new cdk.FnIf(
          "HasKeyName",
          keyName.resolve(),
          `${new cdk.AwsNoValue()}`
        ),
        iamInstanceProfile: iamInstanceProfile.ref,
        instanceType: instanceType.resolve(),
        spotPrice: new cdk.FnIf(
          "UseSpotInstances",
          spotPrice.resolve(),
          `${new cdk.AwsNoValue()}`
        ),
        imageId: new cdk.FnIf(
          "UseDefaultAMI",
          new cdk.FnFindInMap("AWSRegion2AMI", `${new cdk.AwsRegion()}`, "AMI"),
          imageId.resolve()
        ),
        blockDeviceMappings: [
          {
            deviceName: "/dev/xvda",
            ebs: { volumeSize: rootVolumeSize.resolve(), volumeType: "gp2" }
          }
        ],
        userData: new cdk.FnBase64(
          new cdk.FnSub(
            'Content-Type: multipart/mixed; boundary="==BOUNDARY=="\nMIME-Version: 1.0\n--==BOUNDARY==\nContent-Type: text/cloud-boothook; charset="us-ascii"\nDOCKER_USERNS_REMAP=${EnableDockerUserNamespaceRemap} \\\nDOCKER_EXPERIMENTAL=${EnableDockerExperimental} \\\n  /usr/local/bin/bk-configure-docker.sh\n\n--==BOUNDARY==\nContent-Type: text/x-shellscript; charset="us-ascii"\n#!/bin/bash -xv\nBUILDKITE_STACK_NAME="${AWS::StackName}" \\\nBUILDKITE_STACK_VERSION=v4.0.2 \\\nBUILDKITE_SECRETS_BUCKET="${LocalSecretsBucket}" \\\nBUILDKITE_AGENT_TOKEN="${BuildkiteAgentToken}" \\\nBUILDKITE_AGENTS_PER_INSTANCE="${AgentsPerInstance}" \\\nBUILDKITE_AGENT_TAGS="${BuildkiteAgentTags}" \\\nBUILDKITE_AGENT_TIMESTAMP_LINES="${BuildkiteAgentTimestampLines}" \\\nBUILDKITE_AGENT_EXPERIMENTS="${BuildkiteAgentExperiments}" \\\nBUILDKITE_AGENT_RELEASE="${BuildkiteAgentRelease}" \\\nBUILDKITE_QUEUE="${BuildkiteQueue}" \\\nBUILDKITE_ELASTIC_BOOTSTRAP_SCRIPT="${BootstrapScriptUrl}" \\\nBUILDKITE_AUTHORIZED_USERS_URL="${AuthorizedUsersUrl}" \\\nBUILDKITE_ECR_POLICY=${ECRAccessPolicy} \\\nBUILDKITE_LIFECYCLE_TOPIC=${AgentLifecycleTopic} \\\nAWS_DEFAULT_REGION=${AWS::Region} \\\nSECRETS_PLUGIN_ENABLED=${EnableSecretsPlugin} \\\nECR_PLUGIN_ENABLED=${EnableECRPlugin} \\\nDOCKER_LOGIN_PLUGIN_ENABLED=${EnableDockerLoginPlugin} \\\nAWS_REGION=${AWS::Region} \\\n  /usr/local/bin/bk-install-elastic-stack.sh\n--==BOUNDARY==--\n',
            {
              LocalSecretsBucket: new cdk.FnIf(
                "CreateSecretsBucket",
                managedSecretsBucket.ref,
                secretsBucket.resolve()
              )
            }
          )
        )
      }
    );

    const subnet1 = new ec2.CfnSubnet(this, "Subnet1", {
      availabilityZone: new cdk.FnIf(
        "UseSpecifiedAvailabilityZones",
        new cdk.FnSelect(1, availabilityZones.resolve()),
        new cdk.FnSelect(1, new cdk.FnGetAZs(""))
      ),
      cidrBlock: "10.0.2.0/24",
      vpcId: vpc.ref,
      tags: [{ key: "Name", value: `${new cdk.AwsStackName()}` }]
    });
    subnet1.options.condition = createVpcResources;

    const subnet0 = new ec2.CfnSubnet(this, "Subnet0", {
      availabilityZone: new cdk.FnIf(
        "UseSpecifiedAvailabilityZones",
        new cdk.FnSelect(0, availabilityZones.resolve()),
        new cdk.FnSelect(0, new cdk.FnGetAZs(""))
      ),
      cidrBlock: "10.0.1.0/24",
      vpcId: vpc.ref,
      tags: [{ key: "Name", value: `${new cdk.AwsStackName()}` }]
    });
    subnet0.options.condition = createVpcResources;

    const agentAutoScaleGroup = new autoscaling.CfnAutoScalingGroup(
      this,
      "AgentAutoScaleGroup",
      {
        vpcZoneIdentifier: new cdk.FnIf(
          "CreateVpcResources",
          [subnet0.ref, subnet1.ref],
          subnets.resolve()
        ),
        launchConfigurationName: agentLaunchConfiguration.ref,
        minSize: minSize.resolve(),
        maxSize: maxSize.resolve(),
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
            value: buildkiteAgentRelease.resolve(),
            propagateAtLaunch: true
          },
          {
            key: "BuildkiteQueue",
            value: buildkiteQueue.resolve(),
            propagateAtLaunch: true
          },
          new cdk.FnIf(
            "UseCostAllocationTags",
            {
              Key: costAllocationTagName.resolve(),
              Value: costAllocationTagValue.resolve(),
              PropagateAtLaunch: true
            },
            `${new cdk.AwsNoValue()}`
          )
        ]
      }
    );
    agentAutoScaleGroup.options.creationPolicy = {
      resourceSignal: {
        timeout: instanceCreationTimeout.resolve(),
        count: minSize.resolve()
      }
    };
    agentAutoScaleGroup.options.updatePolicy = {
      autoScalingReplacingUpdate: { willReplace: true }
    };

    const agentScaleDownPolicy = new autoscaling.CfnScalingPolicy(
      this,
      "AgentScaleDownPolicy",
      {
        adjustmentType: "ChangeInCapacity",
        autoScalingGroupName: agentAutoScaleGroup.ref,
        cooldown: "300",
        scalingAdjustment: scaleDownAdjustment.resolve()
      }
    );
    agentScaleDownPolicy.options.condition = useAutoscaling;

    const agentUtilizationAlarmLow = new cloudwatch.CfnAlarm(
      this,
      "AgentUtilizationAlarmLow",
      {
        alarmDescription: "Scale-down if UnfinishedJobs == 0 for N minutes",
        metricName: "UnfinishedJobsCount",
        namespace: "Buildkite",
        statistic: "Maximum",
        period: scaleDownPeriod.resolve(),
        evaluationPeriods: 1,
        threshold: 0,
        alarmActions: [agentScaleDownPolicy.ref],
        dimensions: [{ name: "Queue", value: buildkiteQueue.resolve() }],
        comparisonOperator: "LessThanOrEqualToThreshold"
      }
    );
    agentUtilizationAlarmLow.options.condition = useAutoscaling;

    const agentScaleUpPolicy = new autoscaling.CfnScalingPolicy(
      this,
      "AgentScaleUpPolicy",
      {
        adjustmentType: "ChangeInCapacity",
        autoScalingGroupName: agentAutoScaleGroup.ref,
        cooldown: "300",
        scalingAdjustment: scaleUpAdjustment.resolve()
      }
    );
    agentScaleUpPolicy.options.condition = useAutoscaling;

    const agentUtilizationAlarmHigh = new cloudwatch.CfnAlarm(
      this,
      "AgentUtilizationAlarmHigh",
      {
        alarmDescription: "Scale-up if ScheduledJobs > 0 for 1 minute",
        metricName: "ScheduledJobsCount",
        namespace: "Buildkite",
        statistic: "Minimum",
        period: 60,
        evaluationPeriods: 1,
        threshold: 0,
        alarmActions: [agentScaleUpPolicy.ref],
        dimensions: [{ name: "Queue", value: buildkiteQueue.resolve() }],
        comparisonOperator: "GreaterThanThreshold"
      }
    );
    agentUtilizationAlarmHigh.options.condition = useAutoscaling;

    const securityGroupSshIngress = new ec2.CfnSecurityGroupIngress(
      this,
      "SecurityGroupSshIngress",
      {
        groupId: new cdk.FnGetAtt("SecurityGroup", "GroupId"),
        ipProtocol: "tcp",
        fromPort: 22,
        toPort: 22,
        cidrIp: "0.0.0.0/0"
      }
    );
    securityGroupSshIngress.options.condition = enableSshIngress;

    const agentLifecycleTopic = new sns.CfnTopic(
      this,
      "AgentLifecycleTopic",
      {}
    );

    const agentLifecycleHook = new autoscaling.CfnLifecycleHook(
      this,
      "AgentLifecycleHook",
      {
        autoScalingGroupName: agentAutoScaleGroup.ref,
        lifecycleTransition: "autoscaling:EC2_INSTANCE_TERMINATING",
        defaultResult: "CONTINUE",
        heartbeatTimeout: 120,
        notificationTargetArn: agentLifecycleTopic.ref,
        roleArn: new cdk.FnGetAtt("AgentLifecycleHookRole", "Arn")
      }
    );

    const agentLifecycleHookRole = new iam.CfnRole(
      this,
      "AgentLifecycleHookRole",
      {
        assumeRolePolicyDocument: {
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: ["autoscaling.amazonaws.com"] },
              Action: "sts:AssumeRole"
            }
          ]
        },
        policies: [
          {
            policyName: "AgentLifecyclePolicy",
            policyDocument: {
              Statement: [
                {
                  Effect: "Allow",
                  Action: ["sns:Publish"],
                  Resource: agentLifecycleTopic.ref
                }
              ]
            }
          }
        ],
        path: "/"
      }
    );

    const artifactsBucketPolicies = new iam.CfnPolicy(
      this,
      "ArtifactsBucketPolicies",
      {
        policyName: "ArtifactsBucketPolicy",
        policyDocument: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:Put*", "s3:List*", "s3:Get*"],
              Resource: [
                new cdk.FnSub("arn:aws:s3:::${ArtifactsBucket}/*"),
                new cdk.FnSub("arn:aws:s3:::${ArtifactsBucket}")
              ]
            }
          ]
        },
        roles: [iamRole.ref]
      }
    );
    artifactsBucketPolicies.options.condition = useArtifactsBucket;

    const unmanagedSecretsBucketPolicy = new iam.CfnPolicy(
      this,
      "UnmanagedSecretsBucketPolicy",
      {
        policyName: "SecretsBucketPolicy",
        policyDocument: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:Get*", "s3:Get", "s3:List*"],
              Resource: [
                new cdk.FnSub("arn:aws:s3:::${SecretsBucket}/*"),
                new cdk.FnSub("arn:aws:s3:::${SecretsBucket}")
              ]
            }
          ]
        },
        roles: [iamRole.ref]
      }
    );
    unmanagedSecretsBucketPolicy.options.condition = useSpecifiedSecretsBucket;

    const managedSecretsBucketPolicy = new iam.CfnPolicy(
      this,
      "ManagedSecretsBucketPolicy",
      {
        policyName: "SecretsBucketPolicy",
        policyDocument: {
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:Get*", "s3:Get", "s3:List*"],
              Resource: [
                new cdk.FnSub("arn:aws:s3:::${ManagedSecretsBucket}/*"),
                new cdk.FnSub("arn:aws:s3:::${ManagedSecretsBucket}")
              ]
            }
          ]
        },
        roles: [iamRole.ref]
      }
    );
    managedSecretsBucketPolicy.options.condition = createSecretsBucket;

    const iamPolicies = new iam.CfnPolicy(this, "IAMPolicies", {
      policyName: "InstancePolicy",
      policyDocument: {
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "cloudwatch:PutMetricData",
              "cloudformation:DescribeStackResource",
              "ec2:DescribeTags",
              "autoscaling:DescribeAutoScalingInstances",
              "autoscaling:DescribeLifecycleHooks",
              "autoscaling:RecordLifecycleActionHeartbeat",
              "autoscaling:CompleteLifecycleAction",
              "autoscaling:SetInstanceHealth"
            ],
            Resource: "*"
          },
          {
            Effect: "Allow",
            Action: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
              "logs:DescribeLogStreams"
            ],
            Resource: "*"
          },
          {
            Effect: "Allow",
            Action: ["sqs:*", "sns:Unsubscribe", "sns:Subscribe"],
            Resource: "*"
          }
        ]
      },
      roles: [iamRole.ref]
    });

    const routes = new ec2.CfnRouteTable(this, "Routes", {
      vpcId: vpc.ref,
      tags: [{ key: "Name", value: `${new cdk.AwsStackName()}` }]
    });
    routes.options.condition = createVpcResources;

    const subnet1Routes = new ec2.CfnSubnetRouteTableAssociation(
      this,
      "Subnet1Routes",
      { subnetId: subnet1.ref, routeTableId: routes.ref }
    );
    subnet1Routes.options.condition = createVpcResources;

    const subnet0Routes = new ec2.CfnSubnetRouteTableAssociation(
      this,
      "Subnet0Routes",
      { subnetId: subnet0.ref, routeTableId: routes.ref }
    );
    subnet0Routes.options.condition = createVpcResources;

    const gateway = new ec2.CfnInternetGateway(this, "Gateway", {
      tags: [{ key: "Name", value: `${new cdk.AwsStackName()}` }]
    });
    gateway.options.condition = createVpcResources;

    const gatewayAttachment = new ec2.CfnVPCGatewayAttachment(
      this,
      "GatewayAttachment",
      { internetGatewayId: gateway.ref, vpcId: vpc.ref }
    );
    gatewayAttachment.options.condition = createVpcResources;

    const routeDefault = new ec2.CfnRoute(this, "RouteDefault", {
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: gateway.ref,
      routeTableId: routes.ref
    });
    routeDefault.options.condition = createVpcResources;
    routeDefault.addDependency(gatewayAttachment);
  }
}
