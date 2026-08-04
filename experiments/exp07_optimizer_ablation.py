"""Fase 7: optimizer ablation -- does "hybrid GA+PSO" actually beat GA-only?

Review motivation: "klaim 'hybrid GA+PSO' tanpa ablasi tidak membuktikan
apa-apa." This script is the ablation. Six methods, ALL minimizing the
identical src.optim.objective.scalarized_objective (Pers. 4,
BalanceDeviation + lambda*PowerCreepPenalty), ALL given the SAME evaluation
BUDGET (not the same wall-clock time -- an evaluation is one
scalarized_objective call, num_runs games/matchup underneath; see each
optimizer module's `run_X_ablation(budget, num_runs, seed)`):

    ga_only, pso_only, hybrid_ga_pso, random_search, cma_es, bayesian_optimization

Per this phase's OWN acceptance criteria: if hybrid_ga_pso does not beat
ga_only by a Wilcoxon-signed-rank-significant margin, the "hybrid" framing
must be dropped from the paper's title/abstract. This script does not
assume that outcome -- it reports whatever the seeds say.

Run: venv/bin/python experiments/exp07_optimizer_ablation.py
Artifacts: results/exp07_optimizer_ablation.json,
           figures/exp07_convergence_curves.png,
           figures/exp07_final_value_comparison.png
"""
from __future__ import annotations

import json
import sys
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.metrics.nonparametric import wilcoxon_signed_rank
from src.optim.baselines import run_bayesian_optimization, run_cma_es, run_random_search
from src.optim.ga import run_ga_ablation
from src.optim.hybrid import run_hybrid_ablation
from src.optim.pso import run_pso_ablation

ROOT = Path(__file__).resolve().parent.parent
BASE_SEED = 20260801
NUM_SEEDS = 20          # >= 15 required by Fase 7 acceptance criteria
BUDGET = 300             # evaluation-count budget, identical across all methods
NUM_RUNS = 60            # games/matchup per evaluation

METHODS = {
    "ga_only": run_ga_ablation,
    "pso_only": run_pso_ablation,
    "hybrid_ga_pso": run_hybrid_ablation,
    "random_search": run_random_search,
    "cma_es": run_cma_es,
    "bayesian_optimization": run_bayesian_optimization,
}
METHOD_COLORS = {
    "ga_only": "#4C72B0", "pso_only": "#DD8452", "hybrid_ga_pso": "#55A868",
    "random_search": "#C44E52", "cma_es": "#8172B2", "bayesian_optimization": "#937860",
}


