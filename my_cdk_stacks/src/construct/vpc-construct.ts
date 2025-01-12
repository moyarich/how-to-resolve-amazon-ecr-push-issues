import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface VpcConstructProps extends cdk.StackProps {
  readonly cidr?: string;
  readonly natGateways?: number;
  readonly maxAzs?: number;
  readonly publicCidrMask?: number;
  readonly privateCidrMask?: number;
  readonly hasS3GatewayEndpoint?: boolean;
  readonly hasDynamoDbGatewayEndpoint?: boolean;
  readonly hasApiGwEndpoint?: boolean;
  readonly loggingBucket?: cdk.aws_s3.Bucket;
}

const defaultProps: Partial<VpcConstructProps> = {
  cidr: "10.0.0.0/20",
  natGateways: 2,
  maxAzs: 2,
  publicCidrMask: 24,
  privateCidrMask: 24,
  hasS3GatewayEndpoint: true,
  hasDynamoDbGatewayEndpoint: true,
  hasApiGwEndpoint: false,
};

export class VpcConstruct extends Construct {
  public readonly props: VpcConstructProps;
  public readonly vpc: cdk.aws_ec2.IVpc;
  public readonly apiGwVpcEndpoint?: cdk.aws_ec2.InterfaceVpcEndpoint;
  public readonly vpcSsmParameterPrefix?: string;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);
    const stack = cdk.Stack.of(this);

    this.props = { ...defaultProps, ...props };

    const vpc = new cdk.aws_ec2.Vpc(this, "Vpc", {
      ipAddresses: cdk.aws_ec2.IpAddresses.cidr(this.props.cidr!),
      natGateways: this.props.natGateways,
      maxAzs: this.props.maxAzs,
      subnetConfiguration: [
        {
          name: "PublicShared",
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          cidrMask: this.props.publicCidrMask,
        },
        {
          name: "PrivateShared",
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: this.props.privateCidrMask,
        },
      ],
    });

    if (this.props.hasS3GatewayEndpoint) {
      vpc.addGatewayEndpoint("S3GatewayEndpoint", {
        service: cdk.aws_ec2.GatewayVpcEndpointAwsService.S3,
      });
    }

    if (this.props.hasDynamoDbGatewayEndpoint) {
      vpc.addGatewayEndpoint("DynamoDbGatewayEndpoint", {
        service: cdk.aws_ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      });
    }

    if (this.props.hasApiGwEndpoint) {
      this.apiGwVpcEndpoint = vpc.addInterfaceEndpoint("ApiGwGatewayEndpoint", {
        service: cdk.aws_ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      });
    }

    if (this.props.loggingBucket) {
      const flowLogRole = new cdk.aws_iam.Role(this, "FlowLogRole", {
        assumedBy: new cdk.aws_iam.ServicePrincipal(
          "vpc-flow-logs.amazonaws.com"
        ),
      });
      this.props.loggingBucket.grantWrite(flowLogRole, "VpcFlowLogs/*");

      const vpcFlowLogRole = new cdk.aws_ec2.FlowLog(this, "VpcFlowLogs", {
        resourceType: cdk.aws_ec2.FlowLogResourceType.fromVpc(vpc),
        destination: cdk.aws_ec2.FlowLogDestination.toS3(
          this.props.loggingBucket,
          "VpcFlowLogs/"
        ),
        trafficType: cdk.aws_ec2.FlowLogTrafficType.ALL,
      });

      NagSuppressions.addResourceSuppressionsByPath(
        stack,
        vpcFlowLogRole.node.path,
        [
          {
            id: "AwsSolutions-IAM5",
            reason: "These roles are defined according to documentation",
          },
        ],
        true
      );
    }

    this.vpcSsmParameterPrefix = `/${stack.stackName}/${id}`;
    const ssmParameter = new cdk.aws_ssm.StringParameter(
      this,
      "VpcIdParameter",
      {
        parameterName: `${this.vpcSsmParameterPrefix}/vpc-id`,
        stringValue: vpc.vpcId,
      }
    );
    //Outputs
    new cdk.CfnOutput(this, `Id`, {
      value: vpc.vpcId,
    });

    new cdk.CfnOutput(this, `SSMParameterName`, {
      value: ssmParameter.parameterName,
    });

    // Output for Public Subnet IDs
    new cdk.CfnOutput(this, "PublicSubnetIds", {
      value: vpc.publicSubnets
        .map((subnet: cdk.aws_ec2.ISubnet) => subnet.subnetId)
        .join(","),
      description: "List of Public Subnet IDs",
    });

    // Output for Private Subnet IDs
    new cdk.CfnOutput(this, "PrivateSubnetIds", {
      value: vpc.privateSubnets
        .map((subnet: cdk.aws_ec2.ISubnet) => subnet.subnetId)
        .join(","),
      description: "List of Private Subnet IDs",
    });

    new cdk.CfnOutput(this, "AvailabilityZones", {
      value: vpc.availabilityZones.join(","),
    });

    this.vpc = vpc;
  }
}
