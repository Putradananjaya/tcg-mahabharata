"""Sobol global sensitivity analysis over the card-parameter space defined in
src/simulator/fitness.py's BOUNDS."""


def sobol_indices(bounds: dict, model_fn, num_samples: int):
    """Return first-order and total-order Sobol indices for each parameter in bounds."""
    raise NotImplementedError