def main():
    print(f"=== Fase 7: optimizer ablation ({len(METHODS)} methods x {NUM_SEEDS} seeds x budget={BUDGET}) ===")
    results = {name: [] for name in METHODS}

    for name, runner in METHODS.items():
        print(f"\n--- {name} ---")
        for seed_idx in range(NUM_SEEDS):
            seed = BASE_SEED + seed_idx
            r = runner(budget=BUDGET, num_runs=NUM_RUNS, seed=seed)
            results[name].append(r)
        finals = [r["best_value"] for r in results[name]]
        evals = [r["evals_used"] for r in results[name]]
        print(f"    final value: mean={np.mean(finals):.2f}  std={np.std(finals):.2f}  "
              f"evals_used: min={min(evals)} max={max(evals)}")

    # --- mean +/- 95% CI (across seeds) per method ---
    summary = {}
    for name, runs in results.items():
        finals = np.array([r["best_value"] for r in runs])
        mean = float(finals.mean())
        sem = float(finals.std(ddof=1) / np.sqrt(NUM_SEEDS))
        ci95 = 1.96 * sem
        summary[name] = {
            "mean_final_value": mean, "std_final_value": float(finals.std(ddof=1)),
            "ci95_lower": mean - ci95, "ci95_upper": mean + ci95,
            "min_evals_used": min(r["evals_used"] for r in runs),
            "max_evals_used": max(r["evals_used"] for r in runs),
            "final_values_per_seed": finals.tolist(),
        }

    print(f"\n=== Mean final scalarized objective +/- 95% CI (lower = better), n={NUM_SEEDS} seeds ===")
    for name, s in sorted(summary.items(), key=lambda kv: kv[1]["mean_final_value"]):
        print(f"  {name:24} {s['mean_final_value']:9.2f}  [{s['ci95_lower']:9.2f}, {s['ci95_upper']:9.2f}]")

    # --- pairwise Wilcoxon signed-rank test + rank-biserial effect size ---
    print("\n=== Pairwise Wilcoxon signed-rank test (paired by seed), all %d method pairs ===" %
          len(list(combinations(METHODS, 2))))
    pairwise = {}
    for a, b in combinations(METHODS.keys(), 2):
        x = [r["best_value"] for r in results[a]]
        y = [r["best_value"] for r in results[b]]
        res = wilcoxon_signed_rank(x, y)
        key = f"{a}_vs_{b}"
        pairwise[key] = {
            "n_pairs": res.n_pairs, "w_statistic": res.w_statistic, "z": res.z,
            "p_value": res.p_value, "rank_biserial_r": res.rank_biserial_r,
            "a_mean": summary[a]["mean_final_value"], "b_mean": summary[b]["mean_final_value"],
        }
        sig = "SIGNIFICANT" if res.p_value < 0.05 else "not significant"
        better = a if summary[a]["mean_final_value"] < summary[b]["mean_final_value"] else b
        print(f"  {a:22} vs {b:22} p={res.p_value:.4f} r={res.rank_biserial_r:+.3f} "
              f"({sig}, lower mean: {better})")

    # --- Headline acceptance-criteria check: hybrid vs ga_only ---
    hybrid_vs_ga = pairwise["ga_only_vs_hybrid_ga_pso"]
    hybrid_better = summary["hybrid_ga_pso"]["mean_final_value"] < summary["ga_only"]["mean_final_value"]
    hybrid_significantly_better = hybrid_better and hybrid_vs_ga["p_value"] < 0.05
    print(f"\n=== ACCEPTANCE CRITERION: does hybrid_ga_pso beat ga_only significantly? ===")
    print(f"  hybrid mean={summary['hybrid_ga_pso']['mean_final_value']:.2f}  "
          f"ga_only mean={summary['ga_only']['mean_final_value']:.2f}")
    print(f"  p={hybrid_vs_ga['p_value']:.4f}  effect size r={hybrid_vs_ga['rank_biserial_r']:+.3f}")
    print(f"  VERDICT: {'YES -- hybrid claim supported' if hybrid_significantly_better else 'NO -- hybrid claim NOT supported by this ablation'}")

    # --- convergence curves: mean +/- 95% CI band per method, aligned on evals_used ---
    min_common_evals = min(s["min_evals_used"] for s in summary.values())
    checkpoints = np.arange(1, min_common_evals + 1)

    fig, ax = plt.subplots(figsize=(9, 6))
    convergence_summary = {}
    for name in METHODS:
        curves = np.array([[dict(results[name][s]["history"])[c] for c in checkpoints] for s in range(NUM_SEEDS)])
        mean_curve = curves.mean(axis=0)
        sem_curve = curves.std(axis=0, ddof=1) / np.sqrt(NUM_SEEDS)
        ci95_curve = 1.96 * sem_curve
        color = METHOD_COLORS[name]
        ax.plot(checkpoints, mean_curve, color=color, label=name, linewidth=1.8)
        ax.fill_between(checkpoints, mean_curve - ci95_curve, mean_curve + ci95_curve, color=color, alpha=0.15)
        convergence_summary[name] = {"checkpoints": checkpoints.tolist(), "mean": mean_curve.tolist(),
                                      "ci95_lower": (mean_curve - ci95_curve).tolist(),
                                      "ci95_upper": (mean_curve + ci95_curve).tolist()}
    ax.set_xlabel("Evaluations used (budget-aligned, not wall-clock time)")
    ax.set_ylabel("Best scalarized objective so far (lower = better)")
    ax.set_title(f"Convergence: mean +/- 95% CI across {NUM_SEEDS} seeds, budget={BUDGET}, num_runs={NUM_RUNS}/eval")
    ax.legend(loc="upper right", fontsize=8)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "exp07_convergence_curves.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    # --- final-value comparison bar chart with 95% CI error bars ---
    fig, ax = plt.subplots(figsize=(8, 5))
    ordered = sorted(summary.items(), key=lambda kv: kv[1]["mean_final_value"])
    names = [n for n, _ in ordered]
    means = [s["mean_final_value"] for _, s in ordered]
    errs = [s["mean_final_value"] - s["ci95_lower"] for _, s in ordered]
    colors = [METHOD_COLORS[n] for n in names]
    ax.bar(names, means, yerr=errs, capsize=4, color=colors)
    ax.set_ylabel("Mean final scalarized objective (lower = better)")
    ax.set_title(f"Final value by method, n={NUM_SEEDS} seeds, 95% CI (mean +/- 1.96*SEM)")
    plt.setp(ax.get_xticklabels(), rotation=20, ha="right")
    fig.tight_layout()
    fig.savefig(figures_dir / "exp07_final_value_comparison.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    artifact = {
        "base_seed": BASE_SEED, "num_seeds": NUM_SEEDS, "budget": BUDGET, "num_runs": NUM_RUNS,
        "methods": list(METHODS.keys()),
        "summary": summary,
        "pairwise_wilcoxon": pairwise,
        "acceptance_criterion_hybrid_vs_ga_only": {
            "hybrid_mean": summary["hybrid_ga_pso"]["mean_final_value"],
            "ga_only_mean": summary["ga_only"]["mean_final_value"],
            "p_value": hybrid_vs_ga["p_value"], "rank_biserial_r": hybrid_vs_ga["rank_biserial_r"],
            "hybrid_significantly_better": hybrid_significantly_better,
        },
        "convergence_curves": convergence_summary,
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp07_optimizer_ablation.json").write_text(json.dumps(artifact, indent=2))

    print("\nArtifact: results/exp07_optimizer_ablation.json")
    print("Figures:  figures/exp07_convergence_curves.png, figures/exp07_final_value_comparison.png")


if __name__ == "__main__":
    main()
