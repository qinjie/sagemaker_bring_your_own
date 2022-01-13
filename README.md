# SageMaker Bring Your Own Algorithm Container

SageMaker supports two execution modes: _training_ where the algorithm uses input data to train a new model and _serving_ where the algorithm accepts HTTP requests and uses the previously trained model to do an inference.

This project packages our own algorithm into a Docker image to be used in SageMaker. This same container image supports both training and scoring in SageMaker.

The inference server in container is setup using `nginx`, `gunicorn`, and `flask`.

## Folder Structure

- **Dockerfile**: Describes how the image is built and what it contains.

- **build_and_push.sh**: Build the Docker image and push it to the [Amazon EC2 Container Registry (ECR)][ecr] so that it can be deployed to SageMaker.

- **algo** folder: Contains the application to run in the container.

- **local-test** folder: Containing the scripts to run a simple training and inference jobs locally. Used for testing.

### Code Files

This folder contains the main scripts for traning and scoring.

When SageMaker starts a container, it will invoke the container with an argument of either **train** or **serve**.

- **train**: The main program for training the model. Modify this to include your training code.
- **predictor.py**: The algorithm-specific inference server. Modify this file with your own algorithm's code.

#### Other Files

In most cases, you can use following files as-is.

- **serve**: The wrapper that starts the inference server.
- **wsgi.py**: The start up shell for the individual server workers. This only needs to be changed if you changed where predictor.py is located or is named.
- **nginx.conf**: The configuration for the nginx master server that manages the multiple workers.

### Testing

Apart fr

```bash

```

```bash

```

```bash

```

### Folder `local_test`

This folder contains scripts and sample data for testing the built container image on the local machine.

#### train_local.sh

Instantiate the container configured for training.

```
./train_local.sh sagemaker_bring_your_own
docker run -it --entrypoint /bin/bash -v D:/tmp/scikit_bring_your_own/container/local_test/test_dir:/opt/ml sagemaker_bring_your_own /bin/bash
```

- **serve-local.sh**: Instantiate the container configured for serving.
- **predict.sh**: Run predictions against a locally instantiated server.
- **test-dir**: The directory that gets mounted into the container with test data mounted in all the places that match the container schema.
- **payload.csv**: Sample data for used by predict.sh for testing the server.

#### Subfolder `test_dir`

This subfolder is mounted into the container and mimics the directory structure in container that SageMaker would create for the running container during training or hosting.

- **input/config/\*.json**: The hyperparameters for the training job.
- **input/data/training/input.csv**: The training data.
- **model**: The directory where the algorithm writes the model file.
- **output**: The directory where the algorithm can write its success or failure file.

## Environment variables

When you create an inference server, you can control some of Gunicorn's options via environment variables. These
can be supplied as part of the CreateModel API call.

    Parameter                Environment Variable              Default Value
    ---------                --------------------              -------------
    number of workers        MODEL_SERVER_WORKERS              the number of CPU cores
    timeout                  MODEL_SERVER_TIMEOUT              60 seconds
