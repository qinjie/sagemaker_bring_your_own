#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { PermissionsBoundary } from "../cdk-common/permission-boundary";
import { PipelineStack } from "../lib/pipeline-stack";
import { LambdaStack, LambdaStackProps } from "../lib/lambda-stack";

// Load .env file and construct tags
require("dotenv").config();

/* Read envrionment variables */
const tags = {
  "Agency-Code": process.env.AGENCY_CODE! || "",
  "Project-Code": process.env.PROJECT_CODE! || "",
  Environment: process.env.ENVIRONMENT! || "",
  Zone: process.env.ZONE! || "",
  Tier: process.env.TIER! || "",
  "Project-Owner": process.env.PROJECT_OWNER! || "",
};

const props = {
  ecr_repo_uri: `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${
    cdk.Aws.REGION
  }.amazonaws.com/aws-cdk/${process.env.PROJECT_CODE!}`,
  // basic props
  project_code: process.env.PROJECT_CODE!,
  // code repo
  code_repo_name: process.env.CODE_REPO_NAME!,
  code_repo_branch: process.env.CODE_REPO_BRANCH!,
  code_repo_owner: process.env.CODE_REPO_OWNER!,
  code_repo_secret_var: process.env.CODE_REPO_SECRET_VAR!,
  // cdk supporting resources
  codepipeline_role_arn: process.env.AWS_CODEPIPELINE_ROLE_ARN!,
  cloudformation_role_arn: process.env.AWS_CLOUDFORMATION_ROLE_ARN!,
  stepfunctions_role_arn: process.env.AWS_STEPFUNCTIONS_ROLE_ARN!,
  artifact_bucket_name: process.env.AWS_ARTIFACT_BUCKET_NAME!,
  // others
  sagemaker_endpoint: process.env.SAGEMAKER_ENDPOINT!,
  sns_arn_for_developer: process.env.SNS_ARN_FOR_DEVELOPER!,
};

const AWS_POLICY_PERM_BOUNDARY = process.env.AWS_POLICY_PERM_BOUNDARY!;

const env = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

const app = new cdk.App();

/* Lambda Stack */
const lambda_name = `${props.project_code}-lambda`;

const lambdaProps: LambdaStackProps = {
  project_code: props.project_code,
  sagemaker_endpoint: props.sagemaker_endpoint,
};

const lambdaStack = new LambdaStack(app, lambda_name, {
  ...lambdaProps,
  tags,
});

/* Pipeline Stack */
const pipelineStack = new PipelineStack(app, `${props.project_code}`, {
  ...props,
  lambda_code: lambdaStack.lambdaCode,
  env: env,
  tags: tags,
});

/* Set permission boundary */
if (AWS_POLICY_PERM_BOUNDARY) {
  cdk.Aspects.of(lambdaStack).add(
    new PermissionsBoundary(AWS_POLICY_PERM_BOUNDARY)
  );
  cdk.Aspects.of(pipelineStack).add(
    new PermissionsBoundary(AWS_POLICY_PERM_BOUNDARY)
  );
}

app.synth;
