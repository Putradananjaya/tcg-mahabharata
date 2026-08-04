"""Morris elementary-effects screening (Morris, 1991, "Factorial sampling
plans for preliminary computational experiments", Technometrics) over the
card-parameter space defined in src/simulator/fitness.py's BOUNDS.

Cheap initial screening, meant to run BEFORE src.sensitivity.sobol
(Fase 9 task: "penyaringan awal yang murah"): num_trajectories * (d + 1)
model evaluations vs. Sobol's num_samples * (d + 2) -- Morris needs far
fewer trajectories than Sobol needs samples to rank which parameters
matter at all, at the cost of only a screening-grade signal (it does not
decompose variance the way Sobol does).

Implementation: for each trajectory, a random base point on a p-level grid
is perturbed ONE parameter at a time (in a random order, each by a random
+/-delta that stays in bounds), and the elementary effect
EE_i = (f(x + delta*e_i) - f(x)) / delta is recorded for whichever
parameter changed at that step. This is the standard one-at-a-time (OAT)
trajectory design at the core of Morris's method (implemented directly
against BOUNDS/random sampling rather than via the B*/orientation-matrix
formalism of the original paper, which is an equivalent way to generate
the same kind of OAT trajectories).

Two summary statistics per parameter, over all trajectories:
  mu_star : mean(|EE_i|) -- overall influence (Campolongo et al. 2007's
            revision, using absolute value so a parameter with effects
            that flip sign across the space doesn't cancel out to ~0).
  sigma   : std(EE_i) -- high sigma relative to mu_star indicates
            nonlinear effects and/or interactions with other parameters
            (the direction/magnitude of parameter i's effect depends on
            where else in the space you are).
"""
from __future__ import annotations

import numpy as np


def morris_elementary_effects(bounds: dict, model_fn, num_trajectories: int,
                               num_levels: int = 4, seed: int = None) -> dict:
    """Returns {"param_names": [...], "mu": {name: value}, "mu_star": {...},
    "sigma": {...}, "num_trajectories": int, "num_evaluations": int}."""
    keys = sorted(bounds.keys())
    d = len(keys)
    low = np.array([bounds[k][0] for k in keys], dtype=float)
    high = np.array([bounds[k][1] for k in keys], dtype=float)
    span = high - low

    rng = np.random.default_rng(seed)
    delta = num_levels / (2.0 * (num_levels - 1))  # standard Morris grid step, in [0,1]-normalized units

    effects = {key: [] for key in keys}
    num_evaluations = 0

    for _traj in range(num_trajectories):
        # Random base point on the p-level grid, normalized to [0,1]^d.
        levels = np.arange(num_levels) / (num_levels - 1)
        x_norm = rng.choice(levels, size=d)

        order = rng.permutation(d)
        directions = rng.choice([-1.0, 1.0], size=d)
        # Keep each step inside [0,1]: flip direction where it would overshoot.
        for i in range(d):
            if directions[i] > 0 and x_norm[i] + delta > 1.0:
                directions[i] = -1.0
            elif directions[i] < 0 and x_norm[i] - delta < 0.0:
                directions[i] = 1.0

        def to_theta(xn):
            raw = low + xn * span
            return {k: int(round(v)) for k, v in zip(keys, raw)}

        f_prev = model_fn(to_theta(x_norm))
        num_evaluations += 1
        x_current = x_norm.copy()
        for i in order:
            x_next = x_current.copy()
            x_next[i] = x_current[i] + directions[i] * delta
            f_next = model_fn(to_theta(x_next))
            num_evaluations += 1
            ee = (f_next - f_prev) / (directions[i] * delta)
            effects[keys[i]].append(ee)
            x_current = x_next
            f_prev = f_next

    mu, mu_star, sigma = {}, {}, {}
    for key in keys:
        arr = np.array(effects[key])
        mu[key] = float(arr.mean())
        mu_star[key] = float(np.abs(arr).mean())
        sigma[key] = float(arr.std(ddof=1)) if len(arr) > 1 else 0.0

    return {
        "param_names": keys, "mu": mu, "mu_star": mu_star, "sigma": sigma,
        "num_trajectories": num_trajectories, "num_levels": num_levels,
        "num_evaluations": num_evaluations,
    }
