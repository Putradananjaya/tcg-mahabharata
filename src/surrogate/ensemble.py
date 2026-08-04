"""Deep ensemble of MLPSurrogate models for predictive uncertainty estimation."""

from src.surrogate.mlp import MLPSurrogate


class MLPEnsemble:
    def __init__(self, num_models: int = 5, **mlp_kwargs):
        self.models = [MLPSurrogate(**mlp_kwargs) for _ in range(num_models)]

    def predict_with_uncertainty(self, x):
        """Return (mean_prediction, std_across_models) for each input row."""
        raise NotImplementedError
