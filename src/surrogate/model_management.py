"""Infill / re-evaluation loop: decide when the surrogate's uncertainty is high
enough that a candidate point should be re-evaluated on the real simulator
instead of trusted, and manage retraining the surrogate on the growing dataset.
"""


def select_infill_points(candidates, ensemble, uncertainty_threshold: float):
    """Return the subset of candidates whose ensemble uncertainty exceeds the threshold."""
    raise NotImplementedError


def retrain_with_infill(ensemble, dataset, new_points):
    """Evaluate new_points on the real simulator, append to dataset, retrain ensemble."""
    raise NotImplementedError
