"""Fase 6: does the win-rate surrogate actually predict anything useful?

Review motivation: a prior "MAE 0.024" number for the MLP surrogate
(src/surrogate/mlp.py) has no runner script, no artifact, no baseline, and
no train/test protocol anywhere in this repository -- it cannot be traced
to anything real and must not be cited (CLAIMS_LEDGER.md "no row, no
claim"). This script builds the missing protocol from scratch:

1. DATASET, split BY DESIGN POINT, not by match. Every row is one distinct
   parameter vector Theta (a point in the 25-dim src.simulator.fitness.BOUNDS
   space); its label is an AGGREGATE win rate over NUM_RUNS_LABEL games per
   matchup (src.simulator.fitness.evaluate_chromosome). Train/test splits
   partition the LIST OF DISTINCT THETAS -- since each Theta already
   contributes exactly one row, this trivially cannot leak a Theta's games
   across the split boundary. See `leakage_demo()` below for a concrete,
   quantified demonstration of what goes wrong if you split at the
   individual-game ("match") level instead.
2. Three mandatory baselines (src.surrogate.baselines): a constant
   predictor (w_hat=50.0), OLS linear regression, and gradient boosting.
   If the MLP ensemble does not beat the constant predictor by a
   bootstrap-significant MAE margin, the whole surrogate contribution is
   vacuous -- report that plainly if it happens, don't bury it.
3. MAE / RMSE / R^2 for every model, on both an in-distribution (ID) test
   set and an out-of-distribution (OOD) test set (trained ONLY on a narrow
   Gaussian neighborhood of SMART_START; OOD points are sampled uniformly
   across the FULL src.simulator.fitness.BOUNDS range, which is
   substantially wider -- quantified via per-dimension standardized
   distance from the training distribution, not just asserted).
4. A calibration / reliability diagram for the deep ensemble's sigma_hat
   (src.surrogate.ensemble.MLPEnsemble), both ID and OOD, using the
   standard CDF-calibration check (Kuleshov, Fenner & Ermon, ICML 2018):
   for confidence level p, what fraction of true values fall at or below
   the model's p-quantile prediction? Well-calibrated -> close to the
   diagonal.

Run: venv/bin/python experiments/exp06_surrogate_validation.py
Artifacts: results/exp06_surrogate_validation.json,
           figures/surrogate_calibration.png,
           figures/surrogate_baseline_comparison.png
"""
from __future__ import annotations

import json
import random as pyrandom
import sys
from pathlib import Path
from statistics import NormalDist

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.optim.ga import generate_random_chromosome
from src.simulator.fitness import BOUNDS, SMART_START, evaluate_chromosome
from src.surrogate.baselines import ConstantPredictor, GradientBoostingBaseline, LinearRegressionBaseline
from src.surrogate.ensemble import MLPEnsemble
from src.surrogate.mlp import dict_to_array

ROOT = Path(__file__).resolve().parent.parent
_STD_NORMAL = NormalDist(0.0, 1.0)

# --- design of experiment ---
N_ID_TOTAL = 380      # distinct narrow-range Theta's; split 300 train / 80 ID-test
N_ID_TRAIN = 300
N_OOD_TEST = 80        # distinct Theta's sampled uniformly across the FULL BOUNDS range
NUM_RUNS_LABEL = 150   # games/matchup per design point (matches exp00's established precedent)
NARROW_SCALE = 0.08    # gaussian perturbation scale around SMART_START, as fraction of (high-low)
BASE_SEED = 20260801

MATCHUPS = ["SATWIKA_vs_TAMASIKA", "TAMASIKA_vs_RAJASIKA", "RAJASIKA_vs_SATWIKA"]


def generate_perturbed_position(rng: pyrandom.Random, scale: float) -> dict:
    pos = {}
    for key, (low, high) in BOUNDS.items():
        perturb = int(rng.gauss(0, (high - low) * scale))
        pos[key] = max(low, min(high, SMART_START[key] + perturb))
    return pos


def label_point(chromo: dict, num_runs: int, seed: int):
    pyrandom.seed(seed)  # src.simulator.fitness uses the global `random` module
    _loss, rates = evaluate_chromosome(chromo, num_runs=num_runs)
    return np.array([rates[m] for m in MATCHUPS])


def build_dataset(chromos: list, num_runs: int, seed_offset: int):
    X = np.array([dict_to_array(c) for c in chromos])
    y = np.array([label_point(c, num_runs, BASE_SEED + seed_offset + i) for i, c in enumerate(chromos)])
    return X, y


