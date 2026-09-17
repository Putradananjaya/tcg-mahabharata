"""Fase E9: constrained balancing under narrative-fidelity constraints
(docs/FASE_E9_SPEC.md). Answers RQ3: does a balanced equilibrium still
exist once the parameter space is restricted to Theta_lore (18 narrative
constraints, src.constraints.lore), and what does that restriction cost?

Two arms, identical NSGA-II configuration (pop_size=40, generations=40,
num_runs=60, validation_num_runs=500 -- copied verbatim from
results/exp07_nsga2_power_balance.json, per FASE_E9_SPEC.md section 0),
run across NUM_SEEDS=10 seeds each (Aturan Main Aturan 3: >=10 seeds for
any stochastic result, including optimizer run-to-run variance -- a single
seed, as an earlier version of this script used, is not a citable claim):

  - Arm A (unconstrained): src.optim.nsga2.run_nsga2_power_balance,
    UNCHANGED from Fase 7. At seed=20260801 specifically, checked
    byte-for-byte against results/exp07_nsga2_power_balance.json's
    pareto_front to confirm this pipeline is still fully deterministic.
  - Arm B (constrained): src.optim.nsga2.run_nsga2_lore_constrained, using
    Deb (2000) constraint-domination.

IMPORTANT interpretation note (human correction, 2026-09-17): Theta_lore is
a strict subset of Theta_full, so the THEORETICAL cost of lore fidelity
(min f1 over Theta_lore minus min f1 over Theta_full, at the true optima)
can never be negative. What this script reports as `empirical_cost_at_budget`
is the empirical difference between two FINITE-BUDGET heuristic searches,
which CAN be negative -- that would mean the unconstrained search simply
failed to find its own true optimum within this budget, not that the
constraint "saved" anything. Both numbers must be reported together; see
the `interpretation_note` field in the artifact and CLAIMS_LEDGER.md.

Run: venv/bin/python experiments/exp09_lore_constrained.py
Artifact: results/exp09_lore_constrained.json (this run);
          results/exp09_lore_constrained_singleseed_L4a.json (archived
          single-seed result under the original L4 formula, kept for
          record, not cited).
Figure:   figures/exp09_lore_constrained_pareto_front.png
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.constraints.lore import LORE_CONSTRAINTS, constraint_violations, feasibility_report
from src.metrics.hypervolume import hypervolume
from src.metrics.nonparametric import wilcoxon_signed_rank
from src.metrics.payoff_matrix import build_payoff_matrix
from src.optim.nsga2 import run_nsga2_lore_constrained, run_nsga2_power_balance
from src.simulator.determinism import seed_everything
from src.simulator.fitness import build_faction_decks, run_simulation_multi

ROOT = Path(__file__).resolve().parent.parent
POP_SIZE = 40
GENERATIONS = 40
NUM_RUNS = 60
VALIDATION_NUM_RUNS = 500
BASE_SEED = 20260801
NUM_SEEDS = 10
SEEDS = [BASE_SEED + i for i in range(NUM_SEEDS)]

N_MATCH = 20000  # payoff-matrix precision, see CLAIMS_LEDGER.md win-rate standard
FACTIONS = ["SATWIKA", "RAJASIKA", "TAMASIKA"]
F1_MATCHUPS = [("SATWIKA", "TAMASIKA"), ("TAMASIKA", "RAJASIKA"), ("RAJASIKA", "SATWIKA")]


def _silent(fn, *args, **kwargs):
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        return fn(*args, **kwargs)
    finally:
        sys.stdout = original_stdout


def mean_ci95(values: list) -> dict:
    """mean +/- 1.96*SEM across seeds -- same convention as
    experiments/exp07_optimizer_ablation.py's per-method summary."""
    arr = np.array(values, dtype=float)
    n = len(arr)
    mean = float(arr.mean())
    std = float(arr.std(ddof=1)) if n > 1 else 0.0
    sem = std / np.sqrt(n) if n > 1 else 0.0
    ci95 = 1.96 * sem
    return {
        "mean": mean, "std": std, "sem": sem,
        "ci95_lower": mean - ci95, "ci95_upper": mean + ci95,
        "n_seeds": n, "per_seed": arr.tolist(),
    }


