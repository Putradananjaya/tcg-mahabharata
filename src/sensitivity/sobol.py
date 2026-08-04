"""Sobol global sensitivity analysis (Saltelli 2002/2010 sampling +
estimators) over the card-parameter space defined in
src/simulator/fitness.py's BOUNDS.

Review motivation (Fase 9): only one parameter (Karna HP) had ever been
swept -- a 1D slice through a 25-dimensional space that says nothing about
which of the other 24 parameters actually control balance, or how much of
the output variance is driven by interactions between parameters rather
than any single one. Sobol indices answer exactly that:

  S_i  (first-order): fraction of output variance explained by parameter
       i varying alone, averaged over all other parameters.
  S_Ti (total-order): fraction of output variance that involves parameter
       i at all, including every interaction it participates in. S_Ti > S_i
       means parameter i's effect depends on the other parameters' values
       (a real interaction), not just its own value in isolation.

No scipy/SALib in this venv -- implemented directly from the closed-form
Saltelli estimators (Saltelli et al. 2010, "Variance based sensitivity
analysis of model output. Design and estimator for the total sensitivity
index", Computer Physics Communications 181), which need only elementary
arithmetic over the model's own outputs.
"""
from __future__ import annotations

import numpy as np


def _sample_matrix(bounds: dict, num_samples: int, rng: np.random.Generator) -> np.ndarray:
    keys = sorted(bounds.keys())
    low = np.array([bounds[k][0] for k in keys], dtype=float)
    high = np.array([bounds[k][1] for k in keys], dtype=float)
    u = rng.uniform(0.0, 1.0, size=(num_samples, len(keys)))
    return low + u * (high - low)


def _row_to_dict(row: np.ndarray, keys: list) -> dict:
    return {k: int(round(v)) for k, v in zip(keys, row)}


def sobol_indices(bounds: dict, model_fn, num_samples: int, seed: int = None) -> dict:
    """Saltelli sampling + estimators. `model_fn(theta_dict) -> float`
    (the scalar quantity of interest -- e.g. a balance-deviation loss).

    Total model evaluations: num_samples * (d + 2), d = len(bounds).

    Returns {"param_names": [...], "S1": {name: value}, "ST": {name: value},
    "S1_conf": {...}, "ST_conf": {...} (bootstrap 95% CI half-widths),
    "num_samples": num_samples, "num_evaluations": int}.
    """
    keys = sorted(bounds.keys())
    d = len(keys)
    rng = np.random.default_rng(seed)

    A = _sample_matrix(bounds, num_samples, rng)
    B = _sample_matrix(bounds, num_samples, rng)

    y_A = np.array([model_fn(_row_to_dict(row, keys)) for row in A])
    y_B = np.array([model_fn(_row_to_dict(row, keys)) for row in B])

    y_AB = np.zeros((d, num_samples))
    for i in range(d):
        AB_i = A.copy()
        AB_i[:, i] = B[:, i]
        y_AB[i] = np.array([model_fn(_row_to_dict(row, keys)) for row in AB_i])

    y_all = np.concatenate([y_A, y_B])
    var_y = np.var(y_all, ddof=1)

    S1, ST = {}, {}
    S1_boot_all, ST_boot_all = {}, {}
    n_boot = 400
    for i, key in enumerate(keys):
        # First-order (Saltelli 2010, Eq. 4.20-style estimator).
        s1_num = np.mean(y_B * (y_AB[i] - y_A))
        S1[key] = float(s1_num / var_y) if var_y > 0 else 0.0

        # Total-order (Jansen 1999 / Saltelli 2010 estimator).
        st_num = 0.5 * np.mean((y_A - y_AB[i]) ** 2)
        ST[key] = float(st_num / var_y) if var_y > 0 else 0.0

        # Bootstrap CI (resample the N pairs together, since y_A[j]/y_B[j]/y_AB[i][j]
        # share sample j and must be resampled jointly to preserve the estimator's structure).
        boot_s1 = np.empty(n_boot)
        boot_st = np.empty(n_boot)
        for b in range(n_boot):
            idx = rng.integers(0, num_samples, size=num_samples)
            yA_b, yB_b, yABi_b = y_A[idx], y_B[idx], y_AB[i][idx]
            var_b = np.var(np.concatenate([yA_b, yB_b]), ddof=1)
            if var_b > 0:
                boot_s1[b] = np.mean(yB_b * (yABi_b - yA_b)) / var_b
                boot_st[b] = 0.5 * np.mean((yA_b - yABi_b) ** 2) / var_b
            else:
                boot_s1[b] = 0.0
                boot_st[b] = 0.0
        S1_boot_all[key] = float(1.96 * np.std(boot_s1, ddof=1))
        ST_boot_all[key] = float(1.96 * np.std(boot_st, ddof=1))

    return {
        "param_names": keys, "S1": S1, "ST": ST,
        "S1_conf": S1_boot_all, "ST_conf": ST_boot_all,
        "num_samples": num_samples, "num_evaluations": num_samples * (d + 2),
        "output_variance": float(var_y),
    }
