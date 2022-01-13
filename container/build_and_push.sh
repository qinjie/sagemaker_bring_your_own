#!/usr/bin/env bash

# This script builds the Docker image and push it to ECR to be used by SageMaker.
# Usage: ./build_and_push <IMAGE_NAME>

# First argument will be used as the image name
image=$1

if [ "$image" == "" ]
then
    echo "Usage: $0 <image-name>"
    exit 1
fi

# Add execution mode for train and serve files 
chmod +x algo/train
chmod +x algo/serve

# Get the account number associated with the current IAM credentials
account=$(aws sts get-caller-identity --query Account --output text)

if [ $? -ne 0 ]
then
    exit 255
fi

# Get the region defined in the current configuration (default to us-west-2 if none defined)
region=$(aws configure get region)
region=${region:-us-west-2}

# Fullname of the ECR image
fullname="${account}.dkr.ecr.${region}.amazonaws.com/${image}:latest"

# If the ECR repository doesn't exist in ECR, create it.
aws ecr describe-repositories --repository-names "${image}" > /dev/null 2>&1

if [ $? -ne 0 ]
then
    aws ecr create-repository --repository-name "${image}" > /dev/null
fi

# Get the login command from ECR and execute it directly
aws ecr get-login-password --region "${region}" \
    | docker login --username AWS --password-stdin "${account}".dkr.ecr."${region}".amazonaws.com

# Build the docker image locally with the image name and then push it to ECR with the full name.
docker build  -t ${image} .
docker tag ${image} ${fullname}

docker push ${fullname}
