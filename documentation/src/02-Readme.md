## Running the CDK Application

Follow these steps to bootstrap, deploy, and manage the CDK application.

---

## Notes:

- **Environment Variables**: Ensure `CDK_VPC_ID` is set correctly for all commands requiring a VPC.
- **Stack Naming**: Use consistent stack names to avoid deployment conflicts.
- **Take Note**: Record any outputs from the deployment (e.g., VPC ID) for use in subsequent steps.

---

## Step 1: Bootstrap the CDK Environment

Before deploying, bootstrap the CDK environment. Replace `STACK_NAME` with your desired stack name:

```bash
npm run deploy.bootstrap
```

---

## Step 2: Deploy Demo Application

### A. Deploy the VPC

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

### B. Deploy the Main Application

Deploy the main stack defined in `app.ts`. Replace `STACK_NAME` with the appropriate value, ensuring that `CDK_VPC_ID` matches your VPC:

```bash
CDK_VPC_ID=vpc-09d70cb4fca95244e STACK_NAME=main npm run deploy
```

---

### C. (Optional) Deploy the Test Stack

To deploy the test stack defined in `moya-test-stack.ts`, use the following command:

```bash
CDK_VPC_ID=vpc-09d70cb4fca95244e STACK_NAME=MoyaTestStack npm run deploy.moya.test
```

---

## Step 3: Destroy the Main Stack

To clean up and remove the main stack, specify the stack name during destruction:

```bash
CDK_VPC_ID=vpc-09d70cb4fca95244e cdk destroy main-app -c stack_name=main
```

---
