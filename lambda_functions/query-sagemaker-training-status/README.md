# Lambda - Query SageMaker Training Status

Lambda function to query metrics of a SageMaker training job.

It can also save the queried metrics to a file in S3 bucket if bucket name and file key are provided. 

It returns metrics of the model, with min and max value of the same metric from the s3 file.



### Input Data

The `event` parameter should contain following inputs. To save data into a CSV file, user must specify `DestinationBucket` and `ResultCsv`.

* TrainingJobName: name of a SageMaker training job
* DestinationBucket: [Optional] s3 bucket name where data will be saved to
* ResultCsv: [Optional] CSV file key where data will be appended to

```json
{"TrainingJobName": "name-of-sagemaker-training-job", "DestinationBucket": "bucket-name", "CsvFile": "s3-file-key"}
```



### Sample CSV File

If csv file doesn't exist in the bucket, it will be created with pre-defined header. 

```csv
TrainingJobName,MetricName,Value,Timestamp
sagemaker-bring-your-own-d6621f25-d1fe-17f1-9dd6-c21c407f0b44,validation:accuracy,0.9599999785423279,1648650394.0
```



### Response

```json
{
    "TrainingMetrics": 
    [
      {
        "MetricName": "validation:accuracy",
        "Value": 0.9599999785423279,
        "Timestamp": 1648650394,
        "TrainingJobName": "sagemaker-bring-your-own-d6621f25-d1fe-17f1-9dd6-c21c407f0b44",
        "Min": "0.1",
        "Max": "0.6"
      }
    ]
}
```

