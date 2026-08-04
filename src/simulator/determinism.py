"""Seed control for reproducible simulation runs.

The existing engine (`src/domain/models.py`, `src/simulator/engine.py`,
`src/simulator/fitness.py`) currently calls the global `random` and `numpy.random`
modules directly without accepting a seed. Until those call sites are refactored
to take an explicit RNG, `seed_everything` is the only reproducibility lever:
it seeds the global generators so a run can be repeated.
"""

import random

try:
    import numpy as np
except ImportError:
    np = None


def seed_everything(seed: int) -> None:
    """Seed all global RNGs used across the codebase."""
    random.seed(seed)
    if np is not None:
        np.random.seed(seed)


def seeds_for_run(base_seed: int, num_seeds: int) -> list[int]:
    """Derive `num_seeds` distinct, deterministic seeds from a base seed.

    Used to satisfy the >=10 seed / mean +/- 95% CI reporting requirement
    (see CLAIMS_LEDGER.md) without hand-picking seed values.
    """
    rng = random.Random(base_seed)
    return [rng.randrange(2**31 - 1) for _ in range(num_seeds)]
