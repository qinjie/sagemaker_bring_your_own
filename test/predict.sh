#!/bin/bash

# Get input arguments: payload and content-type
payload=$1
content=${2:-text/csv}

# Call /invocations endpoint to invoke model
curl --data-binary @${payload} -H "Content-Type: ${content}" -v http://localhost:8080/invocations
