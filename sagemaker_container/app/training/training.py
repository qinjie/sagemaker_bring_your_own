import json
import logging
import os
import pickle
import sys
import traceback
from typing import Tuple

import numpy as np
import pandas as pd
from config.config import (VALIDATION_ACCURACY_MESSAGE, failure_file, label_encoder_file, model_file,
                           param_file, training_folder)
from sklearn.model_selection import GridSearchCV
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import LabelEncoder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


class TrainingService():

    @classmethod
    def load_training_data(cls, csv_folder: str) -> Tuple:
        """
        Load training data from csv files. All files are concatinated into one DataFrame
        args:
            csv_folder (str): Folder containing csv files for training
        returns:
            X_all (pd.DataFrame): features
            y_all (pd.Series): label
        """
        # Take the set of files and read them all into a single pandas dataframe
        input_files = [os.path.join(csv_folder, file)
                       for file in os.listdir(csv_folder)]
        if len(input_files) == 0:
            raise ValueError(f'No input files in folder {csv_folder}.\n')

        raw_data = [pd.read_csv(file, header=None) for file in input_files]
        train_data = pd.concat(raw_data)
        logger.info(f'Rows in training data {len(train_data)}')
        # labels are in the first column
        y_all = train_data.iloc[:, 0]
        X_all = train_data.iloc[:, 1:]

        return X_all, y_all

    @classmethod
    def train_model(cls, X: pd.DataFrame, y: pd.Series, trainingParams: dict):
        logger.info('Starting the training.')

        # Get hyperparameters which are always passed in as strings, so we need to do any necessary conversions.
        n_neighbors = trainingParams.get('n_neighbors', "3")
        if n_neighbors is not None:
            n_neighbors = int(n_neighbors)

        # Use label encoder to transform categorical target into numeric value.
        label_encoder = LabelEncoder()
        y = label_encoder.fit_transform(y)
        logger.info(f'Label encoder classes: {label_encoder.classes_}')
        with open(label_encoder_file, 'wb') as out:
            pickle.dump(label_encoder, out)

        # Train the model using 5 fold cross validation
        model = KNeighborsClassifier(n_neighbors=n_neighbors)
        params = {}
        gs = GridSearchCV(model, param_grid={}, scoring='accuracy', cv=5)
        gs.fit(X, y)
        logger.info(f'Best param: {gs.best_params_}')
        cv_scores = gs.score(X, y)
        logger.info(VALIDATION_ACCURACY_MESSAGE.format(np.mean(cv_scores)))
        return gs

    @classmethod
    def save_model(cls, model, output_file: str):
        """Save the model
        args:
            model: Model object
            output_file: Output file path
        """
        with open(output_file, 'wb') as out:
            pickle.dump(model, out)
        logger.info('Training complete.')

    @classmethod
    def main(cls):
        """
        Main function for model training
        """
        try:
            # Load training data
            X_all, y_all = cls.load_training_data(training_folder)
            # Read in any hyperparameters that the user passed with the training job
            with open(param_file, 'r') as tc:
                training_params = json.load(tc)
            # Train the model
            model = cls.train_model(X_all, y_all, training_params)
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
            logger.exception(f'Exception during training: {str(e)}')
            logger.error(f'{trc}')
            # A non-zero exit code causes the training job to be marked as Failed.
            sys.exit(255)
