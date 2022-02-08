from io import StringIO
import json
import logging
import os
import pathlib

import boto3
from fastapi import APIRouter, HTTPException, status, Request
from fastapi import File, UploadFile
from fastapi.responses import JSONResponse

from app.config import LOCAL_FOLDER

logger = logging.getLogger('sagemaker_api')
logger.setLevel(logging.INFO)

router = APIRouter()

SAGEMAKER_ENDPOINT = os.environ['SAGEMAKER_ENDPOINT']
runtime = boto3.client('runtime.sagemaker')


def save_file_to_local(file_name, file):
    """
    Save a file object as a local file.
    """
    try:
        p = pathlib.Path(LOCAL_FOLDER).joinpath(file_name)
        if p.exists():
            p.unlink(missing_ok=True)
        with open(str(p), 'wb') as f:
            f.write(file.read())
        logger.info(f'Save file to {str(p)}')
        return str(p)
    except Exception as e:
        logger.error(f'Failed to save file: {file_name}')
        logger.exception(e)


@router.post('/predict_csv_file')
async def predict_csv_file(request: Request, csv_file: UploadFile = File(...)):
    """
    Upload a CSV file and invoke SageMaker endpoint for scoring.
    """
    logger.info(f'Input file: {csv_file.filename}, {csv_file.content_type}')

    payload = StringIO(str(csv_file.file.read(), encoding='utf-8'))
    print(f'{SAGEMAKER_ENDPOINT}')
    response = runtime.invoke_endpoint(EndpointName=SAGEMAKER_ENDPOINT,
                                       ContentType='text/csv',
                                       Body=payload.getvalue())
    result = response['Body'].read().decode()
    result = result.split()
    print(f'Response:, {response} Result:, {result}')

    if result:
        return JSONResponse(content={'result': result},
                            status_code=status.HTTP_200_OK)
    else:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="File could not be uploaded")
