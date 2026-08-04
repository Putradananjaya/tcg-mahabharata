"""Morris elementary-effects screening over the card-parameter space defined in
src/simulator/fitness.py's BOUNDS."""


def morris_elementary_effects(bounds: dict, model_fn, num_trajectories: int):
    """Return mean and std of elementary effects for each parameter in bounds."""
    raise NotImplementedError