def paired_analysis(unconstrained_values: list, constrained_values: list) -> dict:
    """Paired-by-seed comparison (human correction, 2026-09-17): independent
    per-arm CIs discard the pairing information (same seed drives both
    arms' NSGA-II runs), so report the mean paired difference + 95% CI
    alongside a Wilcoxon signed-rank test + rank-biserial effect size on
    the same pairs -- consistent with the paired-by-seed convention already
    used in experiments/exp07_optimizer_ablation.py.
    """
    diffs = [c - u for u, c in zip(unconstrained_values, constrained_values)]
    diff_stats = mean_ci95(diffs)
    wilcoxon = wilcoxon_signed_rank(unconstrained_values, constrained_values)
    return {
        "mean_diff_constrained_minus_unconstrained": diff_stats["mean"],
        "diff_ci95_lower": diff_stats["ci95_lower"], "diff_ci95_upper": diff_stats["ci95_upper"],
        "diff_std": diff_stats["std"], "diff_per_seed": diffs,
        "wilcoxon_n_pairs": wilcoxon.n_pairs, "wilcoxon_w_statistic": wilcoxon.w_statistic,
        "wilcoxon_z": wilcoxon.z, "wilcoxon_p_value": wilcoxon.p_value,
        "rank_biserial_r": wilcoxon.rank_biserial_r,
    }


def build_full_payoff_matrix(theta: dict, base_seed: int):
    """Same pattern as experiments/exp03_balance_matrix.py: n=N_MATCH/cell,
    with the mirror-match name-collision workaround (rules_spec.md 4.5)."""
    satwika, rajasika, tamasika = build_faction_decks(theta)
    deck_by_name = {"SATWIKA": satwika, "RAJASIKA": rajasika, "TAMASIKA": tamasika}

    def play_match_fn(row, col, seed):
        seed_everything(seed)
        label_row, label_col = (f"{row}__A", f"{col}__B") if row == col else (row, col)
        winner, _turn, _log_row, _log_col = run_simulation_multi(
            deck_by_name[row], deck_by_name[col], label_row, label_col
        )
        return 1 if winner == label_row else 0

    return _silent(build_payoff_matrix, FACTIONS, play_match_fn, N_MATCH, base_seed=base_seed)


def matrix_to_dict(matrix):
    return {
        f"{r}_vs_{c}": {
            "wins": matrix.cell(r, c).wins, "n": matrix.cell(r, c).n,
            "win_rate": matrix.cell(r, c).ci.p_hat,
            "wilson_ci_95": {"lower": matrix.cell(r, c).ci.lower, "upper": matrix.cell(r, c).ci.upper},
        }
        for r in FACTIONS for c in FACTIONS
    }


def feasibility_sampling_check(n_samples: int, seed: int) -> dict:
    """Acceptance criterion: reproduce the feasibility rate of Theta_lore
    within BOUNDS via uniform random sampling, in-repo, seed-controlled."""
    import random
    from src.simulator.fitness import BOUNDS

    rng = random.Random(seed)
    feasible_count = 0
    per_constraint_violations = {c.id: 0 for c in LORE_CONSTRAINTS}
    for _ in range(n_samples):
        theta = {k: rng.randint(low, high) for k, (low, high) in BOUNDS.items()}
        violations = constraint_violations(theta)
        any_violated = False
        for cid, g in violations.items():
            if g > 0:
                per_constraint_violations[cid] += 1
                any_violated = True
        if not any_violated:
            feasible_count += 1

    return {
        "n_samples": n_samples,
        "seed": seed,
        "feasible_count": feasible_count,
        "feasibility_rate_pct": feasible_count / n_samples * 100,
        "human_target_estimate_pct": 15.1,
        "human_target_tolerance_pct": 0.5,
        "per_constraint_violation_rate_pct": {
            cid: cnt / n_samples * 100 for cid, cnt in per_constraint_violations.items()
        },
    }


