<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Resolve Docker And ECR Push Issues](#01-resolve-docker-and-ecr-push-issues)
    - [Common ECR Push Errors](#common-ecr-push-errors)
    - [Fixing ECR Push Errors](#fixing-ecr-push-errors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Resolve Docker And ECR Push Issues


<a name="01-resolve-docker-and-ecr-push-issues01-readmemd"></a>

Step by step guide to resolving Amazon Elastic Container Registry (ECR) issues with Docker Images for CLI and DockerImageFunction

![Issue Example](../..doc-images/invalid_image.png)

### Common ECR Push Errors

Here are some typical errors you might encounter when pushing images to ECR:

Issue Discussion is here: https://github.com/aws/aws-cdk/issues/31548

These are the steps I took to fix the issue below

- **400 Bad Request Errors - Manifest Issues**:

  ```text
  fail: docker push xyz.dkr.ecr.*.amazonaws.com/cdk-hnb659fds-container-assets-… exited with error code 1: failed commit on ref "manifest-sha256:" … : unexpected status from PUT request to https://xyz.dkr.ecr.*.amazonaws.com/v2/cdk-hnb659fds-container-assets.../manifests/: 400 Bad Request. Failed to publish asset
  ```

- **Lambda Stabilization Failures - InvalidImage**:

  ```text
  Resource handler returned message: "Lambda function ... reached terminal FAILED state due to InvalidImage(ImageLayerFailure: UnsupportedImageLayerDetected - Layer Digest sha256:...) and failed to stabilize" (RequestToken: ..., HandlerErrorCode: NotStabilized)
  ```

---

### Fixing ECR Push Errors

#### 1. Enable Docker BuildKit

##### Set the DOCKER_BUILDKIT environment variable to enable BuildKit

```bash
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain
```

Add these variables to your shell configuration file (e.g., ~/.bashrc, ~/.zshrc, or ~/.profile) to persist the setting.

##### Alternatively, use `docker buildx` instead of `docker build` for extended BuildKit capabilities

**To setup Docker build as a pass-through to Docker Buildx**:
First make sure that you have Docker Buildx installed `docker buildx version`. It's included by default in new versions of Docker Desktop and in Docker Engine.

```bash
alias 'docker build'='docker buildx build'
```

Note: to delete alias `unalias 'docker build'`

Add this alias to your shell configuration file (e.g., ~/.bashrc, ~/.zshrc, or ~/.profile) to persist the setting.

---

#### 2. Clean Up ECR Repositories

- **Prune Local Docker Images**: Remove unused local Docker images with:
  ```bash
  docker system prune --all
  ```
- **Delete Empty Images**: Locate and remove images with 0-megabyte layers from the ECR registry using the AWS Management Console or AWS CLI.

##### Delete empty images via AWS CLI Script

<!--- @@inject-code: ../../scripts/delete_empty_images_from_ecr.sh#lang=bash --->

---

#### 3. Create a New ECR Repository Tag for Your ECR Container Docker Image

For Lambda `DockerImageFunction`, AWS CDK automatically manages image tagging and pushing to Amazon ECR. The image is tagged with a hash based on its content, ensuring that changes result in a new tag.

#### Options to Force a New Tag in the ECR Registry

Use one of these approaches to force a new tag, `repeat this step` if you continue to encounter issues with stale or problematic images:

1. **Update the Docker Build Context - IE. Modifying the Lambda Handler Source Code**  
   Modifying files in the Docker build context (many any change to the source code) will trigger a new content-based hash and a new image tag.

2. **Update the Dockerfile**  
   Modifying the `Dockerfile` (e.g., adding or changing `COPY` or `ENV` instructions) will generate a new content hash and tag.

3. **Change the Logical ID of the `DockerImageFunction` in Your CDK Stack**  
   Renaming the logical ID in the CDK stack forces the creation of a new resource, triggering a new image tag even without content changes.

##### Example: Changing the Logical ID of a Lambda `DockerImageFunction`

```typescript
// Old function ID
const prepareDataFn = new cdk.aws_lambda.DockerImageFunction(
  this,
  "PrepareDataLambdaV1Fn",
  {
    code: cdk.aws_lambda.DockerImageCode.fromImageAsset(
      path.join(__dirname, "path-to-docker-build-context")
    ),
  }
);

// New function ID
const prepareDataFn = new cdk.aws_lambda.DockerImageFunction(
  this,
  "PrepareDataLambdaV2Fn",
  {
    code: cdk.aws_lambda.DockerImageCode.fromImageAsset(
      path.join(__dirname, "path-to-docker-build-context")
    ),
  }
);
```

##### Example - Command-Line Docker tagging

Provide a new name for the docker tag.
**Note:** for the cli you tag the image `after` you build it

```bash
docker tag my_image_name:<this_is_my_image_name_tag_here> 241533140213.dkr.ecr.us-east-1.amazonaws.com/cdk-hnb659fds-container-assets-241533140213-us-east-1:<this_is_my_image_name_tag_here>
```

---

#### 4. Disable Metadata Attestations

[Docker Metadata Attestations Documentation](https://docs.docker.com/build/metadata/attestations)
Avoid potential registry configuration issues by disabling provenance and Software Bill of Materials (SBOM) generation:

##### Option 1: Use the `BUILDX_NO_DEFAULT_ATTESTATIONS` Environment Variable

```bash
export BUILDX_NO_DEFAULT_ATTESTATIONS=1
```

##### Option 2: Pass build arguments during the Docker build process to avoid metadata issues during image push

- Set `sbom` to false.

- Set the `provenance` build argument to false.

##### Example Command-Line Build

```bash
DOCKER_BUILDKIT=1 docker build -t my_image_name --provenance=false --sbom=false .
```

##### Modify Lambda Function Build Settings in CDK to remove metadata

If using AWS CDK for Lambda deployments, include the `provenance` and `sbom` arguments in the buildArgs for your `DockerImageFunction`.

```typescript
import * as path from "path";
import * as cdk from "aws-cdk-lib";

const prepareDataFn = new cdk.aws_lambda.DockerImageFunction(
  this,
  "PrepareDataLambdaV1Fn",
  {
    code: cdk.aws_lambda.DockerImageCode.fromImageAsset(
      path.join("../../", "etl/prepare_data"),
      {
        platform: cdk.aws_ecr_assets.Platform.LINUX_ARM64,
        file: "Dockerfile",
        buildArgs: {
          provenance: "false",
          sbom: "false",
        },
      }
    ),
    architecture: cdk.aws_lambda.Architecture.ARM_64,
    description: `Prepare/Clean data - [${cdk.Stack.of(this).stackName}]`,
    timeout: cdk.Duration.minutes(15),
    memorySize: 1024,
  }
);
```

---

### Automating the Deployment

Automate your deployment process using a package.json configuration to:

- Automatically log into ECR
- Automatically set DOCKER_BUILDKIT=1

#### `package.json configuration`

**Note: Example `package.json` [Works on mac/linux, uses `sh`]:**

<!--- @@inject-code: ../../package.json#lang=json --->

**CDK Deployment Command:**

```bash
BUILDKIT_PROGRESS=plain CDK_VPC_ID=vpc-09f66ffff5d2773de STACK_NAME=MoyaTestStack npm run deploy
```

---

### Example Shell Script for Building and Pushing Docker Images to ECR

<!--- @@inject-code: ../../scripts/build_and_push_docker_images_to_ecr.sh#lang=bash --->

---

### Example Code

#### NPM build Command

```bash
CDK_VPC_ID=vpc-09f66ffff5d2793de STACK_NAME=MoyaTestStack npm run deploy.moya.test
```

#### DockerFile

**directory:** etl/prepare_data/DockerFile

<!--- @@inject-code: ../../backend/python/etl/prepare_data/Dockerfile#lang=bash --->

#### moya-test-stack.ts

<!--- @@inject-code: ../../my_cdk_stacks/src/moya-test-stack.ts#lang=typescript --->

# Deploying The Demo App


<a name="02-deploying-the-demo-app01-readmemd"></a>

### Running the CDK Application

Follow these steps to bootstrap, deploy, and manage the CDK application.

---

### Notes:

- **Environment Variables**: Ensure `CDK_VPC_ID` is set correctly for all commands requiring a VPC.
- **Stack Naming**: Use consistent stack names to avoid deployment conflicts.
- **Take Note**: Record any outputs from the deployment (e.g., VPC ID) for use in subsequent steps.

---

### Step 1: Bootstrap the CDK Environment

Before deploying, bootstrap the CDK environment. Replace `STACK_NAME` with your desired stack name:

```bash
npm run deploy.bootstrap
```

---

### Step 2: Deploy Demo Application

#### A. Deploy the VPC

The Lambda function in this stack requires a VPC. You can either:

1. **Create a VPC using the `vpc-stack.ts` file**:  
   Run the following command:

   ```bash
   npm run deploy.vpc
   ```

   - **Note**: After deployment, record the VPC ID from the CloudFormation output.

2. **Use an existing VPC**:  
   If you already have a VPC, specify the VPC ID as an environment variable:
   ```bash
   CDK_VPC_ID=vpc-09d70cb4fca95244e npm run deploy.vpc
   ```

---

#### B. Deploy the Main Application

Deploy the main stack defined in `app.ts`. Replace `STACK_NAME` with the appropriate value, ensuring that `CDK_VPC_ID` matches your VPC:

```bash
CDK_VPC_ID=vpc-09d70cb4fca95244e STACK_NAME=main npm run deploy
```

---

#### C. (Optional) Deploy the Test Stack

To deploy the test stack defined in `moya-test-stack.ts`, use the following command:

```bash
CDK_VPC_ID=vpc-09d70cb4fca95244e STACK_NAME=MoyaTestStack npm run deploy.moya.test
```

---

### Step 3: Destroy the Main Stack

To clean up and remove the main stack, specify the stack name during destruction:

```bash
CDK_VPC_ID=vpc-09d70cb4fca95244e cdk destroy main-app -c stack_name=main
```

---
