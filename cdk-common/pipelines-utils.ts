import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as codepipeline_actions from "@aws-cdk/aws-codepipeline-actions";
import * as cdk from "@aws-cdk/core";
import * as pipelines from "@aws-cdk/pipelines";
import * as codebuild from "@aws-cdk/aws-codebuild";
import * as s3 from "@aws-cdk/aws-s3";
import * as codecommit from "@aws-cdk/aws-codecommit";
import * as iam from "@aws-cdk/aws-iam";

export class PipelinesUtils {
  public static getExistingPipelineRole(
    scope: cdk.Construct,
    codepipeline_role_arn: string
  ) {
    const pipelineRole = iam.Role.fromRoleArn(
      scope,
      "CodePipelineRole",
      codepipeline_role_arn
    );
    return pipelineRole;
  }

  public static getCodeCommitSourceAction(
    scope: cdk.Construct,
    sourceArtifact: codepipeline.Artifact,
    code_repo_name: string,
    code_repo_branch: string,
    role: iam.IRole
  ): codepipeline_actions.Action {
    const repo = codecommit.Repository.fromRepositoryName(
      scope,
      "Repo",
      code_repo_name
    );

    const sourceActionProps = {
      actionName: "CodeCommit",
      output: sourceArtifact,
      repository: repo,
      branch: code_repo_branch,
      role: role,
    };

    return new codepipeline_actions.CodeCommitSourceAction(sourceActionProps);
  }

  public static getGitHubSourceAction(
    sourceArtifact: codepipeline.Artifact,
    code_repo_name: string,
    code_repo_branch: string,
    secrets_manager_var: string,
    code_repo_owner: string
  ): codepipeline_actions.Action {
    // Get GitHub developer auth token name in Secret Manager from environment variable
    const sourceActionProps = {
      actionName: "GitHub",
      output: sourceArtifact,
      oauthToken: cdk.SecretValue.secretsManager(secrets_manager_var),
      owner: code_repo_owner,
      repo: code_repo_name,
      branch: code_repo_branch,
    };

    return new codepipeline_actions.GitHubSourceAction(sourceActionProps);
  }

  public static getNpmSynthAction(
    sourceArtifact: codepipeline.Artifact,
    cloudAssemblyArtifact: codepipeline.Artifact
  ): pipelines.SimpleSynthAction {
    return pipelines.SimpleSynthAction.standardNpmSynth({
      sourceArtifact,
      cloudAssemblyArtifact,
      installCommand: "npm install --include=dev",
      buildCommand: "npm run build",
      environment: {
        privileged: true,
      },
    });
  }

  public static getCodeBuildAction(
    scope: cdk.Construct,
    sourceArtifact: codepipeline.Artifact,
    buildArtifact: codepipeline.Artifact,
    constructId: string,
    runOrder: number,
    role: iam.Role,
    buildspec_file: string = ""
  ): codepipeline_actions.CodeBuildAction {
    // Get buildspec.yml file from environment variable
    let buildSpec: codebuild.BuildSpec;

    if (buildspec_file) {
      /* Use buildspec.yml file in src folder */
      buildSpec = codebuild.BuildSpec.fromSourceFilename(buildspec_file);
    } else {
      /* Use code to define buildspec instead of yml file */
      buildSpec = codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: ["cd src", "npm install"],
          },
          build: {
            commands: ["npm run build"],
          },
        },
        artifacts: {
          "base-directory": "src/build",
          files: "**/*",
        },
      });
    }

    const pipelineProject = new codebuild.PipelineProject(scope, constructId, {
      projectName: constructId,
      buildSpec: buildSpec,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
      },
    });
    return new codepipeline_actions.CodeBuildAction({
      actionName: "Build",
      runOrder: runOrder,
      input: sourceArtifact,
      outputs: [buildArtifact],
      project: pipelineProject,
      role: role,
    });
  }

  public static getDeployAction(
    scope: cdk.Construct,
    input: codepipeline.Artifact,
    bucketName: string,
    constructId: string,
    runOrder: number
  ): codepipeline_actions.S3DeployAction {
    const bucket = s3.Bucket.fromBucketName(scope, constructId, bucketName);

    return new codepipeline_actions.S3DeployAction({
      actionName: "Deploy",
      runOrder: runOrder,
      input: input,
      bucket: bucket,
    });
  }
}
