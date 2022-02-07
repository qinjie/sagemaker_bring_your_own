# Build an image that can do training and inference in SageMaker.
# Uses the nginx, gunicorn, flask stack to serve inferences.

FROM ubuntu:20.04

LABEL maintainer="DSAID CapDev <data@tech.gov.sg>"

ENV DEBIAN_FRONTEND=noninteractive

# Install libraries
RUN apt -y update
RUN apt install -y --no-install-recommends \
    wget \
    python3-pip \
    python3-setuptools \
    nginx \
    ca-certificates
RUN rm -rf /var/lib/apt/lists/*

# Link python to python3
RUN ln -s /usr/bin/python3 /usr/bin/python

RUN pip install --upgrade setuptools

# Install Python libraries specified in requirements.txt
COPY app/requirements.txt /tmp/
RUN pip --no-cache-dir install -r /tmp/requirements.txt

# Stop Python from buffering standard output stream
ENV PYTHONUNBUFFERED=TRUE
# Stop Python from writing the .pyc files
ENV PYTHONDONTWRITEBYTECODE=TRUE
# Add /opt/program to PATH
ENV PATH="/opt/program:${PATH}"

# Copy content in /app folder into /opt/program
COPY app /opt/program
WORKDIR /opt/program
RUN chmod +x train
RUN chmod +x serve
