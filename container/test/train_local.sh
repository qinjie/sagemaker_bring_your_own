#!/bin/sh

# This script train model locally.
# Usage: ./train_local <IMAGE_NAME>

# First argument will be used as the image name
image=$1

# Clean up local folders
mkdir -p test_dir/model
mkdir -p test_dir/output
rm test_dir/model/*
rm test_dir/output/*

# Map local folder "./test_dir" to container folder "/opt/ml"
echo $(pwd)/test_dir:/opt/ml
docker run -v $(pwd)/test_dir:/opt/ml --rm ${image} train
