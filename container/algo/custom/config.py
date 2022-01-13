import os

MODEL_FILE = 'model.pkl'
ML_FOLDER = '/opt/ml/'

# These are the paths to where SageMaker mounts interesting things in your container.
input_folder = os.path.join(ML_FOLDER, 'input')
output_folder = os.path.join(ML_FOLDER, 'output')
model_folder = os.path.join(ML_FOLDER, 'model')

# Input training files are placed in folder "input/data/training".
training_folder = os.path.join(input_folder, 'data', 'training')

# If training fails, output to this file
failure_file = os.path.join(output_folder, 'failure')

# Any hyperparameters are saved in json file "input/config/hyperparameters.json"
param_file = os.path.join(input_folder, 'config', 'hyperparameters.json')

model_file = os.path.join(model_folder, MODEL_FILE)
