import * as codebuild from "@aws-cdk/aws-codebuild";
import * as cdk from "@aws-cdk/core";
import * as codecommit from "@aws-cdk/aws-codecommit";
import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as codepipeline_actions from "@aws-cdk/aws-codepipeline-actions";
import * as iam from "@aws-cdk/aws-iam";
import { createCdkBuildProject } from "../cdk-common/codebuild-utils";
import { Construct } from "@aws-cdk/core";

/*
Functions which creates Action for CodePipeline
*/

export const createCodeCommitSourceAction = (
  scope: Construct,
  output: codepipeline.Artifact,
  code_repo: {
    name: string;
    branch: string;
  },
  role: iam.IRole
): codepipeline_actions.CodeCommitSourceAction => {
  const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
    actionName: "CodeCommit_Source",
    repository: codecommit.Repository.fromRepositoryName(
      scope,
      "CodeRepo",
      code_repo.name
    ),
    branch: code_repo.branch,
    output: output,
    role: role,
  });
  return sourceAction;
};

export const createGithubSourceAction = (
  output: codepipeline.Artifact,
  code_repo_props: {
    name: string;
    branch: string;
    owner?: string;
    secret_var?: string;
  }
): codepipeline_actions.GitHubSourceAction => {
  const githubAction = new codepipeline_actions.GitHubSourceAction({
    actionName: "Github_Source",
    repo: code_repo_props.code_repo_name,
    branch: code_repo_props.code_repo_branch,
    owner: code_repo_props.code_repo_owner!,
    oauthToken: cdk.SecretValue.secretsManager(
      code_repo_props.code_repo_secret_var!
    ),
    output: output,
  });
  return githubAction;
};

export const createBuildSpecFromFile = (filepath: string) => {
  return codebuild.BuildSpec.fromSourceFilename(filepath);
};

export const createDockerBuildAction = (
  scope: cdk.Construct,
  input: codepipeline.Artifact,
  output: codepipeline.Artifact,
  role: iam.IRole,
  props: { repositoryUri: string; containerName: string },
  runOrder: number = 1
): codepipeline_actions.CodeBuildAction => {
  const project = new codebuild.PipelineProject(scope, "CodeBuildProject", {
    environment: {
      buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
      privileged: true,
    },
    buildSpec: createBuildSpecFromFile("./buildspec.yml"),
    environmentVariables: {
      REPOSITORY_URI: { value: props.repositoryUri },
      CONTAINER_NAME: { value: props.containerName },
    },
  });
  // this.ecrRepo.grantPullPush(project.grantPrincipal);
  project.role?.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName(
      "AmazonEC2ContainerRegistryPowerUser"
    )
  );

  const buildAction = new codepipeline_actions.CodeBuildAction({
    actionName: "DockerBuild_Action",
    project: project,
    input: input,
    outputs: [output],
    role: role,
    runOrder: runOrder,
  });

  return buildAction;
};

export const createCdkBuildAction = (
  scope: cdk.Construct,
  input: codepipeline.Artifact,
  output: codepipeline.Artifact,
  role: iam.IRole,
  runOrder: number = 1
): codepipeline_actions.CodeBuildAction => {
  const project = createCdkBuildProject(scope, "CdkBuildProject");
  // Add additional permissions to role
  project.role?.addToPrincipalPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      actions: ["ec2:DescribeAvailabilityZones"],
    })
  );
  project.role?.addToPrincipalPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [`arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/cdk-*`],
      actions: ["sts:AssumeRole"],
    })
  );
  const buildAction = new codepipeline_actions.CodeBuildAction({
    actionName: "CdkBuild_Action",
    project: project,
    input: input,
    outputs: [output],
    role: role,
    runOrder: runOrder,
  });

  return buildAction;
};

export const createCfnDeployAction = (
  cdkBuildOutput: codepipeline.Artifact,
  stackName: string,
  cloudformationRole: iam.IRole,
  extraInputs: codepipeline.Artifact[] = [],
  runOrder: number = 1
): codepipeline_actions.CloudFormationCreateUpdateStackAction => {
  return new codepipeline_actions.CloudFormationCreateUpdateStackAction({
    actionName: `Deploy-${stackName}`,
    // Must be the same as the other stack name, e.g. `${props.project_code}-fargate`
    stackName: stackName,
    templatePath: cdkBuildOutput.atPath(
      // Must be the same name as LambdaStack, e.g. `${stackName}.template.json`
      `${stackName}.template.json`
    ),
    adminPermissions: true,
    parameterOverrides: {
      // Pass location of lambda code to Lambda Stack
      // ...props.lambda_code.assign(
      //   dockerBuildOutput.getParam(
      //     "imagedefinitions.json",
      //     "imagedefinitions"
      //   )
      // ),
    },
    extraInputs: extraInputs,
    deploymentRole: cloudformationRole,
    runOrder: runOrder,
  });
};
