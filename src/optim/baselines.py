"""Baseline optimizers for experiments/exp07_optimizer_ablation.py: Random
Search, CMA-ES, and Bayesian Optimization -- all sharing the uniform
`run_X_ablation(budget, num_runs, seed)` interface documented in
src.optim.ga.run_ga_ablation, all minimizing src.optim.objective's
scalarized_objective (Pers. 4).

CONSTRAINT HANDLING for CMA-ES and Bayesian Optimization (Fase 7 review;
see src.optim.pso's Fase 7 comment for PSO/Hybrid's identical concern):
both algorithms are natively continuous, so both operate internally in a
NORMALIZED [0,1]^25 space (`_normalize`/`_denormalize` below) rather than
raw integer units -- this keeps an isotropic step size / length-scale
meaningful across dimensions whose raw ranges differ by >100x (e.g.
`tms_duryodana_hp` spans 40, `stw_yudhistira_cost_univ` spans 1).
`_denormalize` is the actual repair operator: linearly maps back to
[low, high], ROUNDS to the nearest integer, then clips -- identical
round-then-clip philosophy to `src.optim.pso._round_clip`, just composed
with the normalization step. See rules_spec.md section 14.3 for the one
failure mode this causes (repeated rounding can stall a search once its
continuous position sits near an integer on every dimension it's still
exploring).

NUMERICAL NOTE: on this machine's numpy/BLAS build, small (~25x25) matmuls
occasionally raise a RuntimeWarning ("divide by zero"/"overflow"/"invalid
value encountered in matmul") on inputs that are provably fine -- verified
directly against `eigvecs @ np.diag(1.0/D) @ eigvecs.T` on a plain identity
matrix (D all exactly 1.0): the warning fires, but every output element is
finite and correct (`np.isfinite` all True). This is the same benign
BLAS-level false positive already documented in
experiments/exp06_surrogate_validation.py's leakage_demo(); suppressed here
via np.errstate around the affected blocks rather than left to alarm
readers of the script's stdout.
"""
from __future__ import annotations

import random

import numpy as np

from src.optim.objective import scalarized_objective
from src.simulator.fitness import BOUNDS, SMART_START
from src.surrogate.model_management import expected_improvement

_KEYS = sorted(BOUNDS.keys())
_LOWS = np.array([BOUNDS[k][0] for k in _KEYS], dtype=float)
_HIGHS = np.array([BOUNDS[k][1] for k in _KEYS], dtype=float)
_SPANS = _HIGHS - _LOWS
_DIM = len(_KEYS)


def _normalize(theta: dict) -> np.ndarray:
    return np.array([(theta[k] - BOUNDS[k][0]) / (BOUNDS[k][1] - BOUNDS[k][0]) for k in _KEYS])


def _denormalize(z: np.ndarray) -> dict:
    z_clipped = np.clip(z, 0.0, 1.0)
    raw = _LOWS + z_clipped * _SPANS
    return {k: int(max(BOUNDS[k][0], min(BOUNDS[k][1], round(raw[i])))) for i, k in enumerate(_KEYS)}


def run_random_search(budget: int, num_runs: int, seed: int):
    rng = random.Random(seed)
    history = []
    best_theta, best_value = None, float("inf")
    for i in range(budget):
        theta = {k: rng.randint(low, high) for k, (low, high) in BOUNDS.items()}
        total, _bal, _pc, _rates = scalarized_objective(theta, num_runs=num_runs)
        if total < best_value:
            best_value = total
            best_theta = dict(theta)
        history.append((i + 1, best_value))
    return {"best_theta": best_theta, "best_value": best_value, "history": history,
            "evals_used": budget, "method": "random_search"}


