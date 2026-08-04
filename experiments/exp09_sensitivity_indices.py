"""Fase 9: global sensitivity analysis over the FULL 25-dimensional
parameter space -- which parameters actually control balance?

Review motivation: only one parameter (Karna HP) had ever been swept, a 1D
slice through a 25-dimensional space. This script runs Morris screening
(cheap) then Sobol indices (expensive, decomposes variance) over the SAME
scalar quantity of interest -- src.simulator.fitness.evaluate_chromosome's
pairwise balance-deviation loss -- and reports which parameters actually
drive it, with first-order (S1) vs. total-order (ST) indices distinguishing
"matters on its own" from "matters via interaction with other parameters."

METHODOLOGICAL CAVEAT, stated up front rather than glossed over: Sobol and
Morris both assume a DETERMINISTIC model function. evaluate_chromosome is a
stochastic Monte Carlo estimator (its loss is itself a noisy function of
num_runs games) -- some of the "unexplained" variance in these indices is
irreducible simulation noise, not a real interaction effect. num_runs=100
(vs. the N_MATCH=20000 win-rate standard) is used to keep total evaluations
tractable (Sobol alone needs num_samples*(d+2) evaluations); this trades
index precision for feasibility, and is why S1+interaction gaps here should
be read as "at least this large," not exact.

Run: venv/bin/python experiments/exp09_sensitivity_indices.py
Artifacts: results/exp09_sensitivity_indices.json,
           figures/exp09_sobol_morris_indices.png
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.sensitivity.morris import morris_elementary_effects
from src.sensitivity.sobol import sobol_indices
from src.simulator.fitness import BOUNDS, evaluate_chromosome

ROOT = Path(__file__).resolve().parent.parent
BASE_SEED = 20260801
NUM_RUNS_PER_EVAL = 100    # games/matchup per model_fn call -- see module docstring's caveat
SOBOL_NUM_SAMPLES = 150     # -> 150*(25+2) = 4050 model evaluations
MORRIS_NUM_TRAJECTORIES = 30  # -> 30*26 = 780 model evaluations
TOP_N_REPORT = 10


def balance_loss(theta: dict) -> float:
    loss, _rates = evaluate_chromosome(theta, num_runs=NUM_RUNS_PER_EVAL)
    return loss


def main():
    print("=== Fase 9: Morris screening (cheap) ===")
    print(f"num_trajectories={MORRIS_NUM_TRAJECTORIES}, num_runs_per_eval={NUM_RUNS_PER_EVAL}")
    t0 = time.time()
    morris = morris_elementary_effects(BOUNDS, balance_loss, num_trajectories=MORRIS_NUM_TRAJECTORIES,
                                        num_levels=4, seed=BASE_SEED)
    t_morris = time.time() - t0
    print(f"  {morris['num_evaluations']} evaluations in {t_morris:.1f}s")

    ranked_morris = sorted(morris["mu_star"].items(), key=lambda kv: -kv[1])
    print(f"\nTop {TOP_N_REPORT} parameters by Morris mu_star (overall influence):")
    for name, val in ranked_morris[:TOP_N_REPORT]:
        print(f"  {name:32} mu_star={val:8.2f}  sigma={morris['sigma'][name]:8.2f}")

    print("\n=== Fase 9: Sobol indices (expensive, decomposes variance) ===")
    print(f"num_samples={SOBOL_NUM_SAMPLES}, num_runs_per_eval={NUM_RUNS_PER_EVAL}")
    t0 = time.time()
    sobol = sobol_indices(BOUNDS, balance_loss, num_samples=SOBOL_NUM_SAMPLES, seed=BASE_SEED)
    t_sobol = time.time() - t0
    print(f"  {sobol['num_evaluations']} evaluations in {t_sobol:.1f}s")

    ranked_sobol = sorted(sobol["ST"].items(), key=lambda kv: -kv[1])
    print(f"\nTop {TOP_N_REPORT} parameters by Sobol total-order index ST (controls balance, incl. interactions):")
    print(f"{'parameter':32} {'S1':>8} {'ST':>8} {'ST-S1':>8}  (ST-S1 = interaction contribution)")
    for name, st_val in ranked_sobol[:TOP_N_REPORT]:
        s1_val = sobol["S1"][name]
        print(f"{name:32} {s1_val:8.3f} {st_val:8.3f} {st_val - s1_val:8.3f}  "
              f"(95% CI: S1 +/-{sobol['S1_conf'][name]:.3f}, ST +/-{sobol['ST_conf'][name]:.3f})")

    sum_s1 = sum(sobol["S1"].values())
    sum_st = sum(sobol["ST"].values())
    print(f"\nSum of S1 across all 25 parameters: {sum_s1:.3f} (1.0 would mean purely additive, no interactions)")
    print(f"Sum of ST across all 25 parameters: {sum_st:.3f} (>1.0 is expected when interactions exist -- "
          f"total-order indices overlap by construction)")

    artifact = {
        "base_seed": BASE_SEED, "num_runs_per_eval": NUM_RUNS_PER_EVAL,
        "morris": morris, "sobol": sobol,
        "morris_ranked": ranked_morris, "sobol_ranked_by_ST": ranked_sobol,
        "sum_S1": sum_s1, "sum_ST": sum_st,
        "wall_time_seconds": {"morris": t_morris, "sobol": t_sobol},
        "caveat": "num_runs_per_eval=100 is far below N_MATCH=20000; some unexplained variance in these "
                  "indices is irreducible simulation noise, not a real interaction effect -- see module docstring.",
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp09_sensitivity_indices.json").write_text(json.dumps(artifact, indent=2))

    # --- figure: top-N parameters, S1 vs ST side by side, + Morris mu_star for context ---
    top_names = [name for name, _ in ranked_sobol[:TOP_N_REPORT]]
    s1_vals = [sobol["S1"][n] for n in top_names]
    st_vals = [sobol["ST"][n] for n in top_names]
    s1_err = [sobol["S1_conf"][n] for n in top_names]
    st_err = [sobol["ST_conf"][n] for n in top_names]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5.5))
    x = np.arange(len(top_names))
    width = 0.38
    ax1.bar(x - width / 2, s1_vals, width, yerr=s1_err, capsize=3, label="S1 (first-order)", color="#4C72B0")
    ax1.bar(x + width / 2, st_vals, width, yerr=st_err, capsize=3, label="ST (total-order)", color="#C44E52")
    ax1.set_xticks(x)
    ax1.set_xticklabels(top_names, rotation=60, ha="right", fontsize=8)
    ax1.set_ylabel("Sobol index")
    ax1.set_title(f"Sobol indices, top {TOP_N_REPORT} parameters\n(n_samples={SOBOL_NUM_SAMPLES}, "
                  f"{sobol['num_evaluations']} evaluations)")
    ax1.legend(fontsize=8)
    ax1.axhline(0, color="gray", linewidth=0.5)

    morris_names = [n for n, _ in ranked_morris[:TOP_N_REPORT]]
    mu_star_vals = [morris["mu_star"][n] for n in morris_names]
    sigma_vals = [morris["sigma"][n] for n in morris_names]
    ax2.scatter(mu_star_vals, sigma_vals, color="#55A868")
    for n, mx, my in zip(morris_names, mu_star_vals, sigma_vals):
        ax2.annotate(n, (mx, my), fontsize=6.5, xytext=(3, 3), textcoords="offset points")
    ax2.set_xlabel("mu* (overall influence)")
    ax2.set_ylabel("sigma (nonlinearity / interaction signal)")
    ax2.set_title(f"Morris screening, top {TOP_N_REPORT} by mu*\n"
                  f"(n_trajectories={MORRIS_NUM_TRAJECTORIES}, {morris['num_evaluations']} evaluations)")

    fig.suptitle("Which parameters actually control balance? (full 25-dim Theta, not a 1D slice)")
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "exp09_sobol_morris_indices.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp09_sensitivity_indices.json")
    print("Figure:   figures/exp09_sobol_morris_indices.png")


if __name__ == "__main__":
    main()
