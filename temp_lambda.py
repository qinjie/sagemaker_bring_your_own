import json
from time import strftime
import boto3
import sagemaker


CONTENT_TYPE_CSV = "text/csv"


def lambda_handler(event, context):
    print(event)

    model_name = 'SagemakerBringYourOwn-d8e8a2ce-cd63-bd69-c895-dd61d24b5732'

    input_file = 's3://temp-305326993135/sagemaker_bring_your_own/test/payload.csv'
    output_folder = 's3://temp-305326993135/sagemaker_bring_your_own/test'
    
    transform_job = sagemaker.transformer.Transformer(
        model_name = model_name,
        instance_count = 1,
        instance_type = 'ml.m4.xlarge',
        strategy = 'SingleRecord',
        assemble_with = 'Line',
        output_path = output_folder,
        base_transform_job_name='inference-pipelines-batch',
        sagemaker_session=sagemaker.Session(),
        accept = CONTENT_TYPE_CSV)
    transform_job.transform(data = input_file, 
                            content_type = CONTENT_TYPE_CSV, 
                            split_type = 'Line')