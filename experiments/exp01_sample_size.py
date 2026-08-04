"""Fase 2: how many games (N_MATCH) does the paper need per reported win rate?

Generates one large real-simulator match pool (pool_size games, one seeded
run), then bootstrap-resamples it to get an *empirical* SE(n) curve across
n = 100..50,000, overlaid against the theoretical SE = sqrt(p_hat(1-p_hat)/n)
curve. Uses src/metrics/winrate.required_n to compute the sample size needed
to reliably detect a few candidate effect sizes (delta), and sets the
official N_MATCH for the whole paper from that.

This experiment characterizes sampling behavior, not faction balance -- it
deliberately runs only one representative matchup at one fixed parameter set
(SMART_START), so the pool stays cheap to generate. Do not cite the win rate
this produces as a balance result; cite N_MATCH and the SE curve.

Run: venv/bin/python experiments/exp01_sample_size.py
Artifacts: results/exp01_sample_size.json, figures/sample_size_justification.png
"""
import io
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt

from src.metrics.winrate import required_n, standard_error, wilson_ci
from src.simulator.determinism import seed_everything
from src.simulator.fitness import SMART_START, build_faction_decks, run_simulation

POOL_SIZE = 50000
BASE_SEED = 20260801
N_VALUES = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 35000, 50000]
BOOTSTRAP_RESAMPLES = 300
REQUIRED_N_TARGETS = [
    {"delta": 0.01, "alpha": 0.05, "power": 0.8},
    {"delta": 0.02, "alpha": 0.05, "power": 0.8},
    {"delta": 0.05, "alpha": 0.05, "power": 0.8},
]


def generate_pool(pool_size: int, base_seed: int) -> list:
    """Run SATWIKA_vs_TAMASIKA under SMART_START pool_size times, once,
    seeded. Returns a list of 1/0 outcomes (1 = SATWIKA won)."""
    seed_everything(base_seed)
    satwika, _rajasika, tamasika = build_faction_decks(SMART_START)

    outcomes = []
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        for _ in range(pool_size):
            outcomes.append(1 if run_simulation(satwika, tamasika, "SATWIKA", "TAMASIKA") == "SATWIKA" else 0)
    finally:
        sys.stdout = original_stdout
    return outcomes


def bootstrap_se(pool: list, n: int, resamples: int, rng: random.Random) -> float:
    """Empirical SE of the win-rate estimator at sample size n: resample n
    outcomes with replacement from the pool `resamples` times and take the
    std of the resulting win-rate estimates.

    With replacement throughout (including at n == len(pool)) so the
    procedure is a consistent bootstrap at every n -- note this means the
    n == pool_size point is a genuine bootstrap estimate, not "the exact
    pool win rate," and so still carries nonzero estimated SE, as it should.
    """
    rates = []
    for _ in range(resamples):
        sample = rng.choices(pool, k=n)
        rates.append(sum(sample) / n)
    mean_rate = sum(rates) / resamples
    var = sum((r - mean_rate) ** 2 for r in rates) / (resamples - 1)
    return var ** 0.5


