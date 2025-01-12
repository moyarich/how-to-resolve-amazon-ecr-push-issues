import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import { AwsSolutionsChecks } from "cdk-nag";
import { VpcConstruct, VpcConstructProps } from "./construct/vpc-construct";

import * as dotenv from "dotenv";
import { suppressCdkNagRules } from "./utils/suppressCdkNagRules";

// Load environment variables from a .env file
dotenv.config();

export interface VpcStackProps extends VpcConstructProps {
  readonly stackName?: string;
}

export class VpcStack extends cdk.Stack {
  public readonly vpc: cdk.aws_ec2.IVpc;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    /// AWS S3 Logging Bucket
    const loggingBucket = new cdk.aws_s3.Bucket(
      this,
      "AWSSigurdAccessLogsBucket",
      {
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        versioned: true,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        accessControl: cdk.aws_s3.BucketAccessControl.LOG_DELIVERY_WRITE,
        objectOwnership: cdk.aws_s3.ObjectOwnership.OBJECT_WRITER,
        intelligentTieringConfigurations: [
          {
            name: "archive",
            archiveAccessTierTime: cdk.Duration.days(90),
            deepArchiveAccessTierTime: cdk.Duration.days(180),
          },
        ],
      }
    );

    // Create a VPC with flow logs enabled.
    const vpcConstruct = new VpcConstruct(this, "VPC", {
      loggingBucket: loggingBucket,
      hasS3GatewayEndpoint: true,
      hasDynamoDbGatewayEndpoint: false,
      hasApiGwEndpoint: false,
    });

    this.vpc = vpcConstruct.vpc;
  }
}

//-----------------------------
// CDK deploy
//-----------------------------

const app = new cdk.App();
const stackName = app.node.tryGetContext("stack_name") || "VPCStack";
const account =
  app.node.tryGetContext("account") ||
  process.env.CDK_DEPLOY_ACCOUNT ||
  process.env.CDK_DEFAULT_ACCOUNT;
const region =
  app.node.tryGetContext("region") ||
  process.env.CDK_DEPLOY_REGION ||
  process.env.CDK_DEFAULT_REGION;

const vpcStack = new VpcStack(app, stackName, {
  env: {
    account: account,
    region: region,
  },
});

cdk.Aspects.of(app).add(
  new AwsSolutionsChecks({ logIgnores: true, verbose: true })
);
suppressCdkNagRules(vpcStack);

app.synth();
