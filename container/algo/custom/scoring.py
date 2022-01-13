import pickle

from .config import model_file


class ScoringService(object):
    """
    A singleton for holding the model. This simply loads the model and holds it.
    It has a predict function that does a prediction based on the model and the input data.
    """
    model = None  # Where we keep the model when it's loaded

    @classmethod
    def get_model(cls):
        """Get the model object for this instance, loading it if it's not already loaded.
        """
        if cls.model == None:
            print(f"Load model from {model_file}")
            with open(model_file, "rb") as inp:
                cls.model = pickle.load(inp)
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
        return model.predict(input)
