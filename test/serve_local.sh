#!/bin/sh

# This script serve the model for prediction.
# Usage: ./serve_local <IMAGE_NAME>

# First argument will be used as the image name
image=$1

# Mount local folder "./test_dir" to container folder "/opt/ml". 
# Start server for inference
docker run -v $(pwd)/test_dir:/opt/ml -p 8080:8080 --rm ${image} serve
