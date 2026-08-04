"""Fase 7: genuine multi-objective optimization -- balance vs. power creep
vs. faction identity, as a real Pareto front (not a weighted-sum
scalarization).

Review motivation: "Pers. (4) adalah weighted-sum scalarization, bukan
multi-objective." src.optim.objective.scalarized_objective (Pers. 4,
formally defined this phase) collapses BalanceDeviation and
PowerCreepPenalty into one number via a single lambda -- useful for a fair
single-objective ablation (experiments/exp07_optimizer_ablation.py) but not
a real multi-objective treatment. This script runs
src.optim.nsga2.run_nsga2_power_balance instead: three objectives kept
SEPARATE (f1 = pairwise balance deviation, f2 = power creep penalty,
f3 = -Faction Identity Index), and reports the resulting Pareto front --
the actual trade-off surface between them, not one arbitrarily-weighted
point on it.

Run: venv/bin/python experiments/exp07_nsga2_power_balance.py
Artifacts: results/exp07_nsga2_power_balance.json,
           figures/nsga2_power_balance_pareto_front.png
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.optim.nsga2 import _plot_pareto_front_power_balance, run_nsga2_power_balance

ROOT = Path(__file__).resolve().parent.parent
POP_SIZE = 40
GENERATIONS = 40
NUM_RUNS = 60
VALIDATION_NUM_RUNS = 500
SEED = 20260801


def main():
    result = run_nsga2_power_balance(
        pop_size=POP_SIZE, generations=GENERATIONS, num_runs=NUM_RUNS,
        validation_num_runs=VALIDATION_NUM_RUNS, seed=SEED,
    )

    pareto_front = result["pareto_front"]
    print(f"\nFinal validated Pareto front: {len(pareto_front)} solutions")
    print(f"{'F1 (balance)':>14} {'F2 (power creep)':>18} {'F3 (-identity)':>16}   rates")
    for p in sorted(pareto_front, key=lambda x: x["f1_balance"]):
        print(f"{p['f1_balance']:14.2f} {p['f2_power_creep']:18.4f} {p['f3_neg_identity']:16.3f}   {p['rates']}")

    f1_range = (min(p["f1_balance"] for p in pareto_front), max(p["f1_balance"] for p in pareto_front))
    f2_range = (min(p["f2_power_creep"] for p in pareto_front), max(p["f2_power_creep"] for p in pareto_front))
    f3_range = (min(p["f3_neg_identity"] for p in pareto_front), max(p["f3_neg_identity"] for p in pareto_front))
    print(f"\nTrade-off ranges across the front: F1 in [{f1_range[0]:.2f}, {f1_range[1]:.2f}], "
          f"F2 in [{f2_range[0]:.4f}, {f2_range[1]:.4f}], F3 in [{f3_range[0]:.3f}, {f3_range[1]:.3f}]")

    artifact = {
        "pop_size": POP_SIZE, "generations": GENERATIONS, "num_runs": NUM_RUNS,
        "validation_num_runs": VALIDATION_NUM_RUNS, "seed": SEED,
        "pareto_front": pareto_front, "history": result["history"],
        "elapsed_seconds": result["elapsed_seconds"],
        "objective_ranges": {"f1_balance": f1_range, "f2_power_creep": f2_range, "f3_neg_identity": f3_range},
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp07_nsga2_power_balance.json").write_text(json.dumps(artifact, indent=2))

    _plot_pareto_front_power_balance(pareto_front, out_path=str(ROOT / "figures" / "nsga2_power_balance_pareto_front.png"))

    print("\nArtifact: results/exp07_nsga2_power_balance.json")
    print("Figure:   figures/nsga2_power_balance_pareto_front.png")


if __name__ == "__main__":
    main()
