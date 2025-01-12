/**
 * Copyright (c) 2025 Amazon.com, Inc. and its affiliates.
 * All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *   http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import * as cdk from "aws-cdk-lib";

import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { getGitContext } from "./utils/gitContext";

import * as dotenv from "dotenv";
import { MoyaTestStack } from "./moya-test-stack";
import { VpcStack } from "./vpc-stack";
import { suppressCdkNagRules } from "./utils/suppressCdkNagRules";

// Load environment variables from a .env file
dotenv.config();

const gitContext = getGitContext();

console.log("Current Git Branch:", gitContext.currentGitBranch);
console.log("App Stack Name:", gitContext.appStackName);

const app = new cdk.App();

// Retrieve context or environment variables
const env = app.node.tryGetContext("env");

const stackName =
  app.node.tryGetContext("stack_name") || gitContext.appStackName;
const account =
  app.node.tryGetContext("account") ||
  process.env.CDK_DEPLOY_ACCOUNT ||
  process.env.CDK_DEFAULT_ACCOUNT;
const region =
  app.node.tryGetContext("region") ||
  process.env.CDK_DEPLOY_REGION ||
  process.env.CDK_DEFAULT_REGION;

//-----------------------------
// VPCStack
//-----------------------------

const vpcStackId = app.node.tryGetContext("stack_name") || "VPCStack";
let vpc: cdk.aws_ec2.IVpc | undefined;

const vpcId = process.env.CDK_VPC_ID || env?.vpcId;
let vpcStack: VpcStack | undefined;
if (vpcId) {
  console.log(` VPC with ID: ${vpcId} provided`);
} else {
  console.error("No VPC ID provided");
  vpcStack = new VpcStack(app, vpcStackId, {
    env: {
      account: account,
      region: region,
    },
    stackName: vpcStackId,
  });
  vpc = vpcStack.vpc;
  suppressCdkNagRules(vpcStack);
}

const moyaTestStack = new MoyaTestStack(app, stackName, {
  env: {
    account: account,
    region: region,
  },
});

if (vpcStack) {
  moyaTestStack.addDependency(vpcStack);
}

cdk.Aspects.of(app).add(
  new AwsSolutionsChecks({ logIgnores: true, verbose: true })
);

app.synth();
