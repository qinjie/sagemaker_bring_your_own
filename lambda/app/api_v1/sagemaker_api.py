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
async def predict_csv_file(request: Request, file_obj: UploadFile = File(...)):
    """
    Upload a CSV file and invoke SageMaker endpoint for scoring.
    """
    logger.info(
        f'filename: {file_obj.filename}, content-type: {file_obj.content_type}')
    # local_path = save_file_to_local(file_obj.filename, file_obj.file)
    # if not local_path:
    #     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #                         detail="Failed to save uploaded file.")

    payload = StringIO(str(file_obj.file.read()))
    logger.info(f'Payload: {payload}')
    response = runtime.invoke_endpoint(EndpointName=SAGEMAKER_ENDPOINT,
                                       ContentType='text/csv',
                                       Body=payload)
    print('Response:', response)
    result = json.loads(response['Body'].read().decode())
    print('Result:', result)

    if result:
        return JSONResponse(content={'result': result},
                            status_code=status.HTTP_200_OK)
    else:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="File could not be uploaded")
