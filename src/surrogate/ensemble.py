"""Deep ensemble of MLPSurrogate models for predictive uncertainty
estimation (Lakshminarayanan, Pritzel & Blundell, NeurIPS 2017): train
`num_models` independently-initialized networks on (optionally shuffled)
copies of the same training data; disagreement across the ensemble at a
query point Theta is used as an estimate of sigma_hat(Theta), since a
region far from training data tends to produce more disagreement between
independently-initialized/-trained members than a well-covered region.

Diversity here comes from (1) independent random weight initialization per
member (src.surrogate.mlp.MLPSurrogate's `seed` parameter -- see that
module's Fase 6 fix; previously all members got IDENTICAL initial weights,
which would have made this ensemble's uncertainty estimate meaningless) and
(2) an independently shuffled training-batch order per member. This is the
"deep ensemble" recipe, not bootstrap bagging -- no data resampling is
done, matching Lakshminarayanan et al.'s finding that random init alone
(no bagging) already produces well-calibrated ensembles for this kind of
model, and keeps every member trained on the full dataset.
"""
from __future__ import annotations

import numpy as np

from src.surrogate.mlp import MLPSurrogate


class MLPEnsemble:
    def __init__(self, num_models: int = 5, seed: int = 0, **mlp_kwargs):
        self.num_models = num_models
        self.models = [MLPSurrogate(seed=seed + i, **mlp_kwargs) for i in range(num_models)]

    def fit(self, X_norm: np.ndarray, y: np.ndarray, epochs: int = 2000, learning_rate: float = 0.03,
            seed: int = 0, verbose: bool = False) -> "MLPEnsemble":
        """Train every member on the SAME (X_norm, y) -- no bootstrap
        resampling (see module docstring) -- but with an independently
        shuffled row order per member and per epoch, full-batch gradient
        descent via MLPSurrogate.forward/backward."""
        n = X_norm.shape[0]
        for m_idx, model in enumerate(self.models):
            rng = np.random.default_rng(seed + 1000 * (m_idx + 1))
            for epoch in range(epochs):
                order = rng.permutation(n)
                X_epoch, y_epoch = X_norm[order], y[order]
                preds = model.forward(X_epoch)
                model.backward(X_epoch, y_epoch, preds, learning_rate=learning_rate)
            if verbose:
                preds = model.forward(X_norm)
                mse = float(np.mean((preds - y) ** 2))
                print(f"    [ensemble member {m_idx}] final train MSE: {mse:.4f}")
        return self

    def predict_all(self, x: np.ndarray) -> np.ndarray:
        """Return every member's raw prediction, shape (num_models, n, output_dim)."""
        return np.stack([model.forward(x) for model in self.models], axis=0)

    def predict_with_uncertainty(self, x: np.ndarray):
        """Return (mean_prediction, std_across_models), each (n, output_dim)."""
        stacked = self.predict_all(x)
        return stacked.mean(axis=0), stacked.std(axis=0)
