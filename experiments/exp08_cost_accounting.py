"""Fase 8: honest cost accounting for the surrogate-assisted pipeline.

Review motivation: "94.2% speedup tidak menghitung biaya training
surrogate; klaim O(1) salah." A per-evaluation speedup that ignores the
one-time cost of generating the surrogate's training set and training it
is not the number a reader needs to decide whether the pipeline is
actually worth using -- that requires the AMORTIZED cost across however
many times the trained surrogate gets reused for a fresh re-balancing run
(a new GA/PSO search against it), which only pays off past a break-even
point that must be stated, not implied.

This script times four phases of the classic frozen-surrogate pipeline
(src.surrogate.mlp.run_surrogate_training's shape, reused conceptually,
not its print-heavy implementation) SEPARATELY:

    t_data_generation   -- real-simulator evaluations to build the training set
    t_surrogate_training -- fitting the MLP ensemble on that set
    t_optimization        -- GA search against the FROZEN, already-trained surrogate
    t_elite_verification  -- final real-simulator check of the GA's best candidate

...and compares TWO numbers, both real, neither hidden:

    (a) per-evaluation speedup: real-simulator evaluation time / surrogate
        evaluation time, measured directly, mid-optimization -- this is
        what a "94.2%" -style number usually measures, and it is real, but
        it is not the whole story.
    (b) amortized speedup + break-even point: cumulative cost of the
        surrogate pipeline (fixed setup cost once + optimize+verify cost
        per re-balancing run) vs. cumulative cost of pure Monte Carlo GA
        (src.optim.ga.run_ga_ablation, real simulator every evaluation,
        SAME budget) run N times -- the number of re-balancing runs needed
        before the surrogate pipeline's total cost drops below pure Monte
        Carlo's.

Run: venv/bin/python experiments/exp08_cost_accounting.py
Artifacts: results/exp08_cost_accounting.json,
           figures/exp08_breakeven_analysis.png
"""
from __future__ import annotations

import copy
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.optim.ga import crossover, generate_random_chromosome, mutate, run_ga_ablation
from src.simulator.fitness import evaluate_chromosome
from src.surrogate.ensemble import MLPEnsemble
from src.surrogate.mlp import dict_to_array

ROOT = Path(__file__).resolve().parent.parent
BASE_SEED = 20260801

# --- explicitly stated, auditable parameters (Fase 8 task 3) ---
POPULATION_SIZE = 12
N_GENERATIONS = 30
N_MATCH_PER_EVAL = 60      # games/matchup per real-simulator evaluation ("M" in the complexity note)
DATASET_SIZE = 200          # real-simulator design points used to train the surrogate
ENSEMBLE_EPOCHS = 2000
FINAL_VERIFICATION_N_MATCH = 2000  # games/matchup for the elite-verification step
N_REPETITIONS = 5           # independent repetitions for stable timing estimates
BREAK_EVEN_MAX_RUNS = 30    # x-axis range for the cumulative-cost plot


def _train_surrogate_pipeline(seed: int) -> dict:
    """One full run of the classic frozen-surrogate pipeline, phase-timed."""
    random.seed(seed)
    rng_np_seed = seed

    t0 = time.time()
    dataset_chromos = [generate_random_chromosome() for _ in range(DATASET_SIZE)]
    X_list, y_list = [], []
    for chromo in dataset_chromos:
        loss, rates = evaluate_chromosome(chromo, num_runs=N_MATCH_PER_EVAL)
        X_list.append(dict_to_array(chromo))
        y_list.append([rates["SATWIKA_vs_TAMASIKA"], rates["TAMASIKA_vs_RAJASIKA"], rates["RAJASIKA_vs_SATWIKA"]])
    t_data_generation = time.time() - t0

    X = np.array(X_list)
    y = np.array(y_list)
    X_mean, X_std = X.mean(axis=0), X.std(axis=0)
    X_std = np.where(X_std > 1e-9, X_std, 1.0)
    X_norm = (X - X_mean) / X_std

    t1 = time.time()
    ensemble = MLPEnsemble(num_models=5, seed=rng_np_seed, input_dim=25, hidden_dim=16, output_dim=3)
    ensemble.fit(X_norm, y, epochs=ENSEMBLE_EPOCHS, learning_rate=0.03, seed=rng_np_seed)
    t_surrogate_training = time.time() - t1

    def surrogate_loss(chromo):
        x_norm = (dict_to_array(chromo) - X_mean) / X_std
        mu, _sigma = ensemble.predict_with_uncertainty(x_norm.reshape(1, -1))
        pred = mu[0]
        return sum((pred[i] - 50.0) ** 2 for i in range(3))

    t2 = time.time()
    population = [generate_random_chromosome() for _ in range(POPULATION_SIZE)]
    population[0] = dataset_chromos[0]
    best_chromo, best_surrogate_loss = None, float("inf")
    per_eval_times = []
    for _gen in range(N_GENERATIONS):
        scored = []
        for chromo in population:
            te0 = time.time()
            loss = surrogate_loss(chromo)
            per_eval_times.append(time.time() - te0)
            scored.append((loss, chromo))
            if loss < best_surrogate_loss:
                best_surrogate_loss = loss
                best_chromo = copy.deepcopy(chromo)
        scored.sort(key=lambda x: x[0])
        new_pop = [copy.deepcopy(scored[0][1]), copy.deepcopy(scored[1][1])]
        while len(new_pop) < POPULATION_SIZE:
            p1 = random.sample(scored[:4], 1)[0][1]
            p2 = random.sample(scored[:4], 1)[0][1]
            c1, c2 = crossover(p1, p2)
            new_pop.append(mutate(c1))
            if len(new_pop) < POPULATION_SIZE:
                new_pop.append(mutate(c2))
        population = new_pop
    t_optimization = time.time() - t2

    t3 = time.time()
    final_loss, final_rates = evaluate_chromosome(best_chromo, num_runs=FINAL_VERIFICATION_N_MATCH)
    t_elite_verification = time.time() - t3

    return {
        "t_data_generation": t_data_generation, "t_surrogate_training": t_surrogate_training,
        "t_optimization": t_optimization, "t_elite_verification": t_elite_verification,
        "total": t_data_generation + t_surrogate_training + t_optimization + t_elite_verification,
        "mean_surrogate_eval_seconds": float(np.mean(per_eval_times)),
        "final_verified_loss": final_loss, "final_verified_rates": final_rates,
    }


