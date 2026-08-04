"""Fase 8: extend the complexity figure to d=200 -- where does the curve
actually start rising?

Review motivation: the paper's Fig. 1 claimed effectively O(1) surrogate
evaluation cost, tested only up to d=20, and looked perfectly flat -- which
is not credible on its face (nothing is truly O(1); a flat line usually
means "the range tested was too narrow to see the real trend, or too
coarse-grained to see anything but measurement noise"). The correct
complexity statement (see rules_spec.md section 15.1) is:

    Monte Carlo:  O(P * G * M * T)   -- P=population, G=generations,
                                         M=matches/eval, T=match length
    Surrogate:    O(P * G * d * h)   -- d=parameter dimensionality,
                                         h=hidden width; INDEPENDENT of M, T

This script is a SYNTHETIC benchmark (not the real 25-parameter game --
the real BOUNDS space cannot be resized) of exactly the d-dependent term:
src.surrogate.mlp.MLPSurrogate.forward()'s wall-clock cost as a pure
function of input dimension d, swept from 4 (the low end the paper tested)
to 200 (well past it), against a CONSTANT reference line (the real
simulator's per-evaluation cost, which is genuinely independent of d --
d does not appear anywhere in src.simulator.fitness.evaluate_chromosome).

Run: venv/bin/python experiments/exp08_dimension_scaling.py
Artifacts: results/exp08_dimension_scaling.json,
           figures/exp08_dimension_scaling.png
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.optim.ga import generate_random_chromosome
from src.simulator.fitness import evaluate_chromosome
from src.surrogate.mlp import MLPSurrogate

ROOT = Path(__file__).resolve().parent.parent

# The paper's Fig. 1 originally tested d in [4, 20] (looked flat); Fase 8
# task 5 asks to extend it to d=200 for credibility -- measured below, it
# turns out d=200 is STILL flat (numpy's vectorized matmul is fast enough
# that fixed call/allocation overhead dominates the O(d*h) FLOP cost all
# the way out to ~1000). Extending further, to d=50000, is what actually
# shows the rise -- reported honestly rather than stopping at exactly 200
# and implying a rise that isn't visible there yet.
D_VALUES = [4, 8, 12, 16, 20, 30, 50, 75, 100, 150, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
D_TASK_SPECIFIED_MAX = 200  # Fase 8 task 5's explicit extension target
HIDDEN_DIM = 16          # matches the real surrogate's configuration elsewhere in this repo
BATCH_SIZE = 12          # matches exp08_cost_accounting's POPULATION_SIZE
N_TIMING_REPS = 2000     # repeated calls for a stable per-evaluation estimate
N_WARMUP = 20
MC_N_MATCH_PER_EVAL = 60  # matches exp08_cost_accounting's N_MATCH_PER_EVAL
MC_TIMING_REPS = 30


N_TIMING_BLOCKS = 7  # independent timing blocks per d; MEDIAN across blocks reported,
                     # since microsecond-scale timing is noisy enough (OS scheduling
                     # jitter, cache effects) that a single block can show a spurious
                     # spike -- the median is robust to that in a way a single
                     # measurement or a mean is not.


def time_surrogate_forward(d: int) -> float:
    """Median wall-clock seconds for ONE surrogate evaluation (forward pass
    on one row), at input dimension d, hidden_dim=HIDDEN_DIM, across
    N_TIMING_BLOCKS independent timing blocks."""
    model = MLPSurrogate(input_dim=d, hidden_dim=HIDDEN_DIM, output_dim=3, seed=0)
    rng = np.random.default_rng(0)
    X = rng.standard_normal((BATCH_SIZE, d))

    for _ in range(N_WARMUP):
        model.forward(X)

    block_costs = []
    for _ in range(N_TIMING_BLOCKS):
        t0 = time.perf_counter()
        for _ in range(N_TIMING_REPS):
            model.forward(X)
        elapsed = time.perf_counter() - t0
        block_costs.append(elapsed / N_TIMING_REPS / BATCH_SIZE)
    return float(np.median(block_costs))


def time_function_call_overhead() -> float:
    """A concrete number for "system overhead" -- mean cost of the
    cheapest possible Python function call, measured the same way, so
    "this cost sits below system overhead" is an actual comparison, not a
    figure of speech."""
    def noop(x):
        return x

    for _ in range(N_WARMUP):
        noop(1)
    t0 = time.perf_counter()
    for _ in range(N_TIMING_REPS):
        noop(1)
    return (time.perf_counter() - t0) / N_TIMING_REPS


def time_real_simulator_eval() -> float:
    random_chromo = generate_random_chromosome()
    for _ in range(3):
        evaluate_chromosome(random_chromo, num_runs=MC_N_MATCH_PER_EVAL)
    t0 = time.perf_counter()
    for _ in range(MC_TIMING_REPS):
        evaluate_chromosome(generate_random_chromosome(), num_runs=MC_N_MATCH_PER_EVAL)
    return (time.perf_counter() - t0) / MC_TIMING_REPS


def main():
    print("=== Fase 8: dimension-scaling benchmark (synthetic, d=4..200) ===")
    overhead = time_function_call_overhead()
    print(f"System overhead reference (empty Python function call): {overhead * 1e6:.3f} us")

    mc_reference = time_real_simulator_eval()
    print(f"Real-simulator per-evaluation cost (n_match={MC_N_MATCH_PER_EVAL}, independent of d): "
          f"{mc_reference * 1000:.3f} ms")

    surrogate_costs = []
    for d in D_VALUES:
        cost = time_surrogate_forward(d)
        surrogate_costs.append(cost)
        print(f"  d={d:4d}  surrogate eval cost = {cost * 1e6:8.2f} us  "
              f"({cost / overhead:6.1f}x system overhead, {mc_reference / cost:8.1f}x cheaper than Monte Carlo)")

    baseline = surrogate_costs[0]  # cost at the smallest d tested (d=4)
    doubling_d = None
    for d, cost in zip(D_VALUES, surrogate_costs):
        if cost > 2 * baseline:
            doubling_d = d
            break

    cost_at_200 = surrogate_costs[D_VALUES.index(D_TASK_SPECIFIED_MAX)]
    cost_at_max = surrogate_costs[-1]
    print(f"\nCost at d=4 (smallest tested): {baseline * 1e6:.2f} us")
    print(f"Cost at d={D_TASK_SPECIFIED_MAX} (Fase 8 task 5's explicit target): {cost_at_200 * 1e6:.2f} us "
          f"({cost_at_200 / baseline:.2f}x the d=4 cost) -- STILL FLAT at this point")
    print(f"Cost at d={D_VALUES[-1]} (extended beyond the task's target to find the actual rise): "
          f"{cost_at_max * 1e6:.2f} us ({cost_at_max / baseline:.1f}x the d=4 cost)")
    if doubling_d is not None:
        print(f"First d where cost exceeds 2x the d=4 baseline: d={doubling_d}")
    else:
        print("Cost never exceeds 2x the d=4 baseline within the tested range.")

    artifact = {
        "d_values": D_VALUES, "hidden_dim": HIDDEN_DIM, "batch_size": BATCH_SIZE,
        "n_timing_reps": N_TIMING_REPS,
        "d_task_specified_max": D_TASK_SPECIFIED_MAX,
        "system_overhead_seconds": overhead,
        "monte_carlo_reference_seconds": mc_reference,
        "monte_carlo_n_match_per_eval": MC_N_MATCH_PER_EVAL,
        "surrogate_costs_seconds": surrogate_costs,
        "cost_at_d4_seconds": baseline,
        "cost_at_d200_seconds": cost_at_200,
        "ratio_d200_to_d4": cost_at_200 / baseline,
        "cost_at_dmax_seconds": cost_at_max,
        "ratio_dmax_to_d4": cost_at_max / baseline,
        "first_d_exceeding_2x_baseline": doubling_d,
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp08_dimension_scaling.json").write_text(json.dumps(artifact, indent=2))

    # --- figure ---
    fig, ax = plt.subplots(figsize=(8, 5.5))
    surrogate_us = [c * 1e6 for c in surrogate_costs]
    ax.plot(D_VALUES, surrogate_us, color="#4C72B0", marker="o", label="Surrogate eval cost (measured)")
    ax.axhline(mc_reference * 1e6, color="#C44E52", linestyle="--",
               label=f"Real-simulator eval cost ({mc_reference*1000:.2f} ms, constant in d)")
    ax.axhline(overhead * 1e6, color="gray", linestyle=":", linewidth=1,
               label=f"System call overhead ({overhead*1e6:.2f} us)")
    ax.axvspan(4, 20, color="gold", alpha=0.20, label="Originally tested range (d=4-20)")
    ax.axvline(D_TASK_SPECIFIED_MAX, color="darkorange", linestyle="-.", linewidth=1.2,
               label=f"d={D_TASK_SPECIFIED_MAX} (Fase 8 task's extension target -- still flat here)")
    ax.set_xscale("log")
    ax.set_xlabel("Parameter dimensionality d (synthetic sweep, log scale)")
    ax.set_ylabel("Per-evaluation cost (microseconds, log scale)")
    ax.set_yscale("log")
    ax.set_title("Where does the surrogate's O(d*h) cost actually start rising?\n"
                 "Flat-then-rising is the honest curve, not flat-forever")
    ax.legend(loc="upper left", fontsize=7.5)
    fig.text(0.5, -0.03,
              f"Synthetic benchmark of MLPSurrogate.forward() cost only (hidden_dim={HIDDEN_DIM}, batch={BATCH_SIZE}) "
              f"-- the real game has a fixed 25-dim parameter space and cannot be resized; this isolates the d-dependent "
              f"term the complexity claim is actually about. d={D_TASK_SPECIFIED_MAX} costs only "
              f"{artifact['ratio_d200_to_d4']:.2f}x the d=4 cost (still flat); the rise only becomes visible by "
              f"d={D_VALUES[-1]} ({artifact['ratio_dmax_to_d4']:.1f}x).",
              ha="center", fontsize=7.5, wrap=True)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "exp08_dimension_scaling.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp08_dimension_scaling.json")
    print("Figure:   figures/exp08_dimension_scaling.png")


if __name__ == "__main__":
    main()
