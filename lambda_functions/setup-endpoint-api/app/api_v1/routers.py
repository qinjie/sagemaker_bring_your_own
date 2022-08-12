from fastapi import APIRouter

from app.api_v1 import sagemaker_api

routers = APIRouter()
routers.include_router(
    sagemaker_api.router, tags=["SageMaker"])
