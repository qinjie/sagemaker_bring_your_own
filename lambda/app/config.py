import os
from dotenv import load_dotenv
import logging

logger = logging.getLogger()
logging.basicConfig(level=logging.INFO)

load_dotenv()

APP_CODE = os.environ['APP_CODE']
APP_NAME = os.environ['APP_NAME']
LOCAL_FOLDER = '/tmp'
