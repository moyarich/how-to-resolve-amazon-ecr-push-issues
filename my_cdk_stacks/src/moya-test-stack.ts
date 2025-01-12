import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { AwsSolutionsChecks } from "cdk-nag";
import { NagSuppressions } from "cdk-nag/lib/nag-suppressions";

import * as dotenv from "dotenv";
// Load environment variables from a .env file
dotenv.config();

export interface MoyaTestStackProps extends cdk.StackProps {
  vpc?: cdk.aws_ec2.IVpc;
}

export class MoyaTestStack extends cdk.Stack {
  props: MoyaTestStackProps;

  constructor(scope: Construct, id: string, props: MoyaTestStackProps) {
    super(scope, id, props);
    this.props = props;

    const vpc = props?.vpc ?? this.retrieveVpc();

    const backendPythonProjectRoot = path.join(
      __dirname,
      "../../backend/python"
    );

    const prepareDataFn = new cdk.aws_lambda.DockerImageFunction(
      this,
      "PrepareMoyaDataLambdV3FnV1",
      {
        code: cdk.aws_lambda.DockerImageCode.fromImageAsset(
          path.join(backendPythonProjectRoot, "etl/prepare_data"),
          {
            platform: cdk.aws_ecr_assets.Platform.LINUX_ARM64,
            file: "Dockerfile",
            cmd: ["index.lambda_handler"],
            buildArgs: {
              // Issue Discussion: https://github.com/aws/aws-cdk/issues/31548
              // Fix for ECR push error - [Failed to push image: failed commit on ref, unexpected status from PUT request, 400 Bad Request]
              provenance: "false",
              sbom: "false",
            },
          }
        ),

        architecture: cdk.aws_lambda.Architecture.ARM_64,
        description: `Prepare/Clean data - [${cdk.Stack.of(this).stackName}]`,
        timeout: cdk.Duration.minutes(15),
        memorySize: 1024,
        vpc: vpc,
        vpcSubnets: vpc.selectSubnets({
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
      }
    );

    this.suppressNags();
  }
  /**
   * Retrieves the VPC (Virtual Private Cloud) based on the provided VPC ID.
   * Throws an error if the VPC ID is not provided via the environment variable CDK_VPC_ID.
   *
   * @returns {cdk.aws_ec2.IVpc} The VPC object retrieved from AWS CDK.
   * @throws {Error} Throws an error if CDK_VPC_ID environment variable is not set.
   */
  retrieveVpc() {
    const stack = cdk.Stack.of(this);
    const env = stack.node.tryGetContext("env");
    const vpcId = process.env.CDK_VPC_ID || env?.vpcId;

    if (!vpcId) {
      throw new Error("CDK_VPC_ID environment variable not set");
    }

    const vpc = cdk.aws_ec2.Vpc.fromLookup(this, "Vpc", {
      vpcId: vpcId,
    });

    return vpc;
  }
  private suppressNags(): void {
    const stack = cdk.Stack.of(this);

    // Suppressions for AWS CDK Nag tool
    NagSuppressions.addStackSuppressions(
      stack,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "AWS managed policies are permitted for demo purposes",
          appliesTo: [
            // Specify the AWS managed policies allowed in this CDK stack.
            // These policies must be specific and non-overly permissive.
            // For example, avoid policies like AmazonS3FullAccess, AmazonSageMakerFullAccess.
            "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
            "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
          ],
        },
      ],
      true
    );
  }
}

//-----------------------------
// CDK deploy
//-----------------------------

const app = new cdk.App();
const stackName = app.node.tryGetContext("stack_name") || "MoyaTestStack";
const account =
  app.node.tryGetContext("account") ||
  process.env.CDK_DEPLOY_ACCOUNT ||
  process.env.CDK_DEFAULT_ACCOUNT;
const region =
  app.node.tryGetContext("region") ||
  process.env.CDK_DEPLOY_REGION ||
  process.env.CDK_DEFAULT_REGION;

const moyaTestStack = new MoyaTestStack(app, stackName, {
  env: {
    account: account,
    region: region,
  },
});

cdk.Aspects.of(app).add(
  new AwsSolutionsChecks({ logIgnores: true, verbose: true })
);
app.synth();
