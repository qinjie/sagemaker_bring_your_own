import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as ecr from "@aws-cdk/aws-ecr";
import * as iam from "@aws-cdk/aws-iam";
import * as kms from "@aws-cdk/aws-kms";
import * as s3 from "@aws-cdk/aws-s3";
import * as cdk from "@aws-cdk/core";
import {
  createCdkBuildAction,
  createCfnDeployAction,
  createDockerBuildAction,
  createSourceAction,
} from "../cdk-common/codepipeline-utils";

// cdk supporting resources
const AWS_CODEPIPELINE_ROLE_ARN = process.env.AWS_CODEPIPELINE_ROLE_ARN!;
const AWS_CLOUDFORMATION_ROLE_ARN = process.env.AWS_CLOUDFORMATION_ROLE_ARN!;
const AWS_ARTIFACT_BUCKET_NAME = process.env.AWS_ARTIFACT_BUCKET_NAME!;
const PROJECT_CODE = process.env.PROJECT_CODE!;

// code repo
const code_repo = {
  code_repo_name: process.env.CODE_REPO_NAME!,
  code_repo_branch: process.env.CODE_REPO_BRANCH!,
  code_repo_owner: process.env.CODE_REPO_OWNER!,
  code_repo_secret_var: process.env.CODE_REPO_SECRET_VAR!,
};

export class PipelineStack extends cdk.Stack {
  private pipeline: codepipeline.Pipeline;
  private ecrRepo: ecr.IRepository;
  private key: kms.Key;

  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.ecrRepo = this.createEcrRepo(this, PROJECT_CODE);
    this.pipeline = this.createPipeline(this, props);
    this.output();
  }

  private createEcrRepo(
    stack: cdk.Stack,
    ecr_repo_name: string
  ): ecr.IRepository {
    let ecrRepo: ecr.IRepository = new ecr.Repository(
      stack,
      `${stack.stackName}-EcrREpo`,
      {
        repositoryName: ecr_repo_name,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    return ecrRepo;
  }

  private createPipeline(
    scope: cdk.Stack,
    props: cdk.StackProps
  ): codepipeline.Pipeline {
    const sourceOutput = new codepipeline.Artifact();
    const cdkBuildOutput = new codepipeline.Artifact();
    const dockerBuildOutput = new codepipeline.Artifact();

    /* Get existing resources for CDK */
    const pipelineRole = iam.Role.fromRoleArn(
      scope,
      "CodePipelineRole",
      AWS_CODEPIPELINE_ROLE_ARN
    );

    const cloudFormationRole = iam.Role.fromRoleArn(
      scope,
      "CloudFormationRole",
      AWS_CLOUDFORMATION_ROLE_ARN
    );

    const artifactBucket = this.getArtifactBucket({
      project_code: PROJECT_CODE,
      artifact_bucket_name: AWS_ARTIFACT_BUCKET_NAME,
    });

    /* Create codepipeline */
    return new codepipeline.Pipeline(scope, `${PROJECT_CODE}-pipeline`, {
      artifactBucket,
      role: pipelineRole,
      pipelineName: PROJECT_CODE,
      stages: [
        {
          stageName: "Source",
          actions: [createSourceAction(sourceOutput, code_repo)],
        },
        {
          stageName: "Build",
          actions: [
            createCdkBuildAction(
              this,
              sourceOutput,
              cdkBuildOutput,
              pipelineRole
            ),
            createDockerBuildAction(
              this,
              sourceOutput,
              dockerBuildOutput,
              pipelineRole,
              {
                repositoryUri: this.ecrRepo.repositoryUri,
                containerName: "",
              }
            ),
          ],
        },
        // {
        //   stageName: "Deploy",
        //   actions: [
        //     createCfnDeployAction(
        //       cdkBuildOutput,
        //       `${props.project_code}-deployment`,
        //       cloudFormationRole,
        //       [],
        //       2
        //     ),
        //   ],
        // },
      ],
    });
  }

  private getArtifactBucket(props: {
    project_code: string;
    artifact_bucket_name: string;
  }): s3.IBucket {
    /* Create a new KMS key */
    this.key = new kms.Key(this, `${props.project_code}-key`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      alias: `${props.project_code}-key`,
    });

    return s3.Bucket.fromBucketAttributes(this, "ArtifactBucket", {
      bucketName: props.artifact_bucket_name,
      encryptionKey: this.key,
    });
  }

  private output() {
    new cdk.CfnOutput(this, "BucketKmsKeyArn", {
      value: this.key.keyArn,
      exportName: `${PROJECT_CODE}-BucketKmsKeyArn`,
    });
    new cdk.CfnOutput(this, "EcrRepositoryName", {
      value: this.ecrRepo.repositoryName,
      exportName: `${PROJECT_CODE}-EcrRepositoryName`,
    });
    new cdk.CfnOutput(this, "PipelineName", {
      value: this.pipeline.pipelineName,
      exportName: `${PROJECT_CODE}-PipelineName`,
    });
  }
}
