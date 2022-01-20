import os
import pickle
import sys
import traceback

import pandas as pd
import json
from sklearn.neighbors import KNeighborsClassifier

from config.config import training_folder, param_file, model_file, failure_file


class TrainingService():

    @classmethod
    def load_training_data(cls, csv_folder: str):
        """
        Load training data from csv files. All files are concatinated into one DataFrame
        args:
            csv_folder (str): Folder containing csv files for training
        returns:
            train_y (pd.Series): label
            train_X (pd.DataFrame): features
        """
        # Take the set of files and read them all into a single pandas dataframe
        input_files = [os.path.join(csv_folder, file) for file in os.listdir(csv_folder)]
        if len(input_files) == 0:
            raise ValueError(f'No input files in folder {csv_folder}.\n')

        raw_data = [pd.read_csv(file, header=None) for file in input_files]
        train_data = pd.concat(raw_data)
        print(f'Rows in training data {len(train_data)}')
        # labels are in the first column
        train_y = train_data.iloc[:, 0]
        train_X = train_data.iloc[:, 1:]
        return train_X, train_y

    @classmethod
    def train_model(cls, train_X: pd.DataFrame, train_y: pd.Series, trainingParams: dict):
        print('Starting the training.')

        # Get hyperparameters which are always passed in as strings, so we need to do any necessary conversions.
        n_neighbors = trainingParams.get('n_neighbors', "3")
        if n_neighbors is not None:
            n_neighbors = int(n_neighbors)

        # Train the model.
        model = KNeighborsClassifier(n_neighbors=n_neighbors)
        model = model.fit(train_X, train_y)
        return model

    @classmethod
    def save_model(cls, model, output_file: str):
        """Save the model
        args:
            model: Model object
            output_file: Output file path
        """
        with open(output_file, 'wb') as out:
            pickle.dump(model, out)
        print('Training complete.')

    @classmethod
    def main(cls):
        """
        Main function for model training
        """
        try:
            # Load training data
            train_X, train_y = cls.load_training_data(training_folder)
            # Read in any hyperparameters that the user passed with the training job
            with open(param_file, 'r') as tc:
                training_params = json.load(tc)
            # Train the model
            model = cls.train_model(train_X, train_y, training_params)
            # Save model to file
            cls.save_model(model, model_file)
            # A zero exit code causes the job to be marked a Succeeded.
            sys.exit(0)
        except Exception as e:
            # Write out an error file. This will be returned as the failureReason in the
            # DescribeTrainingJob result.
            trc = traceback.format_exc()
            with open(failure_file, 'w') as s:
                s.write('Exception during training: ' + str(e) + '\n' + trc)
            # Printing this causes the exception to be in the training job logs, as well.
            print('Exception during training: ' + str(e) + '\n' + trc, file=sys.stderr)
            # A non-zero exit code causes the training job to be marked as Failed.
            sys.exit(255)