def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    err = y_pred - y_true
    mae = float(np.mean(np.abs(err)))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    ss_res = np.sum(err ** 2, axis=0)
    ss_tot = np.sum((y_true - y_true.mean(axis=0)) ** 2, axis=0)
    r2_per_output = np.where(ss_tot > 1e-9, 1.0 - ss_res / np.where(ss_tot > 1e-9, ss_tot, 1.0), np.nan)
    return {"mae": mae, "rmse": rmse, "r2_per_output": r2_per_output.tolist(),
            "r2_mean": float(np.nanmean(r2_per_output))}


def bootstrap_mae_diff_ci(errors_a: np.ndarray, errors_b: np.ndarray, n_boot: int = 3000, seed: int = 0):
    """95% percentile-bootstrap CI on mean(|errors_a|) - mean(|errors_b|),
    resampling TEST POINTS (rows) with replacement -- i.e. is model B's MAE
    significantly lower than model A's? If the CI excludes 0, yes."""
    rng = np.random.default_rng(seed)
    n = errors_a.shape[0]
    abs_a, abs_b = np.abs(errors_a), np.abs(errors_b)
    diffs = np.empty(n_boot)
    for i in range(n_boot):
        idx = rng.integers(0, n, size=n)
        diffs[i] = abs_a[idx].mean() - abs_b[idx].mean()
    lower, upper = np.percentile(diffs, [2.5, 97.5])
    return {"point_estimate": float(abs_a.mean() - abs_b.mean()), "ci95_lower": float(lower), "ci95_upper": float(upper),
            "significant": bool(lower > 0 or upper < 0)}


def reliability_curve(y_true: np.ndarray, mu: np.ndarray, sigma: np.ndarray, levels=None):
    """CDF calibration check (Kuleshov, Fenner & Ermon, ICML 2018): for each
    confidence level p, what fraction of (point, output-dim) pairs has
    y_true <= mu + sigma * Phi^-1(p)? Returns (levels, empirical_fractions)."""
    if levels is None:
        levels = np.linspace(0.05, 0.95, 19)
    sigma_safe = np.where(sigma > 1e-9, sigma, 1e-9)
    empirical = []
    for p in levels:
        z = _STD_NORMAL.inv_cdf(p)
        threshold = mu + sigma_safe * z
        empirical.append(float(np.mean(y_true <= threshold)))
    return levels.tolist(), empirical


