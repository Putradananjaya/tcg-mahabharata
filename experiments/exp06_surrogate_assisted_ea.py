"""Fase 6: a surrogate-assisted EA with proper model management (Jin,
Swarm and Evolutionary Computation, 2011), contrasted against the OLD
frozen-surrogate GA pipeline (src.surrogate.mlp.run_surrogate_training)
that motivated this phase's review ("GA/PSO akan meng-exploit error
surrogate").

The old pipeline: train one surrogate once on a fixed sample, then run 100
GA generations purely against that FROZEN surrogate's point predictions,
checking the real simulator only once, at the very end. Nothing stops the
GA from steering into a region the surrogate is confidently WRONG about --
that is exactly what an evolutionary optimizer does to an error surface it
is allowed to exploit freely.

The new pipeline (src.surrogate.model_management.run_surrogate_assisted_ea):
candidates are ranked by an uncertainty-aware acquisition function (Expected
Improvement) computed from an MLPEnsemble's (mu, sigma_hat), and every few
generations the top elites are re-checked against the REAL simulator and
folded back into the training set (online retraining) -- see that module's
docstring for the full design and rules_spec.md section 13 for the write-up.

This script runs BOTH pipelines under a comparable real-simulator-evaluation
budget, reports the surrogate-to-truth gap over the course of the managed
run (the required "surrogate error vs generation" figure), and gives the
FINAL claim for each pipeline's best candidate as a real, num_runs_final-game
SIMULATOR VERIFICATION -- never a surrogate prediction (Fase 6 acceptance
criteria).

Run: venv/bin/python experiments/exp06_surrogate_assisted_ea.py
Artifacts: results/exp06_surrogate_assisted_ea.json,
           figures/surrogate_error_vs_generation.png
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt

from src.simulator.fitness import evaluate_chromosome
from src.surrogate.mlp import run_surrogate_training
from src.surrogate.model_management import run_surrogate_assisted_ea

ROOT = Path(__file__).resolve().parent.parent
BASE_SEED = 20260801

POP_SIZE = 30
GENERATIONS = 60
VALIDATE_EVERY = 3
TOP_M = 5
NUM_SEED_POINTS = 50
NUM_RUNS_SEED = 150
NUM_RUNS_REAL = 150
NUM_RUNS_FINAL = 20000  # N_MATCH -- see CLAIMS_LEDGER.md "Win-rate reporting standard"


def main():
    print("=== Fase 6: surrogate-assisted EA with model management (managed loop) ===")
    t0 = time.time()
    result = run_surrogate_assisted_ea(
        pop_size=POP_SIZE, generations=GENERATIONS, validate_every=VALIDATE_EVERY, top_m=TOP_M,
        num_seed_points=NUM_SEED_POINTS, num_runs_seed=NUM_RUNS_SEED, num_runs_real=NUM_RUNS_REAL,
        num_runs_final=NUM_RUNS_FINAL, acquisition="ei", xi=1.0, ensemble_size=5,
        ensemble_epochs=1200, ensemble_lr=0.03, seed=BASE_SEED, verbose=True,
    )
    elapsed_managed = time.time() - t0
    print(f"  managed loop: {result['num_real_evaluations']} real-simulator design points, "
          f"{elapsed_managed:.1f}s wall time")

    print("\n=== Fase 6: naive frozen-surrogate GA (legacy pipeline, for contrast) ===")
    print("  (src.surrogate.mlp.run_surrogate_training -- one surrogate fit, 100 GA "
          "generations against its FROZEN predictions, one real-simulator check at the end)")
    t0 = time.time()
    naive_best_chromo = run_surrogate_training(num_samples=NUM_SEED_POINTS)
    elapsed_naive = time.time() - t0
    naive_final_loss, naive_final_rates = evaluate_chromosome(naive_best_chromo, num_runs=NUM_RUNS_FINAL)
    print(f"  naive pipeline: {NUM_SEED_POINTS} real-simulator design points, {elapsed_naive:.1f}s wall time")

    print(f"\n=== FINAL CLAIM (real simulator verification, n={NUM_RUNS_FINAL} games/matchup -- "
          f"NOT a surrogate prediction) ===")
    print("Managed loop best candidate:")
    for k, v in result["final_verified_rates"].items():
        print(f"  {k}: {v:.2f}%")
    print(f"  loss={result['final_verified_loss']:.2f}")
    print("Naive frozen-surrogate GA best candidate:")
    for k, v in naive_final_rates.items():
        print(f"  {k}: {v:.2f}%")
    print(f"  loss={naive_final_loss:.2f}")

    validated = [h for h in result["history"] if h["validated"]]
    gens = [h["gen"] for h in validated]
    gaps = [h["surrogate_truth_gap_mean_abs"] for h in validated]
    f_best_curve = [h["f_best_true_so_far"] for h in validated]

    artifact = {
        "base_seed": BASE_SEED,
        "managed_loop": {
            "pop_size": POP_SIZE, "generations": GENERATIONS, "validate_every": VALIDATE_EVERY, "top_m": TOP_M,
            "num_seed_points": NUM_SEED_POINTS, "num_runs_seed": NUM_RUNS_SEED, "num_runs_real": NUM_RUNS_REAL,
            "acquisition": "ei", "num_real_evaluations": result["num_real_evaluations"],
            "wall_time_seconds": elapsed_managed,
            "best_chromo": result["best_chromo"],
            "final_verified_loss": result["final_verified_loss"],
            "final_verified_rates": result["final_verified_rates"],
            "final_verified_num_runs": NUM_RUNS_FINAL,
            "history": result["history"],
        },
        "naive_frozen_surrogate_ga": {
            "num_samples": NUM_SEED_POINTS, "wall_time_seconds": elapsed_naive,
            "best_chromo": naive_best_chromo,
            "final_verified_loss": naive_final_loss,
            "final_verified_rates": naive_final_rates,
            "final_verified_num_runs": NUM_RUNS_FINAL,
        },
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp06_surrogate_assisted_ea.json").write_text(json.dumps(artifact, indent=2))

    # --- required figure: surrogate error vs generation (+ optimization progress context) ---
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 8), sharex=True)

    ax1.plot(gens, gaps, marker="o", color="#C44E52")
    ax1.set_ylabel("Mean |surrogate mu_loss - true loss|\n(top-M elites, loss units)")
    ax1.set_title("Surrogate-to-truth gap vs. generation (online retraining every "
                   f"{VALIDATE_EVERY} generations)")
    ax1.axhline(0, color="gray", linestyle=":", linewidth=1)

    ax2.plot(gens, f_best_curve, marker="o", color="#4C72B0")
    ax2.set_xlabel("Generation")
    ax2.set_ylabel("Best TRUE loss found so far\n(real-simulator-verified, loss units)")
    ax2.set_title("Optimization progress (real-simulator-verified best-so-far)")

    fig.text(0.5, -0.02,
              f"Each marker = a validation checkpoint (every {VALIDATE_EVERY} generations): top-{TOP_M} "
              f"acquisition-ranked elites re-evaluated on the real simulator (n={NUM_RUNS_REAL} games/matchup) "
              f"and folded back into the training set before the next checkpoint. "
              f"Dataset size at each checkpoint is in results/exp06_surrogate_assisted_ea.json.",
              ha="center", fontsize=7.5, wrap=True)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "surrogate_error_vs_generation.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp06_surrogate_assisted_ea.json")
    print("Figure:   figures/surrogate_error_vs_generation.png")


if __name__ == "__main__":
    main()