def binding_status(front: list) -> dict:
    """For each L1-L18: is it active (g_k == 0, i.e. tight) for at least
    one member of the constrained front?"""
    status = {}
    for c in LORE_CONSTRAINTS:
        values = [constraint_violations(p["params"])[c.id] for p in front]
        n_tight = sum(1 for v in values if v == 0)
        status[c.id] = {
            "binding": n_tight > 0,
            "n_tight_of_front": n_tight,
            "front_size": len(front),
            "min_g": min(values) if values else None,
        }
    return status


def make_comparison_figure(front_a: list, front_b: list, out_path: Path, seed: int):
    fig = plt.figure(figsize=(10, 8))
    ax = fig.add_subplot(111, projection="3d")

    for front, color, label in [(front_a, "tab:blue", "Unconstrained (Fase 7)"), (front_b, "tab:red", "Lore-constrained (Fase E9)")]:
        f1 = [p["f1_balance"] for p in front]
        f2 = [p["f2_power_creep"] for p in front]
        f3 = [p["f3_neg_identity"] for p in front]
        ax.scatter(f1, f2, f3, c=color, s=70, edgecolor="k", label=label, alpha=0.85)

    ax.set_xlabel("F1: Pairwise Balance Deviation")
    ax.set_ylabel("F2: Power Creep Penalty")
    ax.set_zlabel("F3: -Faction Identity Index")
    ax.set_title(f"Fase E9: Unconstrained vs. Lore-Constrained Pareto Fronts (seed={seed})\n(all axes: lower = better)")
    ax.legend()

    out_path.parent.mkdir(exist_ok=True)
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def main():
    print(f"=== Fase E9: lore-constrained balancing (RQ3), {NUM_SEEDS} seeds ===\n")

    print("Step 1/6: feasibility sampling check (400,000 samples)...")
    feasibility_check = feasibility_sampling_check(400_000, seed=BASE_SEED)
    print(f"  Feasibility rate: {feasibility_check['feasibility_rate_pct']:.4f}% "
          f"(human target: {feasibility_check['human_target_estimate_pct']}% "
          f"+/-{feasibility_check['human_target_tolerance_pct']}%)")

    fase7_reference = json.loads((ROOT / "results" / "exp07_nsga2_power_balance.json").read_text())["pareto_front"]

    def normalize(front):
        return sorted(
            [(tuple(sorted(p["params"].items())), p["f1_balance"], p["f2_power_creep"], p["f3_neg_identity"]) for p in front]
        )

    per_seed_records = []
    reproduction_matches = None

    for i, seed in enumerate(SEEDS):
        print(f"\nStep 2/6: seed {seed} ({i+1}/{NUM_SEEDS}) -- Arm A (unconstrained)...")
        arm_a_result = run_nsga2_power_balance(
            pop_size=POP_SIZE, generations=GENERATIONS, num_runs=NUM_RUNS,
            validation_num_runs=VALIDATION_NUM_RUNS, seed=seed,
        )
        arm_a_front = arm_a_result["pareto_front"]

        if seed == BASE_SEED:
            reproduction_matches = normalize(arm_a_front) == normalize(fase7_reference)
            print(f"  Arm A @ seed={seed} reproduces results/exp07_nsga2_power_balance.json exactly: {reproduction_matches}")
            if not reproduction_matches:
                print("  MISMATCH DETECTED. Stopping here rather than continuing on an unverified baseline.")
                sys.exit(1)

        print(f"Step 3/6: seed {seed} -- Arm B (lore-constrained)...")
        arm_b_result = run_nsga2_lore_constrained(
            pop_size=POP_SIZE, generations=GENERATIONS, num_runs=NUM_RUNS,
            validation_num_runs=VALIDATION_NUM_RUNS, seed=seed,
        )
        arm_b_front = arm_b_result["pareto_front"]

        all_feasible = all(p["is_feasible"] for p in arm_b_front)
        print(f"  seed={seed}: front sizes unconstrained={len(arm_a_front)}, constrained={len(arm_b_front)} "
              f"(all feasible: {all_feasible})")
        if not all_feasible:
            print("  VIOLATION: constrained front contains an infeasible solution -- stopping.")
            sys.exit(1)

        min_f1_a = min(p["f1_balance"] for p in arm_a_front)
        min_f1_b = min(p["f1_balance"] for p in arm_b_front)

        record = {
            "seed": seed,
            "arm_a_front": arm_a_front, "arm_a_history": arm_a_result["history"],
            "arm_a_elapsed_seconds": arm_a_result["elapsed_seconds"],
            "arm_b_front": arm_b_front, "arm_b_history": arm_b_result["history"],
            "arm_b_elapsed_seconds": arm_b_result["elapsed_seconds"],
            "arm_b_smart_start_feasible": arm_b_result["smart_start_feasible"],
            "arm_b_seeding_attempts": arm_b_result["seeding_attempts"],
            "min_f1_unconstrained": min_f1_a, "min_f1_constrained": min_f1_b,
            "front_size_unconstrained": len(arm_a_front), "front_size_constrained": len(arm_b_front),
        }
        per_seed_records.append(record)

    # --- Shared hypervolume reference point across all seeds x both arms ---
    print("\nStep 4/6: hypervolume (shared reference point across all seeds/arms)...")
    all_points = []
    for r in per_seed_records:
        all_points += [(p["f1_balance"], p["f2_power_creep"], p["f3_neg_identity"]) for p in r["arm_a_front"]]
        all_points += [(p["f1_balance"], p["f2_power_creep"], p["f3_neg_identity"]) for p in r["arm_b_front"]]
    ref_f1 = max(p[0] for p in all_points) * 1.1 or 1.0
    ref_f2 = max(p[1] for p in all_points) * 1.1 or 1.0
    ref_f3 = max(p[2] for p in all_points) + 0.05
    reference_point = (ref_f1, ref_f2, ref_f3)
    print(f"  reference_point = {reference_point}")

    for r in per_seed_records:
        pts_a = [(p["f1_balance"], p["f2_power_creep"], p["f3_neg_identity"]) for p in r["arm_a_front"]]
        pts_b = [(p["f1_balance"], p["f2_power_creep"], p["f3_neg_identity"]) for p in r["arm_b_front"]]
        r["hypervolume_unconstrained"] = hypervolume(pts_a, reference_point)
        r["hypervolume_constrained"] = hypervolume(pts_b, reference_point)

    # --- Across-seed summary statistics ---
    print("Step 5/6: across-seed summary statistics...")
    min_f1_u = [r["min_f1_unconstrained"] for r in per_seed_records]
    min_f1_c = [r["min_f1_constrained"] for r in per_seed_records]
    hv_u = [r["hypervolume_unconstrained"] for r in per_seed_records]
    hv_c = [r["hypervolume_constrained"] for r in per_seed_records]

    summary = {
        "min_f1_unconstrained": mean_ci95(min_f1_u),
        "min_f1_constrained": mean_ci95(min_f1_c),
        "hypervolume_unconstrained": mean_ci95(hv_u),
        "hypervolume_constrained": mean_ci95(hv_c),
        "front_size_unconstrained": mean_ci95([r["front_size_unconstrained"] for r in per_seed_records]),
        "front_size_constrained": mean_ci95([r["front_size_constrained"] for r in per_seed_records]),
        # Paired-by-seed comparisons (human correction 2026-09-17): independent
        # per-arm CIs above discard the pairing; these use the same seed's
        # two arms as a matched pair, plus Wilcoxon signed-rank + effect size.
        "empirical_cost_at_budget": paired_analysis(min_f1_u, min_f1_c),
        "hypervolume_paired_diff": paired_analysis(hv_u, hv_c),
    }
    print(f"  min f1 unconstrained: {summary['min_f1_unconstrained']['mean']:.2f} "
          f"[{summary['min_f1_unconstrained']['ci95_lower']:.2f}, {summary['min_f1_unconstrained']['ci95_upper']:.2f}]")
    print(f"  min f1 constrained:   {summary['min_f1_constrained']['mean']:.2f} "
          f"[{summary['min_f1_constrained']['ci95_lower']:.2f}, {summary['min_f1_constrained']['ci95_upper']:.2f}]")
    ecab = summary["empirical_cost_at_budget"]
    print(f"  empirical_cost_at_budget (paired, constrained - unconstrained): "
          f"{ecab['mean_diff_constrained_minus_unconstrained']:.2f} "
          f"[{ecab['diff_ci95_lower']:.2f}, {ecab['diff_ci95_upper']:.2f}]  "
          f"Wilcoxon p={ecab['wilcoxon_p_value']:.4f}  r={ecab['rank_biserial_r']:+.3f}")
    print(f"  hypervolume unconstrained: {summary['hypervolume_unconstrained']['mean']:.4f} "
          f"[{summary['hypervolume_unconstrained']['ci95_lower']:.4f}, {summary['hypervolume_unconstrained']['ci95_upper']:.4f}]")
    print(f"  hypervolume constrained:   {summary['hypervolume_constrained']['mean']:.4f} "
          f"[{summary['hypervolume_constrained']['ci95_lower']:.4f}, {summary['hypervolume_constrained']['ci95_upper']:.4f}]")
    hvp = summary["hypervolume_paired_diff"]
    print(f"  hypervolume paired diff (constrained - unconstrained): "
          f"{hvp['mean_diff_constrained_minus_unconstrained']:.4f} "
          f"[{hvp['diff_ci95_lower']:.4f}, {hvp['diff_ci95_upper']:.4f}]  "
          f"Wilcoxon p={hvp['wilcoxon_p_value']:.4f}  r={hvp['rank_biserial_r']:+.3f}")
    print(f"  front size unconstrained: {summary['front_size_unconstrained']['mean']:.1f} "
          f"[{summary['front_size_unconstrained']['ci95_lower']:.1f}, {summary['front_size_unconstrained']['ci95_upper']:.1f}]")
    print(f"  front size constrained:   {summary['front_size_constrained']['mean']:.1f} "
          f"[{summary['front_size_constrained']['ci95_lower']:.1f}, {summary['front_size_constrained']['ci95_upper']:.1f}]")

    interpretation_note = (
        "Theta_lore is a strict subset of Theta_full, so the THEORETICAL cost of lore "
        "fidelity (min f1 over Theta_lore minus min f1 over Theta_full, at the true optima) "
        "can never be negative. `empirical_cost_at_budget` above is the empirical, PAIRED-BY-SEED "
        "difference between two FINITE-BUDGET heuristic searches (NSGA-II, pop_size=40, "
        "generations=40) and CAN be negative -- a negative value means the unconstrained search "
        "failed to find its own true optimum within this budget (e.g. because constraint-domination "
        "acts as an implicit search-space regularizer for the constrained arm), not that satisfying "
        "the narrative constraints reduced the true achievable balance deviation. Report the mean "
        "paired difference, its 95% CI, AND the Wilcoxon signed-rank p-value/effect size together; "
        "do not describe a negative empirical value as lore fidelity being 'free' or 'a saving' "
        "without this caveat, and do not claim significance if the Wilcoxon test does not support it."
    )
    print(f"\n  INTERPRETATION NOTE: {interpretation_note}")

    # --- Detailed single-seed analysis at BASE_SEED (payoff matrices, binding status, etc.) ---
    print(f"\nStep 6/6: detailed analysis at seed={BASE_SEED} (payoff matrices, binding status)...")
    base_record = next(r for r in per_seed_records if r["seed"] == BASE_SEED)
    arm_a_front_base = base_record["arm_a_front"]
    arm_b_front_base = base_record["arm_b_front"]

    unconstrained_feasibility = [
        {"params_index": i, **feasibility_report(p["params"])} for i, p in enumerate(arm_a_front_base)
    ]
    n_unconstrained_feasible = sum(1 for r in unconstrained_feasibility if r["feasible"])

    binding = binding_status(arm_b_front_base)

    best_a = min(arm_a_front_base, key=lambda p: p["f1_balance"])
    best_b = min(arm_b_front_base, key=lambda p: p["f1_balance"])

    print(f"  Building n={N_MATCH}/cell payoff matrix for unconstrained best-balance solution...")
    matrix_a = build_full_payoff_matrix(best_a["params"], base_seed=BASE_SEED + 10**8)
    print(f"  Building n={N_MATCH}/cell payoff matrix for constrained best-balance solution...")
    matrix_b = build_full_payoff_matrix(best_b["params"], base_seed=BASE_SEED + 2 * 10**8)

    artifact = {
        "config": {
            "seeds": SEEDS, "pop_size": POP_SIZE, "generations": GENERATIONS,
            "num_runs": NUM_RUNS, "validation_num_runs": VALIDATION_NUM_RUNS,
            "n_match_payoff_matrix": N_MATCH,
        },
        "feasibility_sampling_check": feasibility_check,
        # Single shared reference point used for EVERY seed's and EVERY arm's
        # hypervolume computation (confirmed identical by construction: both
        # hv_a and hv_b above are computed from this same `reference_point`
        # variable inside the same loop iteration, never recomputed per-arm).
        "hypervolume_reference_point": list(reference_point),
        "hypervolume_reference_point_note": (
            "Derived from max(f1/f2/f3) across ALL 10 seeds x both arms' fronts, "
            "*1.1 margin (or +0.05 for f3, which is negative). This is why hypervolume "
            "values here (~30) are on a different scale from the earlier single-seed "
            "run's (~0.3): that run's reference point was computed from only 2 fronts "
            "(one seed, both arms), which never reached this run's worst-case f2_power_creep "
            "value -- verified directly by recomputing the OLD seed=20260801 unconstrained "
            "front's hypervolume under this NEW reference point: 30.82, matching this run's "
            "own per-seed value for that seed exactly. Not a normalization change."
        ),
        "per_seed": [
            {k: v for k, v in r.items() if k not in ("arm_a_front", "arm_b_front", "arm_a_history", "arm_b_history")}
            for r in per_seed_records
        ],
        "summary_across_seeds": summary,
        "interpretation_note": interpretation_note,
        "base_seed_detail": {
            "seed": BASE_SEED,
            "reproduces_fase7_exactly": reproduction_matches,
            "arm_a_front": arm_a_front_base,
            "arm_b_front": arm_b_front_base,
            "unconstrained_front_feasibility_under_theta_lore": {
                "n_feasible": n_unconstrained_feasible, "n_total": len(arm_a_front_base),
                "per_solution": unconstrained_feasibility,
            },
            "constraint_binding_status": binding,
            "best_balance_unconstrained": {"params": best_a["params"], "f1_balance": best_a["f1_balance"]},
            "best_balance_constrained": {"params": best_b["params"], "f1_balance": best_b["f1_balance"]},
            "payoff_matrix_best_balance_unconstrained": matrix_to_dict(matrix_a),
            "payoff_matrix_best_balance_constrained": matrix_to_dict(matrix_b),
        },
    }

    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp09_lore_constrained.json").write_text(json.dumps(artifact, indent=2))

    make_comparison_figure(arm_a_front_base, arm_b_front_base,
                            ROOT / "figures" / "exp09_lore_constrained_pareto_front.png", BASE_SEED)

    print("\nArtifact: results/exp09_lore_constrained.json")
    print("Figure:   figures/exp09_lore_constrained_pareto_front.png")


if __name__ == "__main__":
    main()
