import csv
import json
import logging

import boto3
import botocore

logging.basicConfig(level=logging.INFO, force=True)
logger = logging.getLogger()

sm_client = boto3.client("sagemaker")
s3_client = boto3.client('s3')

local_file = '/tmp/model_metrics.csv'
csv_headers = ["TrainingJobName", "MetricName", "Value", "Timestamp"]
DELIMITER = ','


def upload_s3_file(bucket_name: str, key: str, local_file_path: str):
    """
    Upload a local file to s3 bucket
    """
    with open(local_file_path, "rb") as f:
        logger.info(f'Uploading file to s3 bucket: {bucket_name}, {key}, {local_file_path}')
        s3_client.upload_fileobj(f, bucket_name, key)


def download_s3_file(bucket_name: str, key: str, local_file_path: str) -> bool:
    """
    Save an s3 object as a local file
    """
    try:
        s3_client.download_file(bucket_name, key, local_file_path)
        return True
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == "404":
            logger.error(f"S3 object not exist: {bucket_name}, {key}")
        else:
            logger.error(str(e))
        return False


def lambda_handler(event, context):
    """
    Retrieve transform job name from event and return transform job status.
    """
    logger.info(json.dumps(event))

    job_name = event.get('TrainingJobName', None)
    dest_bucket = event.get('DestinationBucket', None)
    result_csv = event.get('CsvFile', None)

    if not job_name:
        raise KeyError(f'TrainingJobName key not found in event: {json.dumps(event)}')

    # Query boto3 API to check training status.
    try:
        response = sm_client.describe_training_job(TrainingJobName=job_name)
        logger.info(f'Training job {job_name} has status: {response["TrainingJobStatus"]}.')
    except Exception as ex:
        logger.exception(str(ex))
        raise

    # If metrics data is not found
    if not response.get('FinalMetricDataList'):
        raise Exception('No metrics found. Make sure MetricDefinitions is defined during training.')

    current_metrics = []
    for item in response.get('FinalMetricDataList'):
        # Convert datetime to timestamp
        item['Timestamp'] = item['Timestamp'].timestamp()
        current_metrics.append(item)

    past_metrics = {}
    for row in current_metrics:
        past_metrics[row['MetricName']] = []

    # Output to s3 if bucket and file are set
    if dest_bucket and result_csv:
        # Download file from s3 bucket, if not exists, create an empty file
        if not download_s3_file(dest_bucket, result_csv, local_file):
            with open(local_file, 'w') as f:
                f.write(DELIMITER.join(csv_headers) + '\n')

        # Read past metrics values
        with open(local_file, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['MetricName'] in past_metrics.keys():
                    past_metrics[row['MetricName']].append(row['Value'])
        logger.info(f'Past metrics: {past_metrics}')

        # Append current metrics
        with open(local_file, 'a') as f:
            writer = csv.DictWriter(f, fieldnames=csv_headers)
            for row in current_metrics:
                row['TrainingJobName'] = job_name
                writer.writerow(row)

        # Upload file to s3 bucket
        upload_s3_file(bucket_name=dest_bucket, key=result_csv, local_file_path=local_file)

    # Add PastMin PastMax to current metrics
    enhanced_metrics = []
    for item in current_metrics:
        name = item['MetricName']
        # Get min and max of past same metric
        item['PastMin'] = min(past_metrics[name]) if past_metrics[name] else 1
        item['PastMax'] = max(past_metrics[name]) if past_metrics[name] else 0
        enhanced_metrics.append(item)

    logger.info(enhanced_metrics)

    return {"TrainingMetrics": enhanced_metrics}
