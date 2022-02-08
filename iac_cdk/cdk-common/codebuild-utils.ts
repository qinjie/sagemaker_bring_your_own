import * as codebuild from "@aws-cdk/aws-codebuild";
import * as cdk from "@aws-cdk/core";
import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as codepipeline_actions from "@aws-cdk/aws-codepipeline-actions";
import { IBaseService, IService } from "@aws-cdk/aws-ecs";

/*
Functions which creates BuildProject for Actions in CodePipeline
*/

export const createCdkBuildProject = (
  scope: cdk.Construct,
  id: string,
  cdkFolder: string = "."
) =>
  new codebuild.PipelineProject(scope, `${id}`, {
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
      privileged: true,
    },
    buildSpec: codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          commands: [`cd ${cdkFolder}`, "npm install"],
        },
        build: {
          commands: ["npm run build", "npm run cdk synth -- -v -o dist"],
        },
      },
      artifacts: {
        "base-directory": `${cdkFolder}/dist`,
        files: ["*.template.json"],
      },
    }),
  });

export const createJavaScriptLambdaBuildProject = (
  scope: cdk.Construct,
  lambdaFolder: string,
  id: string = "JavaScriptLambdaBuildProject"
) =>
  new codebuild.PipelineProject(scope, `${id}`, {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          commands: [`cd ${lambdaFolder}`, "npm install"],
        },
        build: {
          commands: "npm run build",
        },
      },
      artifacts: {
        "base-directory": `${lambdaFolder}`,
        files: ["index.js", "node_modules/**/*"],
      },
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
    },
  });

export const createPythonLambdaBuildProject = (
  scope: cdk.Construct,
  lambdaFolder: string,
  id: string = "PythonLambdaBuildProject"
) =>
  new codebuild.PipelineProject(scope, `${id}`, {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          commands: [
            `pip install -r ${lambdaFolder}/requirements.txt -t ${lambdaFolder}`,
          ],
        },
        build: {},
      },
      artifacts: {
        "base-directory": `${lambdaFolder}`,
        files: ["**/*"],
      },
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
    },
  });

export const createDeployStage = (
  stageName: string,
  input: codepipeline.Artifact,
  service: IBaseService
): codepipeline.StageProps => {
  const ecsDeployAction = new codepipeline_actions.EcsDeployAction({
    actionName: "ECSDeploy_Action",
    input,
    service,
  });
  return {
    stageName: stageName,
    actions: [ecsDeployAction],
  };
};

export const createBuildSpec = (imageUri: string, imageTag: string) => {
  return codebuild.BuildSpec.fromObject({
    version: "0.2",
    phases: {
      install: {
        commands: [],
      },
      pre_build: {
        commands: [
          "aws –-version",
          "$(aws ecr get-login –region ${AWS_DEFAULT_REGION} –no-include-email | sed 's|https://||')",
          "COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)",
          "IMAGE_TAG=${COMMIT_HASH:=latest}",
        ],
      },
      build: {
        commands: [
          "echo Building the Docker image...",
          `docker build -t ${imageUri}:latest .`,
          `docker tag ${imageUri}:latest ${imageUri}:${imageTag}`,
        ],
      },
      post_build: {
        commands: [
          "echo Completed building docker image",
          "echo Pushing the Docker image...",
          `docker push ${imageUri}:latest`,
          `docker push ${imageUri}:${imageTag}`,
          `printf "[{\\"imageUri\\":\\"${imageUri}:latest\\"}]" > imagedefinitions.json`,
        ],
      },
    },
    artifacts: {
      files: ["imageDetail.json"],
    },
  });
};
