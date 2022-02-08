import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as codepipeline_actions from "@aws-cdk/aws-codepipeline-actions";
import * as ecr from "@aws-cdk/aws-ecr";
import * as iam from "@aws-cdk/aws-iam";
import * as kms from "@aws-cdk/aws-kms";
import * as s3 from "@aws-cdk/aws-s3";
import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import {
  createCdkBuildAction,
  createCfnDeployAction,
  createDockerBuildAction,
  createPythonLambdaBuildAction,
  createSourceAction,
} from "../cdk-common/codepipeline-utils";
import { BUILDSPEC_FILE, IAC_CDK_FOLDER, LAMBDA_FOLDER } from "./config";
import * as fs from "fs";
import * as stepfunctions from "@aws-cdk/aws-stepfunctions";
import * as codestar_noti from "@aws-cdk/aws-codestarnotifications";
import * as sns from "@aws-cdk/aws-sns";

export interface PipelineStackProps extends cdk.StackProps {
  // basic props for cdk
  project_code: string;
  codepipeline_role_arn: string;
  cloudformation_role_arn: string;
  stepfunctions_role_arn: string;
  artifact_bucket_name: string;
  // code repo
  code_repo_name: string;
  code_repo_branch: string;
  code_repo_secret_var?: string;
  code_repo_owner?: string;
  sns_arn_for_developer: string;
  // application props
  lambda_code: lambda.CfnParametersCode;
}

export class PipelineStack extends cdk.Stack {
  private project_code: string;
  private pipeline: codepipeline.Pipeline;
  private ecrRepo: ecr.IRepository;
  private stepFunction: stepfunctions.CfnStateMachine;
  private key: kms.Key;

  constructor(scope: cdk.Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    this.project_code = props.project_code;
    this.ecrRepo = this.createEcrRepo(this, props.project_code);
    this.stepFunction = this.createStepFunction({
      stepfunction_name: props.project_code,
      stepfunctions_role_arn: props.stepfunctions_role_arn,
    });
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
    props: PipelineStackProps
  ): codepipeline.Pipeline {
    const sourceOutput = new codepipeline.Artifact();
    const cdkBuildOutput = new codepipeline.Artifact();
    const dockerBuildOutput = new codepipeline.Artifact();
    const lambdaBuildOutput = new codepipeline.Artifact();

    /* Get existing resources for CDK */
    const pipelineRole = iam.Role.fromRoleArn(
      scope,
      "CodePipelineRole",
      props.codepipeline_role_arn!
    );

    const cloudFormationRole = iam.Role.fromRoleArn(
      scope,
      "CloudFormationRole",
      props.cloudformation_role_arn!
    );

    const artifactBucket = this.getArtifactBucket({ ...props });

    /* Create codepipeline */
    const pipeline = new codepipeline.Pipeline(
      scope,
      `${props.project_code}-pipeline`,
      {
        artifactBucket,
        role: pipelineRole,
        pipelineName: props.project_code,
        stages: [
          {
            stageName: "Source",
            actions: [createSourceAction(sourceOutput, { ...props })],
          },
          {
            stageName: "Build",
            actions: [
              createCdkBuildAction(
                this,
                sourceOutput,
                cdkBuildOutput,
                pipelineRole,
                1,
                IAC_CDK_FOLDER
              ),
              createDockerBuildAction(
                this,
                sourceOutput,
                dockerBuildOutput,
                pipelineRole,
                {
                  repositoryUri: this.ecrRepo.repositoryUri,
                  containerName: "",
                },
                2,
                BUILDSPEC_FILE
              ),
              createPythonLambdaBuildAction(
                this,
                sourceOutput,
                lambdaBuildOutput,
                pipelineRole,
                3,
                LAMBDA_FOLDER
              ),
            ],
          },
          {
            stageName: "Deploy",
            actions: [
              new codepipeline_actions.CloudFormationCreateUpdateStackAction({
                actionName: "Deploy-lambda-function",
                templatePath: cdkBuildOutput.atPath(
                  // Must be the same name as LambdaStack
                  `${props.project_code}-lambda.template.json`
                ),
                stackName: `${props.project_code}-lambda`,
                adminPermissions: true,
                parameterOverrides: {
                  // Pass location of lambda code to Lambda Stack
                  ...props.lambda_code.assign(lambdaBuildOutput.s3Location),
                },
                extraInputs: [lambdaBuildOutput],
                deploymentRole: cloudFormationRole,
                runOrder: 1,
              }),
              // createCfnDeployAction(
              //   cdkBuildOutput,
              //   `${props.project_code}`,
              //   cloudFormationRole,
              //   [],
              //   2
              // ),
            ],
          },
        ],
      }
    );

    // Add notification to pipeline
    const topicArn = props.sns_arn_for_developer;
    const targetTopic = sns.Topic.fromTopicArn(
      this,
      "sns-notification-topic",
      topicArn
    );
    new codestar_noti.NotificationRule(this, "Notification", {
      detailType: codestar_noti.DetailType.BASIC,
      events: [
        "codepipeline-pipeline-pipeline-execution-started",
        "codepipeline-pipeline-pipeline-execution-failed",
        "codepipeline-pipeline-pipeline-execution-succeeded",
        "codepipeline-pipeline-pipeline-execution-canceled",
      ],
      source: pipeline,
      targets: [targetTopic],
    });

    return pipeline;
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

  private createStepFunction(props: {
    stepfunction_name: string;
    stepfunctions_role_arn: string;
  }): stepfunctions.CfnStateMachine {
    const file = fs.readFileSync("../step_functions/definition.asl.json");

    const stepFunction = new stepfunctions.CfnStateMachine(
      this,
      "cfnStepFunction",
      {
        roleArn: props.stepfunctions_role_arn,
        definitionString: file.toString(),
        stateMachineName: props.stepfunction_name,
      }
    );

    return stepFunction;
  }

  private output() {
    new cdk.CfnOutput(this, "BucketKmsKeyArn", {
      value: this.key.keyArn,
      exportName: `${this.project_code}-BucketKmsKeyArn`,
    });
    new cdk.CfnOutput(this, "EcrRepositoryName", {
      value: this.ecrRepo.repositoryName,
      exportName: `${this.project_code}-EcrRepositoryName`,
    });
    new cdk.CfnOutput(this, "PipelineName", {
      value: this.pipeline.pipelineName,
      exportName: `${this.project_code}-PipelineName`,
    });
  }
}
