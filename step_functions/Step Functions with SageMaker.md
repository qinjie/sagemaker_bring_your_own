# Step Functions with SageMaker



## Training Task

This state machine has a single task to train a model using a custom docker image in ECR. 

![image-20220204163818042](https://raw.githubusercontent.com/qinjie/picgo-images/main/image-20220204163818042.png)

```json
{
  "Comment": "An example to train and host SageMaker model",
  "StartAt": "SageMakerModelTraining",
  "States": {
    "SageMakerModelTraining": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sagemaker:createTrainingJob.sync",
      "Parameters": {
        "TrainingJobName.$": "States.Format('sagemaker-bring-your-own-{}', $$.Execution.Name)",
        "AlgorithmSpecification": {
          "TrainingImage": "305326993135.dkr.ecr.ap-southeast-1.amazonaws.com/sagemaker-bring-your-own",
          "TrainingInputMode": "File"
        },
        "HyperParameters": {},
        "OutputDataConfig": {
          "S3OutputPath": "s3://temp-305326993135/sagemaker_bring_your_own/output/models"
        },
        "InputDataConfig": [
          {
            "ChannelName": "training",
            "DataSource": {
              "S3DataSource": {
                "S3DataType": "S3Prefix",
                "S3Uri": "s3://temp-305326993135/sagemaker_bring_your_own/input/data/train/",
                "S3DataDistributionType": "FullyReplicated"
              }
            },
            "ContentType": "text/csv"
          }
        ],
        "ResourceConfig": {
          "InstanceCount": 1,
          "InstanceType": "ml.c4.2xlarge",
          "VolumeSizeInGB": 10
        },
        "RoleArn": "arn:aws:iam::305326993135:role/u-SageMakerExecutionRole",
        "StoppingCondition": {
          "MaxRuntimeInSeconds": 172800
        }
      },
      "End": true
    }
  }
}
```



### Prerequisite

Following prerequisites are needed before trying out above Step Functions definition.

* An SageMaker docker image `sagemaker-bring-your-own` uploaded to ECR.

* A training CSV file uploaded in `s3://<BUCKET_NAME>/sagemaker_bring_your_own/input/data/train/`

* An IAM role `u-SageMakerExecutionRole` with following policy for the SageMaker to run the training job. This role will be used in the Step Functions task definition.

  ```json
  {
      "Version": "2012-10-17",
      "Statement": [
          {
              "Action": [
                  "cloudwatch:PutMetricData",
                  "logs:CreateLogStream",
                  "logs:PutLogEvents",
                  "logs:CreateLogGroup",
                  "logs:DescribeLogStreams",
                  "s3:GetObject",
                  "s3:PutObject",
                  "s3:ListBucket",
                  "ecr:GetAuthorizationToken",
                  "ecr:BatchCheckLayerAvailability",
                  "ecr:GetDownloadUrlForLayer",
                  "ecr:BatchGetImage"
              ],
              "Resource": "*",
              "Effect": "Allow"
          }
      ]
  }
  ```

* An IAM role `u-StepFunctionsExecutionWithSageMakerTask` with following policy to execute this step function.

  ```json
  {
      "Version": "2012-10-17",
      "Statement": [
          {
              "Effect": "Allow",
              "Action": [
                  "sagemaker:CreateTransformJob",
                  "sagemaker:DescribeTransformJob",
                  "sagemaker:StopTransformJob",
                  "sagemaker:CreateTrainingJob",
                  "sagemaker:DescribeTrainingJob",
                  "sagemaker:StopTrainingJob",
                  "sagemaker:CreateHyperParameterTuningJob",
                  "sagemaker:DescribeHyperParameterTuningJob",
                  "sagemaker:StopHyperParameterTuningJob",
                  "sagemaker:CreateModel",
                  "sagemaker:CreateEndpointConfig",
                  "sagemaker:CreateEndpoint",
                  "sagemaker:DeleteEndpointConfig",
                  "sagemaker:DeleteEndpoint",
                  "sagemaker:UpdateEndpoint",
                  "sagemaker:ListTags",
                  "lambda:InvokeFunction",
                  "sqs:SendMessage",
                  "sns:Publish",
                  "ecs:RunTask",
                  "ecs:StopTask",
                  "ecs:DescribeTasks",
                  "dynamodb:GetItem",
                  "dynamodb:PutItem",
                  "dynamodb:UpdateItem",
                  "dynamodb:DeleteItem",
                  "batch:SubmitJob",
                  "batch:DescribeJobs",
                  "batch:TerminateJob",
                  "glue:StartJobRun",
                  "glue:GetJobRun",
                  "glue:GetJobRuns",
                  "glue:BatchStopJobRun"
              ],
              "Resource": "*"
          },
          {
              "Effect": "Allow",
              "Action": [
                  "iam:PassRole"
              ],
              "Resource": "*",
              "Condition": {
                  "StringEquals": {
                      "iam:PassedToService": "sagemaker.amazonaws.com"
                  }
              }
          },
          {
              "Effect": "Allow",
              "Action": [
                  "events:PutTargets",
                  "events:PutRule",
                  "events:DescribeRule"
              ],
              "Resource": [
                  "arn:aws:events:*:*:rule/StepFunctionsGetEventsForSageMakerTrainingJobsRule",
                  "arn:aws:events:*:*:rule/StepFunctionsGetEventsForSageMakerTransformJobsRule",
                  "arn:aws:events:*:*:rule/StepFunctionsGetEventsForSageMakerTuningJobsRule",
                  "arn:aws:events:*:*:rule/StepFunctionsGetEventsForECSTaskRule",
                  "arn:aws:events:*:*:rule/StepFunctionsGetEventsForBatchJobsRule"
              ]
          }
      ]
  }
  ```

### Details

* It uses the standard Step Functions task `arn:aws:states:::sagemaker:createTrainingJob.sync` to train the model.

* It uses a dynamic TrainingJobName by formatting `project-name-{}` with `Execution.Name` value from [Step Functions Context Object](https://docs.aws.amazon.com/step-functions/latest/dg/input-output-contextobject.html).

  ```json
  "TrainingJobName.$": "States.Format('sagemaker-bring-your-own-{}', $$.Execution.Name)"
  ```

* It uses an existing image `"305326993135.dkr.ecr.ap-southeast-1.amazonaws.com/sagemaker-bring-your-own"` uploaded to ECR.

* The `InputDataConfig` specifies an input channel `training` pointing to a S3 bucket. SageMaker will download all files matching `S3Uri` prefix and save it to a folder in `/opt/ml/data/input/<channel_name>`. Input file type is specified in `ContentType`.

* In `OutputDataConfig`, `S3OutputPath` specifies where model files will be saved to.



## Training Task + Retry + Error Notification + Fail

Add retry in the training job. If it still fails, send a notification through SNS, and finally make the task fail. 

![image-20220204172602240](https://raw.githubusercontent.com/qinjie/picgo-images/main/image-20220204172602240.png)

```json
{
  "Comment": "An example to train and host SageMaker model",
  "StartAt": "SageMakerModelTraining",
  "States": {
    "SageMakerModelTraining": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sagemaker:createTrainingJob.sync",
      "Parameters": {
        "TrainingJobName.$": "States.Format('sagemaker-bring-your-own-{}', $$.Execution.Name)",
        "AlgorithmSpecification": {
          "TrainingImage": "305326993135.dkr.ecr.ap-southeast-1.amazonaws.com/sagemaker-bring-your-own",
          "TrainingInputMode": "File"
        },
        "HyperParameters": {},
        "OutputDataConfig": {
          "S3OutputPath": "s3://temp-305326993135/sagemaker_bring_your_own/output/models"
        },
        "InputDataConfig": [
          {
            "ChannelName": "training",
            "DataSource": {
              "S3DataSource": {
                "S3DataType": "S3Prefix",
                "S3Uri": "s3://temp-305326993135/sagemaker_bring_your_own/input/data/train/",
                "S3DataDistributionType": "FullyReplicated"
              }
            },
            "ContentType": "text/csv"
          }
        ],
        "ResourceConfig": {
          "InstanceCount": 1,
          "InstanceType": "ml.c4.2xlarge",
          "VolumeSizeInGB": 10
        },
        "RoleArn": "arn:aws:iam::305326993135:role/u-SageMakerExecutionRole",
        "StoppingCondition": {
          "MaxRuntimeInSeconds": 172800
        }
      },
      "Retry": [
        {
          "ErrorEquals": [
            "SageMaker.AmazonSageMakerException"
          ],
          "IntervalSeconds": 1,
          "MaxAttempts": 5,
          "BackoffRate": 1.1
        }
      ],
      "Catch": [
        {
          "ErrorEquals": [
            "States.ALL"
          ],
          "Next": "Notify Failure"
        }
      ],
      "End": true
    },
    "Notify Failure": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sns:publish",
      "Parameters": {
        "Subject": "[ERROR] Model Training failed!",
        "Message": "Error during model training!",
        "TopicArn": "arn:aws:sns:ap-southeast-1:305326993135:whitespace_alerts",
        "MessageAttributes": {}
      },
      "Next": "Fail"
    },
    "Fail": {
      "Type": "Fail"
    }
  }
}
```

### Prerequisites

* Create a SNS topic to catch all error message



## Use Input Parameters





## Train Multiple Models





## Training + Hosting Task

