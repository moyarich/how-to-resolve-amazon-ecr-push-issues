import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";

export const suppressCdkNagRules = (stack: cdk.Stack) => {
  NagSuppressions.addStackSuppressions(
    stack,
    [
      {
        id: "AwsSolutions-IAM4",
        reason: "AWS managed policies are permitted for demo code",
        appliesTo: [
          "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
          "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
        ],
      },
      {
        id: "AwsSolutions-IAM5",
        reason: "IAM wildcard allowed",
        appliesTo: [
          "Action::s3:Abort*",
          "Action::s3:DeleteObject*",
          "Action::s3:GetObject*",
          "Action::s3:GetBucket*",
          "Action::s3:Get*",
          "Action::s3:List*",
          "Action::s3:Put*",
          "Action::s3:PutObject*",
          {
            regex: "/^Resource::arn:aws:s3:*\\*$/",
          },
          {
            regex: "/^Resource::<.*Bucket.+Arn>.*/\\*$/",
          },
          {
            regex: "/^Resource::<.*Table.+Arn>/index/\\*$/",
          },
        ],
      },
      {
        id: "AwsSolutions-IAM5",
        reason: "These roles are defined according to documentation",
      },
      {
        id: "AwsSolutions-S1",
        reason: "S3 server access logs not required for prototype",
      },
    ],
    true
  );
  stack.node.findAll().forEach(({ node }: { node: any }) => {
    const re = [
      new RegExp(
        `${stack.stackName}/Custom::CDKBucketDeployment.+/Resource`,
        "g"
      ),
      new RegExp(
        `${stack.stackName}/Custom::CDKBucketDeployment.+/ServiceRole/DefaultPolicy/Resource`,
        "g"
      ),
    ];
    if (re.some((r) => r.test(node.path))) {
      NagSuppressions.addResourceSuppressionsByPath(stack, node.path, [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "DeploymentBucket adds * to custom resources and default policy",
          appliesTo: [
            {
              regex: "/^Resource::*/g",
            },
          ],
        },
      ]);
    }
  });
};