def main():
    print(f"=== Generating pool: {POOL_SIZE} real SATWIKA_vs_TAMASIKA games (seed={BASE_SEED}) ===")
    pool = generate_pool(POOL_SIZE, BASE_SEED)
    pool_wins = sum(pool)
    p_hat = pool_wins / POOL_SIZE
    pool_ci = wilson_ci(pool_wins, POOL_SIZE)
    print(f"Pool result: {pool_ci}")

    bootstrap_rng = random.Random(BASE_SEED + 1)  # separate stream from pool generation
    empirical_se = []
    theoretical_se = []
    theoretical_se_worst_case = []
    for n in N_VALUES:
        emp = bootstrap_se(pool, n, BOOTSTRAP_RESAMPLES, bootstrap_rng)
        empirical_se.append(emp)
        theoretical_se.append(standard_error(n, p=p_hat))
        theoretical_se_worst_case.append(standard_error(n, p=0.5))
        print(f"  n={n:<6} empirical_SE={emp*100:.3f}%  theoretical_SE(p_hat)={theoretical_se[-1]*100:.3f}%  theoretical_SE(p=0.5)={theoretical_se_worst_case[-1]*100:.3f}%")

    required_n_results = []
    for target in REQUIRED_N_TARGETS:
        n_req = required_n(**target)
        required_n_results.append({**target, "required_n": n_req})
        print(f"  required_n(delta={target['delta']}, alpha={target['alpha']}, power={target['power']}) = {n_req}")

    # Official N_MATCH: the delta=0.01/alpha=0.05/power=0.8 target (the
    # "can we tell HP=95 from HP=94 apart" scenario from Aturan Main Fase 2),
    # rounded up to a clean number for use across all future experiments.
    n_match_raw = required_n(delta=0.01, alpha=0.05, power=0.8)
    n_match_official = 20000
    assert n_match_official >= n_match_raw, "N_MATCH must not be rounded below the computed requirement"

    artifact = {
        "pool": {
            "matchup": "SATWIKA_vs_TAMASIKA",
            "params": "SMART_START",
            "pool_size": POOL_SIZE,
            "base_seed": BASE_SEED,
            "wins": pool_wins,
            "p_hat": p_hat,
            "wilson_ci_95": {"lower": pool_ci.lower, "upper": pool_ci.upper},
        },
        "n_values": N_VALUES,
        "bootstrap_resamples_per_n": BOOTSTRAP_RESAMPLES,
        "empirical_se": empirical_se,
        "theoretical_se_p_hat": theoretical_se,
        "theoretical_se_worst_case_p_0.5": theoretical_se_worst_case,
        "required_n_targets": required_n_results,
        "N_MATCH_raw_required_n": n_match_raw,
        "N_MATCH_official": n_match_official,
        "N_MATCH_rationale": (
            f"required_n(delta=0.01, alpha=0.05, power=0.8) = {n_match_raw} "
            f"(rounded up to {n_match_official}). This is a genuine power "
            "calculation (detects a 1pp shift from 50% with 80% power at "
            "alpha=0.05), not a margin-of-error-only estimate -- see "
            "src/metrics/winrate.required_n docstring for why this is "
            "roughly 2x a naive z_alpha-only rule of thumb."
        ),
    }

    results_dir = Path(__file__).resolve().parent.parent / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp01_sample_size.json").write_text(json.dumps(artifact, indent=2))

    fig, ax = plt.subplots(figsize=(9, 6))
    ax.plot(N_VALUES, [se * 100 for se in empirical_se], "o-", label="Empirical SE (bootstrap, real simulator)", color="#1f77b4", linewidth=2)
    ax.plot(N_VALUES, [se * 100 for se in theoretical_se], "--", label=f"Theoretical SE = sqrt(p_hat(1-p_hat)/n), p_hat={p_hat:.3f}", color="#ff7f0e")
    ax.plot(N_VALUES, [se * 100 for se in theoretical_se_worst_case], ":", label="Theoretical SE, worst case p=0.5", color="#7f7f7f")
    ax.axvline(n_match_official, color="#2ca02c", linestyle="-", linewidth=2, label=f"N_MATCH = {n_match_official}")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("n (games per configuration)")
    ax.set_ylabel("Standard Error of win-rate estimate (%)")
    ax.set_title("Simulation budget justification: SE(n) for win-rate estimates")
    ax.grid(True, which="both", linestyle=":", alpha=0.5)
    ax.legend(loc="best", fontsize=9)
    caption = (
        f"N_MATCH = {n_match_official} games/configuration for all paper-reported win rates "
        f"(required_n(delta=0.01, alpha=0.05, power=0.8) = {n_match_raw}, rounded up). "
        f"Pool: {POOL_SIZE} real SATWIKA_vs_TAMASIKA games, seed={BASE_SEED}, bootstrap resamples={BOOTSTRAP_RESAMPLES}/n."
    )
    fig.text(0.5, -0.02, caption, ha="center", fontsize=8, wrap=True)
    fig.tight_layout()
    figures_dir = Path(__file__).resolve().parent.parent / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "sample_size_justification.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print(f"\nN_MATCH (official) = {n_match_official}  (raw required_n = {n_match_raw})")
    print("Artifact: results/exp01_sample_size.json")
    print("Figure:   figures/sample_size_justification.png")


if __name__ == "__main__":
    main()
