import os
from pathlib import Path

ML_FOLDER = '/opt/ml/'

MODEL_FILE = 'model.pkl'
ENCODER_FILE = 'label_encoder.pkl'

# These are the paths to where SageMaker mounts interesting things in your container.
input_folder = os.path.join(ML_FOLDER, 'input')
output_folder = os.path.join(ML_FOLDER, 'output')
model_folder = os.path.join(ML_FOLDER, 'model')

# Create folders if they not exist
Path(input_folder).mkdir(parents=True, exist_ok=True)
Path(output_folder).mkdir(parents=True, exist_ok=True)
Path(model_folder).mkdir(parents=True, exist_ok=True)

# Input training files are placed in folder "input/data/training".
training_folder = os.path.join(input_folder, 'data', 'training')
Path(training_folder).mkdir(parents=True, exist_ok=True)

# If training fails, output to this file
failure_file = os.path.join(output_folder, 'failure')

# Any hyperparameters are saved in json file "input/config/hyperparameters.json"
param_file = os.path.join(input_folder, 'config', 'hyperparameters.json')

model_file = os.path.join(model_folder, MODEL_FILE)
label_encoder_file = os.path.join(model_folder, ENCODER_FILE)

# Regex to extract model
VALIDATION_ACCURACY_MESSAGE = 'validation_accuracy={}'
METRIC_DEFINITIONS = [{
    "Name": "validation:accuracy",
    "Regex": VALIDATION_ACCURACY_MESSAGE.format(r"([0-9\.]+)"),
}]
