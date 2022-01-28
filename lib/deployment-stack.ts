import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as ecr from "@aws-cdk/aws-ecr";
import * as iam from "@aws-cdk/aws-iam";
import * as kms from "@aws-cdk/aws-kms";
import * as s3 from "@aws-cdk/aws-s3";
import * as cdk from "@aws-cdk/core";
import {
  createDockerBuildAction,
  createSourceAction,
} from "../cdk-common/codepipeline-utils";

export interface DeploymentStackProps extends cdk.StackProps {
  // basic props for cdk
  project_code: string;
  codepipeline_role_arn?: string;
  cloudformation_role_arn: string;
  artifact_bucket_name: string;
  // code repo
  code_repo_name: string;
  code_repo_branch: string;
  code_repo_secret_var?: string;
  code_repo_owner?: string;
}

export class DeploymentStack extends cdk.Stack {
  readonly project_code: string;
  public readonly pipeline: codepipeline.Pipeline;
  public readonly ecrRepo: ecr.IRepository;

  containerName: string;

  constructor(scope: cdk.Construct, id: string, props: DeploymentStackProps) {
    super(scope, id, props);

    this.project_code = props.project_code;

    /* Get existing ECR Repo */
    this.ecrRepo = ecr.Repository.fromRepositoryName(
      this,
      `${this.stackName}-EcrREpo`,
      cdk.Fn.importValue(`${this.project_code}-EcrRepositoryName`)
    );

    this.pipeline = this.createPipeline(this, props);
    this.output();
  }

  private createPipeline(
    scope: cdk.Stack,
    props: DeploymentStackProps
  ): codepipeline.Pipeline {
    const sourceOutput = new codepipeline.Artifact();
    const dockerBuildOutput = new codepipeline.Artifact();

    /* Create existing CodePipeline role */
    const pipelineRole = iam.Role.fromRoleArn(
      scope,
      "CodePipelineRole",
      props.codepipeline_role_arn!
    );

    /* Use existing S3 bucket */
    const artifactBucket = this.getArtifactBucket({ ...props });

    // const repositoryUri = `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/aws-cdk/${props.project_code}`;
    return new codepipeline.Pipeline(scope, `${props.project_code}-pipeline`, {
      artifactBucket,
      role: pipelineRole,
      pipelineName: `${props.project_code}-deployment`,
      stages: [
        {
          stageName: "Source",
          actions: [createSourceAction(sourceOutput, { ...props })],
        },
        {
          stageName: "Build",
          actions: [
            createDockerBuildAction(
              this,
              sourceOutput,
              dockerBuildOutput,
              pipelineRole,
              {
                repositoryUri: this.ecrRepo.repositoryUri,
                containerName: this.containerName,
              }
            ),
          ],
        },
        // {
        //   stageName: "Deploy",
        //   actions: [
        //     this.createEcsDeployAction(
        //       dockerBuildOutput,
        //       pipelineRole,
        //       props.vpc_id,
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
    const key = kms.Key.fromKeyArn(
      this,
      `${props.project_code}-key-deployment`,
      cdk.Fn.importValue(`${this.project_code}-BucketKmsKeyArn`)
    );

    return s3.Bucket.fromBucketAttributes(this, "ArtifactBucket", {
      bucketName: props.artifact_bucket_name,
      encryptionKey: key,
    });
  }

  // private createBuildSpecFromFile(filepath: string) {
  //   return codebuild.BuildSpec.fromSourceFilename(filepath);
  // }

  private output() {
    new cdk.CfnOutput(this, "DeploymentPipelineName", {
      value: this.pipeline.pipelineName,
    });
  }
}