def run_cma_es(budget: int, num_runs: int, seed: int):
    """(mu/mu_w, lambda)-CMA-ES, Hansen's standard update equations
    (see e.g. Hansen 2016, "The CMA Evolution Strategy: A Tutorial"),
    operating in normalized [0,1]^25 space -- see module docstring."""
    rng_np = np.random.default_rng(seed)
    n = _DIM

    lam = 4 + int(3 * np.log(n))
    mu = lam // 2
    weights_raw = np.log(mu + 0.5) - np.log(np.arange(1, mu + 1))
    weights = weights_raw / weights_raw.sum()
    mueff = 1.0 / np.sum(weights ** 2)

    cc = (4 + mueff / n) / (n + 4 + 2 * mueff / n)
    cs = (mueff + 2) / (n + mueff + 5)
    c1 = 2 / ((n + 1.3) ** 2 + mueff)
    cmu = min(1 - c1, 2 * (mueff - 2 + 1 / mueff) / ((n + 2) ** 2 + mueff))
    damps = 1 + 2 * max(0, np.sqrt((mueff - 1) / (n + 1)) - 1) + cs
    chiN = n ** 0.5 * (1 - 1 / (4 * n) + 1 / (21 * n ** 2))

    xmean = _normalize(SMART_START)
    sigma = 0.3
    pc, ps = np.zeros(n), np.zeros(n)
    C = np.eye(n)

    generations = max(1, budget // lam)
    history = []
    evals_used = 0
    best_theta, best_value = None, float("inf")

    for gen in range(generations):
        with np.errstate(divide="ignore", over="ignore", invalid="ignore"):  # see module docstring's NUMERICAL NOTE
            C = (C + C.T) / 2
            eigvals, eigvecs = np.linalg.eigh(C)
            eigvals = np.clip(eigvals, 1e-20, None)
            D = np.sqrt(eigvals)
            invsqrtC = eigvecs @ np.diag(1.0 / D) @ eigvecs.T

            arz = rng_np.standard_normal((lam, n))
            ary = arz @ (eigvecs @ np.diag(D)).T  # ary_i ~ N(0, C)
            arx = xmean + sigma * ary

        scored = []
        for i in range(lam):
            theta = _denormalize(arx[i])
            total, _bal, _pc, _rates = scalarized_objective(theta, num_runs=num_runs)
            evals_used += 1
            scored.append((total, i))
            if total < best_value:
                best_value = total
                best_theta = dict(theta)
            history.append((evals_used, best_value))

        scored.sort(key=lambda x: x[0])
        best_idx = [i for _val, i in scored[:mu]]

        with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
            xmean_new = np.sum(weights[:, None] * arx[best_idx], axis=0)
            y_w = (xmean_new - xmean) / sigma

            ps = (1 - cs) * ps + np.sqrt(cs * (2 - cs) * mueff) * (invsqrtC @ y_w)
            hsig = (np.linalg.norm(ps) / np.sqrt(1 - (1 - cs) ** (2 * (gen + 1))) / chiN) < (1.4 + 2 / (n + 1))
            pc = (1 - cc) * pc + hsig * np.sqrt(cc * (2 - cc) * mueff) * y_w

            artmp = (arx[best_idx] - xmean) / sigma
            C = ((1 - c1 - cmu) * C
                 + c1 * (np.outer(pc, pc) + (1 - hsig) * cc * (2 - cc) * C)
                 + cmu * (artmp.T * weights) @ artmp)
            sigma = sigma * np.exp((cs / damps) * (np.linalg.norm(ps) / chiN - 1))
            sigma = min(sigma, 1.0)  # normalized space is bounded [0,1]; cap runaway step size

        xmean = xmean_new

    return {"best_theta": best_theta, "best_value": best_value, "history": history,
            "evals_used": evals_used, "method": "cma_es"}


def _rbf_kernel(A: np.ndarray, B: np.ndarray, lengthscale: float, signal_var: float) -> np.ndarray:
    sq_dists = np.sum(A ** 2, axis=1)[:, None] + np.sum(B ** 2, axis=1)[None, :] - 2 * A @ B.T
    return signal_var * np.exp(-np.maximum(sq_dists, 0) / (2 * lengthscale ** 2))


def run_bayesian_optimization(budget: int, num_runs: int, seed: int):
    """Minimal GP-based Bayesian Optimization: RBF kernel with FIXED
    hyperparameters (lengthscale, signal/noise variance -- not fit by
    marginal-likelihood maximization; a real simplification, stated
    plainly rather than implied to be a tuned GP), Cholesky-based exact
    posterior (no scipy in this venv -- np.linalg.cholesky + np.linalg.solve
    only), Expected Improvement acquisition (src.surrogate.model_management.
    expected_improvement, reused rather than reimplemented) maximized over a
    random candidate pool each iteration."""
    rng = random.Random(seed)
    rng_np = np.random.default_rng(seed)
    n = _DIM
    lengthscale = float(np.sqrt(n) / 2)
    signal_var = 1.0
    noise_var = 1e-2
    n_candidates = 300

    n_init = max(5, min(budget // 3, 15))
    X_obs, y_obs = [], []
    history = []
    best_theta, best_value = None, float("inf")
    evals_used = 0

    for _ in range(n_init):
        theta = {k: rng.randint(low, high) for k, (low, high) in BOUNDS.items()}
        total, _bal, _pc, _rates = scalarized_objective(theta, num_runs=num_runs)
        evals_used += 1
        X_obs.append(_normalize(theta))
        y_obs.append(total)
        if total < best_value:
            best_value = total
            best_theta = dict(theta)
        history.append((evals_used, best_value))

    while evals_used < budget:
        X = np.array(X_obs)
        y = np.array(y_obs)
        with np.errstate(divide="ignore", over="ignore", invalid="ignore"):  # see module docstring's NUMERICAL NOTE
            K = _rbf_kernel(X, X, lengthscale, signal_var) + noise_var * np.eye(len(X))
            L = np.linalg.cholesky(K)
            alpha = np.linalg.solve(L.T, np.linalg.solve(L, y))

            candidates = rng_np.uniform(0.0, 1.0, size=(n_candidates, n))
            K_star = _rbf_kernel(candidates, X, lengthscale, signal_var)
            mu = K_star @ alpha
            v = np.linalg.solve(L, K_star.T)
            var = signal_var - np.sum(v ** 2, axis=0)
            sigma = np.sqrt(np.clip(var, 1e-12, None))

        ei = np.array([expected_improvement(mu[i], sigma[i], best_value, xi=0.5) for i in range(n_candidates)])
        chosen = candidates[int(np.argmax(ei))]

        theta = _denormalize(chosen)
        total, _bal, _pc, _rates = scalarized_objective(theta, num_runs=num_runs)
        evals_used += 1
        X_obs.append(_normalize(theta))
        y_obs.append(total)
        if total < best_value:
            best_value = total
            best_theta = dict(theta)
        history.append((evals_used, best_value))

    return {"best_theta": best_theta, "best_value": best_value, "history": history,
            "evals_used": evals_used, "method": "bayesian_optimization"}
