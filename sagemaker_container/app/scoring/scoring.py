import pickle

from config.config import model_file, label_encoder_file


class ScoringService(object):
    """
    A singleton for holding the model. This simply loads the model and holds it.
    It has a predict function that does a prediction based on the model and the input data.
    """
    model = None  # Where we keep the model when it's loaded
    label_encoder = None

    @classmethod
    def get_label_encoder(cls):
        """Get the label encoder object which was saved during training.
        """
        if cls.label_encoder is None:
            print(f'Load label encoder from {label_encoder_file}')
            with open(label_encoder_file, 'rb') as f:
                cls.label_encoder = pickle.load(f)
        return cls.label_encoder

    @classmethod
    def get_model(cls):
        """Get the model object for this instance, loading it if it's not already loaded.
        """
        if cls.model is None:
            print(f"Load model from {model_file}")
            with open(model_file, "rb") as f:
                cls.model = pickle.load(f)
        return cls.model

    @classmethod
    def predict(cls, input):
        """For the input, do the predictions and return them.

        Args:
            input (a pandas dataframe): The data on which to do the predictions. There will be
                one prediction per row in the dataframe
        """
        model = cls.get_model()
        print(f"Perform prediction on {len(input)} rows of input")
        output = model.predict(input)

        # # Convert output from numeric value to labels
        label_encoder = cls.get_label_encoder()
        result = label_encoder.inverse_transform(output)

        return result