def leakage_demo(seed: int = BASE_SEED + 99999) -> dict:
    """Concrete, quantified demonstration of the "split by match, not by
    design point" leakage failure mode (Fase 6 task 1). For N_POINTS
    distinct Theta's, collect 4 independent noisy replicate labels each
    (num_runs=REPLICATE_RUNS) plus one low-noise "ground truth" label
    (num_runs=TRUTH_RUNS, held out of BOTH training protocols, used only to
    score predictions honestly). Single matchup (SATWIKA_vs_TAMASIKA) to
    keep this sub-study small and fast.

    GOOD protocol: split the 100 THETAS 80/20; train on all 4 replicates of
    the 80 train-Thetas; predictions for the 20 held-out Thetas scored
    against THEIR ground truth (Thetas genuinely never seen in training).
    BAD protocol: pool all 400 replicate ROWS from all 100 Thetas (including
    the 20 nominally "held-out" ones) and take a random 320/80 ROW split,
    ignoring which Theta a row came from, then train on those 320 rows.

    The headline, apples-to-apples comparison: score BOTH protocols'
    fitted model on the EXACT SAME 20 held-out Thetas' ground truth. Any
    gap between them is caused by ONE thing only -- whether that Theta's
    OWN rows were allowed into training -- since both are scored against
    the identical low-noise target. (A second, secondary number -- what
    the BAD protocol would have naively self-reported using its own random
    test ROWS, scored against THEIR noisy same-replicate label -- is also
    reported, but is confounded by a different label-noise level than the
    truth-based numbers and should not be compared to them directly; see
    the printed caveat.)
    """
    N_POINTS = 100
    REPLICATE_RUNS = 40
    TRUTH_RUNS = 200
    rng = pyrandom.Random(seed)

    thetas = [generate_perturbed_position(rng, NARROW_SCALE) for _ in range(N_POINTS)]
    X_theta_raw = np.array([dict_to_array(t) for t in thetas])
    # Feature standardization only (no label information used) -- purely for
    # numerical conditioning of the closed-form lstsq fit below; some BOUNDS
    # dimensions have near-zero variance under NARROW_SCALE perturbation and
    # raw-scale lstsq on those columns is poorly conditioned.
    _mean, _std = X_theta_raw.mean(axis=0), X_theta_raw.std(axis=0)
    _std = np.where(_std > 1e-9, _std, 1.0)
    X_theta = (X_theta_raw - _mean) / _std

    replicate_y = np.zeros((N_POINTS, 4))
    truth_y = np.zeros(N_POINTS)
    for i, theta in enumerate(thetas):
        for r in range(4):
            pyrandom.seed(seed + i * 1000 + r)
            _loss, rates = evaluate_chromosome(theta, num_runs=REPLICATE_RUNS)
            replicate_y[i, r] = rates["SATWIKA_vs_TAMASIKA"]
        pyrandom.seed(seed + i * 1000 + 999)
        _loss, rates = evaluate_chromosome(theta, num_runs=TRUTH_RUNS)
        truth_y[i] = rates["SATWIKA_vs_TAMASIKA"]

    perm = rng.sample(range(N_POINTS), N_POINTS)
    train_ids, test_ids = perm[:80], perm[80:]

    def fit_linreg(X, y):
        X_design = np.hstack([X, np.ones((X.shape[0], 1))])
        coef, *_ = np.linalg.lstsq(X_design, y, rcond=None)
        return coef

    def predict_linreg(coef, X):
        X_design = np.hstack([X, np.ones((X.shape[0], 1))])
        # 9 of 25 BOUNDS dimensions have exactly zero variance under
        # NARROW_SCALE perturbation (their integer range is too small to move
        # under an 8% gaussian), making X_design rank-deficient (~17/26).
        # lstsq's minimum-norm solution and this matmul are both verified
        # finite/sane despite this (checked directly during development) --
        # BLAS raises a harmless floating-point flag on the rank-deficient
        # matmul that numpy surfaces as a RuntimeWarning; suppressed here
        # rather than left to alarm readers of the script's stdout.
        with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
            return X_design @ coef

    # GOOD: point-level split
    good_train_rows = [(i, r) for i in train_ids for r in range(4)]
    X_good_train = np.array([X_theta[i] for i, r in good_train_rows])
    y_good_train = np.array([replicate_y[i, r] for i, r in good_train_rows])
    coef_good = fit_linreg(X_good_train, y_good_train)
    pred_good = predict_linreg(coef_good, X_theta[test_ids])
    mae_good_true = float(np.mean(np.abs(pred_good - truth_y[test_ids])))

    # BAD: row-level (match-level) split, ignoring Theta grouping
    all_rows = [(i, r) for i in range(N_POINTS) for r in range(4)]
    row_rng = np.random.default_rng(seed)
    row_perm = row_rng.permutation(len(all_rows))
    n_train_rows = len(good_train_rows)  # same training-set size as GOOD, for a fair comparison
    bad_train_idx = row_perm[:n_train_rows]
    bad_test_idx = row_perm[n_train_rows:n_train_rows + (len(all_rows) - n_train_rows)]

    X_bad_train = np.array([X_theta[all_rows[k][0]] for k in bad_train_idx])
    y_bad_train = np.array([replicate_y[all_rows[k][0], all_rows[k][1]] for k in bad_train_idx])
    coef_bad = fit_linreg(X_bad_train, y_bad_train)

    # (1) what the naive practitioner would have self-reported:
    X_bad_test_rows = np.array([X_theta[all_rows[k][0]] for k in bad_test_idx])
    y_bad_test_rows = np.array([replicate_y[all_rows[k][0], all_rows[k][1]] for k in bad_test_idx])
    pred_bad_selfreport = predict_linreg(coef_bad, X_bad_test_rows)
    mae_bad_selfreported = float(np.mean(np.abs(pred_bad_selfreport - y_bad_test_rows)))

    # (2) honest generalization, on the SAME held-out Thetas GOOD used:
    pred_bad_honest = predict_linreg(coef_bad, X_theta[test_ids])
    mae_bad_honest_true = float(np.mean(np.abs(pred_bad_honest - truth_y[test_ids])))

    train_theta_overlap = len({all_rows[k][0] for k in bad_train_idx} & set(test_ids))

    return {
        "n_points": N_POINTS, "replicate_runs": REPLICATE_RUNS, "truth_runs": TRUTH_RUNS,
        # Headline, apples-to-apples: both scored against the SAME 20 held-out
        # Thetas' ground truth. The only thing that differs is whether those
        # Thetas' own rows were allowed into training.
        "good_protocol_mae_on_held_out_thetas": mae_good_true,
        "bad_protocol_mae_on_SAME_held_out_thetas": mae_bad_honest_true,
        "leakage_inflated_apparent_quality_by": mae_good_true - mae_bad_honest_true,
        "num_held_out_thetas_with_a_sibling_row_in_bad_training_set": train_theta_overlap,
        "num_held_out_thetas_total": len(test_ids),
        # Secondary, NOT directly comparable to the two numbers above (scored
        # against a noisy 40-game replicate label instead of the 200-game
        # truth label -- included only to show what a practitioner using
        # their own random split would have naively seen).
        "bad_protocol_naive_selfreported_mae_noisy_label": mae_bad_selfreported,
    }


