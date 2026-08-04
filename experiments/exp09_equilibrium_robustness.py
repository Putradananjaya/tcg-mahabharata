"""Fase 9: is the "golden equilibrium" unique or stable?

Review motivation: a single balanced parameter set (data/ga_balanced_params.json,
Theta*) was reported with no check on whether it's a sharp, isolated point
(fragile -- any small perturbation breaks balance) or sits in a broad,
robust region, and no check on whether other, DIFFERENT parameter sets
balance just as well (multiple equilibria). Two analyses:

1. BASIN OF ATTRACTION: perturb Theta* with Gaussian noise at increasing
   magnitudes (as a fraction of each parameter's BOUNDS range), re-measure
   balance at each magnitude, and plot how fast parity degrades -- both
   the mean pairwise deviation (with 95% CI band) and the fraction of
   perturbed samples still "balanced" (all 3 matchups within +/-10pp of
   50%) as a function of noise magnitude.
2. MULTI-START OPTIMIZATION: run the same GA (src.optim.ga.run_ga_ablation,
   Fase 7) from >=20 independent random starting populations. If they all
   converge to (approximately) the same region of parameter space, Theta*
   is the unique attractor found by this search. If they cluster into
   MULTIPLE distinct low-loss regions, that is a real finding (multiple
   viable equilibria) that must be reported, not hidden by only ever
   showing the best of many runs.

Run: venv/bin/python experiments/exp09_equilibrium_robustness.py
Artifacts: results/exp09_equilibrium_robustness.json,
           figures/exp09_basin_of_attraction.png,
           figures/exp09_multistart_clustering.png
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.metrics.winrate import wilson_ci
from src.optim.ga import run_ga_ablation
from src.simulator.fitness import BOUNDS, evaluate_chromosome

ROOT = Path(__file__).resolve().parent.parent
BASE_SEED = 20260801

# --- Part A: basin of attraction ---
NOISE_FRACTIONS = [0.0, 0.02, 0.05, 0.08, 0.12, 0.16, 0.20, 0.30, 0.40, 0.50]
SAMPLES_PER_NOISE_LEVEL = 25
BASIN_NUM_RUNS = 100         # games/matchup per perturbed-point evaluation
PARITY_BAND_PP = 10.0         # a matchup counts as "still balanced" within 50% +/- this many points

# --- Part B: multi-start optimization ---
NUM_STARTS = 24               # >= 20 required by Fase 9 acceptance criteria
MULTISTART_BUDGET = 300
MULTISTART_NUM_RUNS = 60
CLUSTER_DISTANCE_THRESHOLD = 0.12   # normalized RMS distance (see normalized_distance()) below which
                                     # two final Thetas are considered the "same" equilibrium. A stated,
                                     # not derived, choice -- roughly "differ by ~12% of BOUNDS range per
                                     # dimension on average"; the artifact also reports the raw pairwise
                                     # distance matrix so a reader can re-cluster at a different threshold.


def load_theta_star() -> dict:
    return json.loads((ROOT / "data" / "ga_balanced_params.json").read_text())


def perturb(theta: dict, sigma_fraction: float, rng: np.random.Generator) -> dict:
    out = {}
    for k, (low, high) in BOUNDS.items():
        span = high - low
        noise = rng.normal(0.0, sigma_fraction * span) if sigma_fraction > 0 else 0.0
        out[k] = int(max(low, min(high, round(theta[k] + noise))))
    return out


def is_balanced(rates: dict, band_pp: float = PARITY_BAND_PP) -> bool:
    return all(abs(wr - 50.0) <= band_pp for wr in rates.values())


def normalized_distance(theta_a: dict, theta_b: dict) -> float:
    diffs = []
    for k, (low, high) in BOUNDS.items():
        span = high - low
        diffs.append(((theta_a[k] - theta_b[k]) / span) ** 2)
    return float(np.sqrt(np.mean(diffs)))


def cluster_by_distance(thetas: list, threshold: float) -> list:
    """Union-Find connected-components clustering: any pair within
    `threshold` normalized distance is merged transitively (single-linkage
    with a hard cut). Returns a list of cluster-index per theta."""
    n = len(thetas)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for i in range(n):
        for j in range(i + 1, n):
            if normalized_distance(thetas[i], thetas[j]) < threshold:
                union(i, j)

    roots = [find(i) for i in range(n)]
    unique_roots = sorted(set(roots))
    root_to_cluster = {r: idx for idx, r in enumerate(unique_roots)}
    return [root_to_cluster[r] for r in roots]


def main():
    theta_star = load_theta_star()
    rng = np.random.default_rng(BASE_SEED)

    print("=== Fase 9 Part A: basin of attraction (Gaussian perturbation of Theta*) ===")
    basin_results = []
    for sigma_frac in NOISE_FRACTIONS:
        losses, balanced_flags = [], []
        for s in range(SAMPLES_PER_NOISE_LEVEL):
            theta = perturb(theta_star, sigma_frac, rng)
            loss, rates = evaluate_chromosome(theta, num_runs=BASIN_NUM_RUNS)
            losses.append(loss)
            balanced_flags.append(is_balanced(rates))
        losses = np.array(losses)
        mean_loss = float(losses.mean())
        sem = float(losses.std(ddof=1) / np.sqrt(SAMPLES_PER_NOISE_LEVEL)) if SAMPLES_PER_NOISE_LEVEL > 1 else 0.0
        ci95 = 1.96 * sem
        frac_balanced = float(np.mean(balanced_flags))
        basin_results.append({
            "sigma_fraction": sigma_frac, "mean_loss": mean_loss,
            "ci95_lower": max(0.0, mean_loss - ci95), "ci95_upper": mean_loss + ci95,
            "fraction_still_balanced": frac_balanced, "n_samples": SAMPLES_PER_NOISE_LEVEL,
        })
        print(f"  sigma={sigma_frac:.2f}  mean_loss={mean_loss:8.2f} [{max(0.0,mean_loss-ci95):.2f}, {mean_loss+ci95:.2f}]  "
              f"fraction_still_balanced={frac_balanced:.2f}")

    print("\n=== Fase 9 Part B: multi-start optimization (does search converge to one Theta*?) ===")
    print(f"num_starts={NUM_STARTS}, budget={MULTISTART_BUDGET}, num_runs={MULTISTART_NUM_RUNS}")
    final_thetas, final_losses = [], []
    for i in range(NUM_STARTS):
        seed = BASE_SEED + 10**6 + i
        r = run_ga_ablation(budget=MULTISTART_BUDGET, num_runs=MULTISTART_NUM_RUNS, seed=seed)
        final_thetas.append(r["best_theta"])
        final_losses.append(r["best_value"])
        print(f"  start {i:2d} (seed={seed}): final_value={r['best_value']:8.2f}")

    pairwise_distance_matrix = [[normalized_distance(a, b) for b in final_thetas] for a in final_thetas]

    cluster_ids = cluster_by_distance(final_thetas, CLUSTER_DISTANCE_THRESHOLD)
    num_clusters = len(set(cluster_ids))
    print(f"\nCluster threshold (normalized RMS distance): {CLUSTER_DISTANCE_THRESHOLD}")
    print(f"Number of distinct equilibria found: {num_clusters} (out of {NUM_STARTS} starts)")

    cluster_summary = {}
    for cid in set(cluster_ids):
        members = [i for i, c in enumerate(cluster_ids) if c == cid]
        member_losses = [final_losses[i] for i in members]
        cluster_summary[cid] = {"members": members, "size": len(members),
                                 "mean_loss": float(np.mean(member_losses)),
                                 "min_loss": float(np.min(member_losses))}
        print(f"  cluster {cid}: {len(members)} starts, mean_loss={np.mean(member_losses):.2f}, "
              f"min_loss={np.min(member_losses):.2f}")

    dist_to_theta_star = [normalized_distance(t, theta_star) for t in final_thetas]
    print(f"\nNormalized distance from each start's final Theta to the reference Theta* "
          f"(ga_balanced_params.json): mean={np.mean(dist_to_theta_star):.3f}, "
          f"min={np.min(dist_to_theta_star):.3f}, max={np.max(dist_to_theta_star):.3f}")

    artifact = {
        "base_seed": BASE_SEED,
        "part_a_basin_of_attraction": {
            "noise_fractions": NOISE_FRACTIONS, "samples_per_level": SAMPLES_PER_NOISE_LEVEL,
            "num_runs": BASIN_NUM_RUNS, "parity_band_pp": PARITY_BAND_PP, "results": basin_results,
        },
        "part_b_multistart": {
            "num_starts": NUM_STARTS, "budget": MULTISTART_BUDGET, "num_runs": MULTISTART_NUM_RUNS,
            "cluster_distance_threshold": CLUSTER_DISTANCE_THRESHOLD,
            "final_losses": final_losses, "cluster_ids": cluster_ids,
            "num_distinct_equilibria": num_clusters, "cluster_summary": cluster_summary,
            "distance_to_theta_star": dist_to_theta_star,
            "pairwise_distance_matrix": pairwise_distance_matrix,
        },
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp09_equilibrium_robustness.json").write_text(json.dumps(artifact, indent=2))

    # --- figure: basin of attraction (2 panels) ---
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    sigmas = [r["sigma_fraction"] for r in basin_results]
    means = [r["mean_loss"] for r in basin_results]
    lowers = [r["ci95_lower"] for r in basin_results]
    uppers = [r["ci95_upper"] for r in basin_results]
    ax1.plot(sigmas, means, color="#4C72B0", marker="o")
    ax1.fill_between(sigmas, lowers, uppers, color="#4C72B0", alpha=0.25, label="95% CI")
    ax1.set_xlabel("Gaussian noise magnitude (fraction of each parameter's range)")
    ax1.set_ylabel("Mean pairwise balance-deviation loss")
    ax1.set_title("Basin of attraction: balance degradation vs. perturbation")
    ax1.legend(fontsize=8)

    fracs = [r["fraction_still_balanced"] for r in basin_results]
    ax2.plot(sigmas, fracs, color="#55A868", marker="o")
    ax2.set_xlabel("Gaussian noise magnitude (fraction of each parameter's range)")
    ax2.set_ylabel(f"Fraction still balanced (all 3 matchups within 50%+/-{PARITY_BAND_PP:.0f}pp)")
    ax2.set_title("Fraction of perturbed points remaining balanced")
    ax2.set_ylim(-0.05, 1.05)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "exp09_basin_of_attraction.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    # --- figure: multi-start clustering (final loss per start, colored by cluster) ---
    fig, ax = plt.subplots(figsize=(9, 5.5))
    palette = plt.cm.tab10(np.linspace(0, 1, max(num_clusters, 1)))
    for cid in sorted(set(cluster_ids)):
        members = [i for i, c in enumerate(cluster_ids) if c == cid]
        ax.scatter(members, [final_losses[i] for i in members], color=palette[cid],
                   label=f"cluster {cid} (n={len(members)})", s=60)
    ax.set_xlabel("Multi-start run index")
    ax.set_ylabel("Final scalarized loss")
    ax.set_title(f"Multi-start optimization: {num_clusters} distinct equilibria found "
                 f"across {NUM_STARTS} independent starts")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(figures_dir / "exp09_multistart_clustering.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp09_equilibrium_robustness.json")
    print("Figures:  figures/exp09_basin_of_attraction.png, figures/exp09_multistart_clustering.png")


if __name__ == "__main__":
    main()
