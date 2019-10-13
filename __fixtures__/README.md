The integration test fixtures in here are from the following sources and may have been modified:

`buildkite.json` is https://github.com/buildkite/elastic-ci-stack-for-aws, converted to JSON, and modified to remove constructs not compatible with CDK: conditions in tags and outputs with the same name as resources.

`WordPress_Multi_AZ.json` is from https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/sample-templates-applications-us-west-2.html and modified to change incorrect types in the JSON that CDK raises validation warnings for, mostly port numbers in security groups. It has also been modified to condense the user data in the launch configuration to match CDK's Fn::Join auto-concatenation.
