# SageMaker Bring Your Own Model in Container



This project deploys an ML model to SageMaker. The ML model is packaged in a Docker image and published in AWS ECR. It uses Step Functions to orchestrate the training, deployment and redeployment of ML mode. It also add an API endpoint to serve the ML model. 

## Project Structure

This project contains following subfolders:

* `iac_cdk`: It contains a CDK project to publish the container image to ECR, deploy a step function defined in a JSON file, and an API endpoint using a lambda function and API Gateway.
* `lambda`: It contains a lambda function implemented using FastAPI.
* `sagemaker_container`: It contains ML code and Dockerfile to package them into a docker image. 
* `step_functions`: It contains the definition file for the step function, and a sample input to run the step function.



## End Result



### Overall Setup

Project deployment is done through CDK. When developer commits code into `dev` branch of the GitHub repo, codepipeline will be triggered to update the deployment.

![image-20220208170338458](https://raw.githubusercontent.com/qinjie/picgo-images/main/image-20220208170338458.png)

### Step Function

The step function is setup using definition file `definition.asl.json` in `step_functions` folder.

![image-20220206171943582](https://raw.githubusercontent.com/qinjie/picgo-images/main/image-20220206171943582.png)