def _pure_monte_carlo(seed: int) -> dict:
    """Same POPULATION_SIZE x N_GENERATIONS budget, every evaluation is a
    REAL simulator call (src.optim.ga.run_ga_ablation, Fase 7). Also
    times a handful of individual evaluate_chromosome calls directly, for
    the per-evaluation speedup number."""
    t0 = time.time()
    result = run_ga_ablation(budget=POPULATION_SIZE * N_GENERATIONS, num_runs=N_MATCH_PER_EVAL, seed=seed)
    t_total = time.time() - t0

    real_eval_times = []
    random.seed(seed + 999)
    for _ in range(20):
        chromo = generate_random_chromosome()
        te0 = time.time()
        evaluate_chromosome(chromo, num_runs=N_MATCH_PER_EVAL)
        real_eval_times.append(time.time() - te0)

    return {"t_total": t_total, "best_value": result["best_value"],
            "mean_real_eval_seconds": float(np.mean(real_eval_times))}


def main():
    print("=== Fase 8: honest cost accounting ===")
    print(f"Explicit parameters (Fase 8 task 3): population_size={POPULATION_SIZE}, "
          f"n_generations={N_GENERATIONS}, n_match_per_eval={N_MATCH_PER_EVAL}, "
          f"dataset_size={DATASET_SIZE}, final_verification_n_match={FINAL_VERIFICATION_N_MATCH}, "
          f"n_repetitions={N_REPETITIONS}")

    surrogate_runs, mc_runs = [], []
    for rep in range(N_REPETITIONS):
        seed = BASE_SEED + rep
        print(f"\n--- repetition {rep} (seed={seed}) ---")
        s = _train_surrogate_pipeline(seed)
        print(f"  surrogate pipeline: t_data_gen={s['t_data_generation']:.2f}s  "
              f"t_train={s['t_surrogate_training']:.2f}s  t_optimize={s['t_optimization']:.2f}s  "
              f"t_verify={s['t_elite_verification']:.2f}s  total={s['total']:.2f}s")
        surrogate_runs.append(s)

        m = _pure_monte_carlo(seed)
        print(f"  pure Monte Carlo:   t_total={m['t_total']:.2f}s  best_value={m['best_value']:.2f}")
        mc_runs.append(m)

    def agg(key, runs):
        vals = np.array([r[key] for r in runs])
        return {"mean": float(vals.mean()), "std": float(vals.std(ddof=1)) if len(vals) > 1 else 0.0}

    surrogate_summary = {k: agg(k, surrogate_runs) for k in
                          ["t_data_generation", "t_surrogate_training", "t_optimization",
                           "t_elite_verification", "total", "mean_surrogate_eval_seconds"]}
    mc_summary = {k: agg(k, mc_runs) for k in ["t_total", "mean_real_eval_seconds"]}

    # --- (a) per-evaluation speedup ---
    per_eval_speedup = mc_summary["mean_real_eval_seconds"]["mean"] / surrogate_summary["mean_surrogate_eval_seconds"]["mean"]
    print(f"\n=== (a) Per-evaluation speedup ===")
    print(f"  mean real-simulator eval: {mc_summary['mean_real_eval_seconds']['mean']*1000:.3f} ms "
          f"(n_match_per_eval={N_MATCH_PER_EVAL})")
    print(f"  mean surrogate eval:      {surrogate_summary['mean_surrogate_eval_seconds']['mean']*1000:.3f} ms")
    print(f"  per-evaluation speedup:   {per_eval_speedup:.1f}x")

    # --- (b) amortized speedup + break-even ---
    fixed_cost = surrogate_summary["t_data_generation"]["mean"] + surrogate_summary["t_surrogate_training"]["mean"]
    per_run_cost_surrogate = surrogate_summary["t_optimization"]["mean"] + surrogate_summary["t_elite_verification"]["mean"]
    per_run_cost_mc = mc_summary["t_total"]["mean"]

    print(f"\n=== (b) Amortized cost + break-even ===")
    print(f"  fixed one-time setup cost (data_gen + train): {fixed_cost:.2f}s")
    print(f"  per-re-balancing-run cost, surrogate (optimize + verify): {per_run_cost_surrogate:.2f}s")
    print(f"  per-re-balancing-run cost, pure Monte Carlo: {per_run_cost_mc:.2f}s")

    if per_run_cost_mc > per_run_cost_surrogate:
        break_even_n = fixed_cost / (per_run_cost_mc - per_run_cost_surrogate)
        print(f"  BREAK-EVEN POINT: {break_even_n:.2f} re-balancing runs "
              f"(after this many runs, the surrogate pipeline's cumulative cost drops below pure Monte Carlo's)")
    else:
        break_even_n = float("inf")
        print(f"  NO BREAK-EVEN: per-run surrogate cost ({per_run_cost_surrogate:.2f}s) already exceeds "
              f"per-run Monte Carlo cost ({per_run_cost_mc:.2f}s) -- the surrogate pipeline NEVER amortizes "
              f"at this problem size/budget, no matter how many re-balancing runs are done")

    amortized_speedup_at_10_runs = (10 * per_run_cost_mc) / (fixed_cost + 10 * per_run_cost_surrogate)
    print(f"  amortized speedup at N=10 re-balancing runs: {amortized_speedup_at_10_runs:.2f}x")

    ns = np.arange(1, BREAK_EVEN_MAX_RUNS + 1)
    cumulative_surrogate = fixed_cost + ns * per_run_cost_surrogate
    cumulative_mc = ns * per_run_cost_mc

    artifact = {
        "base_seed": BASE_SEED, "n_repetitions": N_REPETITIONS,
        "parameters": {
            "population_size": POPULATION_SIZE, "n_generations": N_GENERATIONS,
            "n_match_per_eval": N_MATCH_PER_EVAL, "dataset_size": DATASET_SIZE,
            "ensemble_epochs": ENSEMBLE_EPOCHS, "final_verification_n_match": FINAL_VERIFICATION_N_MATCH,
        },
        "surrogate_pipeline": surrogate_summary,
        "pure_monte_carlo": mc_summary,
        "per_evaluation_speedup": per_eval_speedup,
        "fixed_setup_cost_seconds": fixed_cost,
        "per_run_cost_surrogate_seconds": per_run_cost_surrogate,
        "per_run_cost_monte_carlo_seconds": per_run_cost_mc,
        "break_even_num_runs": break_even_n,
        "amortized_speedup_at_10_runs": amortized_speedup_at_10_runs,
        "cumulative_cost_curve": {"n_runs": ns.tolist(), "surrogate_seconds": cumulative_surrogate.tolist(),
                                   "monte_carlo_seconds": cumulative_mc.tolist()},
        "raw_repetitions": {"surrogate": surrogate_runs, "monte_carlo": mc_runs},
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp08_cost_accounting.json").write_text(json.dumps(artifact, indent=2))

    # --- figure: cumulative cost vs number of re-balancing runs ---
    fig, ax = plt.subplots(figsize=(8, 5.5))
    ax.plot(ns, cumulative_mc, color="#C44E52", marker="o", markersize=3, label="Pure Monte Carlo (cumulative)")
    ax.plot(ns, cumulative_surrogate, color="#4C72B0", marker="o", markersize=3, label="Surrogate pipeline (cumulative)")
    if np.isfinite(break_even_n) and break_even_n <= BREAK_EVEN_MAX_RUNS:
        ax.axvline(break_even_n, color="gray", linestyle="--", linewidth=1)
        y_lo, y_hi = ax.get_ylim()
        ax.text(break_even_n + 0.3, y_lo + (y_hi - y_lo) * 0.08, f"break-even\nN*={break_even_n:.1f} runs",
                fontsize=8, color="dimgray", va="bottom")
    ax.set_xlabel("Number of re-balancing runs (N)")
    ax.set_ylabel("Cumulative wall-clock cost (seconds)")
    ax.set_title(f"Break-even analysis: surrogate pipeline vs. pure Monte Carlo\n"
                 f"pop_size={POPULATION_SIZE}, generations={N_GENERATIONS}, n_match/eval={N_MATCH_PER_EVAL}")
    ax.legend(loc="upper left", fontsize=9)
    fig.text(0.5, -0.03,
              f"Fixed one-time cost (data gen + surrogate training) = {fixed_cost:.2f}s. Per-run cost: "
              f"surrogate {per_run_cost_surrogate:.2f}s vs. Monte Carlo {per_run_cost_mc:.2f}s. "
              f"Per-evaluation speedup (marginal only) = {per_eval_speedup:.1f}x -- see results/exp08_cost_accounting.json.",
              ha="center", fontsize=7.5, wrap=True)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "exp08_breakeven_analysis.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp08_cost_accounting.json")
    print("Figure:   figures/exp08_breakeven_analysis.png")


if __name__ == "__main__":
    main()
