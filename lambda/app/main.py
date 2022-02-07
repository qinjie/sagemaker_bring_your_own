from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from app import config
from app.api_v1.routers import routers as v1_api_router

app = FastAPI()

# Enable CORS
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/')
def get_root(response: Response):
    return {'message': f'Welcome to {config.APP_NAME}'}


app.include_router(v1_api_router, prefix="/v1")

# Wrap API with Mangum
handler = Mangum(app)