def main():
    print("=== Fase 6: generating design-point dataset ===")
    rng = pyrandom.Random(BASE_SEED)

    id_chromos = [generate_perturbed_position(rng, NARROW_SCALE) for _ in range(N_ID_TOTAL)]
    print(f"  labeling {N_ID_TOTAL} in-distribution (narrow-range) design points, "
          f"num_runs={NUM_RUNS_LABEL}/matchup...")
    X_id, y_id = build_dataset(id_chromos, NUM_RUNS_LABEL, seed_offset=0)

    perm = rng.sample(range(N_ID_TOTAL), N_ID_TOTAL)
    train_idx, id_test_idx = perm[:N_ID_TRAIN], perm[N_ID_TRAIN:]
    X_train, y_train = X_id[train_idx], y_id[train_idx]
    X_id_test, y_id_test = X_id[id_test_idx], y_id[id_test_idx]

    ood_chromos = [generate_random_chromosome() for _ in range(N_OOD_TEST)]
    print(f"  labeling {N_OOD_TEST} out-of-distribution (full-BOUNDS-range) design points, "
          f"num_runs={NUM_RUNS_LABEL}/matchup...")
    X_ood, y_ood = build_dataset(ood_chromos, NUM_RUNS_LABEL, seed_offset=10**6)

    # Quantify "how OOD": mean per-dimension |z-score| of OOD points against the TRAIN distribution.
    train_mean, train_std = X_train.mean(axis=0), X_train.std(axis=0)
    train_std_safe = np.where(train_std > 1e-9, train_std, 1.0)
    ood_z = np.abs((X_ood - train_mean) / train_std_safe)
    id_test_z = np.abs((X_id_test - train_mean) / train_std_safe)
    print(f"  mean |z-score| from train distribution: ID-test={id_test_z.mean():.2f}, OOD-test={ood_z.mean():.2f}")

    X_mean, X_std = X_train.mean(axis=0), X_train.std(axis=0)
    X_std_safe = np.where(X_std > 1e-9, X_std, 1.0)
    X_train_norm = (X_train - X_mean) / X_std_safe
    X_id_test_norm = (X_id_test - X_mean) / X_std_safe
    X_ood_norm = (X_ood - X_mean) / X_std_safe

    print("\n=== Training models on ID-train ===")
    models = {
        "constant_0.5": ConstantPredictor(50.0).fit(X_train_norm, y_train),
        "linear_regression": LinearRegressionBaseline().fit(X_train_norm, y_train),
        "gradient_boosting": GradientBoostingBaseline(n_estimators=60, learning_rate=0.1, max_depth=3).fit(X_train_norm, y_train),
    }
    ensemble = MLPEnsemble(num_models=5, seed=BASE_SEED, input_dim=25, hidden_dim=16, output_dim=3)
    ensemble.fit(X_train_norm, y_train, epochs=2500, learning_rate=0.03, seed=BASE_SEED, verbose=True)

    results = {"id_test": {}, "ood_test": {}}
    errors_by_split = {"id_test": {}, "ood_test": {}}

    for split_name, X_norm, y_true in [("id_test", X_id_test_norm, y_id_test), ("ood_test", X_ood_norm, y_ood)]:
        print(f"\n--- {split_name} ---")
        for name, model in models.items():
            pred = model.predict(X_norm)
            m = metrics(y_true, pred)
            results[split_name][name] = m
            errors_by_split[split_name][name] = pred - y_true
            print(f"  {name:20} MAE={m['mae']:6.3f}  RMSE={m['rmse']:6.3f}  R2_mean={m['r2_mean']:6.3f}")

        mu, sigma = ensemble.predict_with_uncertainty(X_norm)
        m = metrics(y_true, mu)
        results[split_name]["mlp_ensemble"] = m
        errors_by_split[split_name]["mlp_ensemble"] = mu - y_true
        print(f"  {'mlp_ensemble':20} MAE={m['mae']:6.3f}  RMSE={m['rmse']:6.3f}  R2_mean={m['r2_mean']:6.3f}")

        levels, empirical = reliability_curve(y_true, mu, sigma)
        results[split_name]["calibration"] = {"levels": levels, "empirical_fractions": empirical,
                                               "mean_sigma": float(sigma.mean())}

    print("\n=== Does MLP ensemble beat the constant predictor? (bootstrap, 95% CI on MAE diff) ===")
    for split_name in ("id_test", "ood_test"):
        diff = bootstrap_mae_diff_ci(errors_by_split[split_name]["constant_0.5"], errors_by_split[split_name]["mlp_ensemble"], seed=BASE_SEED)
        results[split_name]["mlp_vs_constant_bootstrap"] = diff
        verdict = "SIGNIFICANT improvement" if diff["significant"] and diff["point_estimate"] > 0 else "NOT significant"
        print(f"  {split_name}: constant_MAE - mlp_MAE = {diff['point_estimate']:.3f} "
              f"(95% CI [{diff['ci95_lower']:.3f}, {diff['ci95_upper']:.3f}]) -> {verdict}")

    print("\n=== Leakage demonstration: split by design point vs. split by match ===")
    leak = leakage_demo()
    print(f"  Scored on the SAME 20 held-out Thetas' ground truth (apples-to-apples):")
    print(f"    GOOD (point-level split), Thetas genuinely never trained on: MAE={leak['good_protocol_mae_on_held_out_thetas']:.3f}")
    print(f"    BAD (match-level split), Thetas' OWN rows leaked into training: MAE={leak['bad_protocol_mae_on_SAME_held_out_thetas']:.3f}")
    print(f"    -> leakage made the bad protocol look {leak['leakage_inflated_apparent_quality_by']:.3f} MAE-points "
          f"better than it honestly is")
    print(f"  {leak['num_held_out_thetas_with_a_sibling_row_in_bad_training_set']}/{leak['num_held_out_thetas_total']} "
          f"'held-out' Thetas actually had a sibling row leak into the bad protocol's training set")
    print(f"  (secondary, noise-confounded, NOT comparable to the above: naive self-reported MAE using the bad "
          f"protocol's own random test rows scored against their own noisy label = "
          f"{leak['bad_protocol_naive_selfreported_mae_noisy_label']:.3f})")

    artifact = {
        "base_seed": BASE_SEED,
        "n_id_train": N_ID_TRAIN, "n_id_test": len(id_test_idx), "n_ood_test": N_OOD_TEST,
        "num_runs_label": NUM_RUNS_LABEL, "narrow_scale": NARROW_SCALE,
        "matchups": MATCHUPS,
        "ood_distance_from_train": {"id_test_mean_abs_zscore": float(id_test_z.mean()),
                                     "ood_test_mean_abs_zscore": float(ood_z.mean())},
        "results": results,
        "leakage_demo": leak,
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp06_surrogate_validation.json").write_text(json.dumps(artifact, indent=2))

    # --- figure 1: baseline comparison bar chart (MAE, ID vs OOD) ---
    model_names = ["constant_0.5", "linear_regression", "gradient_boosting", "mlp_ensemble"]
    fig, ax = plt.subplots(figsize=(8, 5))
    x = np.arange(len(model_names))
    width = 0.35
    id_maes = [results["id_test"][m]["mae"] for m in model_names]
    ood_maes = [results["ood_test"][m]["mae"] for m in model_names]
    ax.bar(x - width / 2, id_maes, width, label="ID test", color="#4C72B0")
    ax.bar(x + width / 2, ood_maes, width, label="OOD test", color="#C44E52")
    ax.set_xticks(x)
    ax.set_xticklabels(model_names, rotation=15)
    ax.set_ylabel("MAE (win-rate percentage points)")
    ax.set_title("Surrogate model comparison: MAE vs. mandatory baselines")
    ax.legend()
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "surrogate_baseline_comparison.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    # --- figure 2: reliability diagram, ID vs OOD ---
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.plot([0, 1], [0, 1], color="gray", linestyle="--", label="perfectly calibrated")
    ax.plot(results["id_test"]["calibration"]["levels"], results["id_test"]["calibration"]["empirical_fractions"],
            marker="o", color="#4C72B0", label="ID test")
    ax.plot(results["ood_test"]["calibration"]["levels"], results["ood_test"]["calibration"]["empirical_fractions"],
            marker="s", color="#C44E52", label="OOD test")
    ax.set_xlabel("Nominal quantile level p")
    ax.set_ylabel("Empirical fraction with y_true <= predicted p-quantile")
    ax.set_title("MLP ensemble calibration (reliability diagram)")
    ax.legend()
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    fig.tight_layout()
    fig.savefig(figures_dir / "surrogate_calibration.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp06_surrogate_validation.json")
    print("Figures:  figures/surrogate_baseline_comparison.png, figures/surrogate_calibration.png")


if __name__ == "__main__":
    main()
