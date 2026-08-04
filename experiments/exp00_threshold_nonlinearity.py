"""Phase 1 diagnostic (not a paper claim): does the simulator show discrete
"survive N hits" threshold effects, or is win-rate vs HP a smooth/linear
function of the swept parameter? A perfectly linear curve would suggest the
combat model is too abstract (no real tactical granularity).

Reuses the exact sweep already implemented in
src/infrastructure/analysis/academic_tests.py::run_sensitivity_analysis
(rjs_karna_hp from 60 to 145, matchups TAMASIKA_vs_RAJASIKA and
RAJASIKA_vs_SATWIKA) but captures the raw win/loss counts instead of just a
plot, and reports a linearity diagnostic (R^2 of a straight-line fit) so the
"is it linear" question in Aturan Main Fase 1 has a real number attached to
it instead of an eyeballed plot.

Run: venv/bin/python experiments/exp00_threshold_nonlinearity.py
Artifact: results/exp00_threshold_nonlinearity.json
"""
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.metrics.winrate import wilson_ci
from src.simulator.determinism import seed_everything
from src.simulator.fitness import evaluate_chromosome

BASE_SEED = 20260801
NUM_RUNS = 150

BASE_PARAMS = {
    "stw_yudhistira_hp": 130, "stw_yudhistira_dmg": 32, "stw_yudhistira_dr": 20, "stw_yudhistira_heal": 25, "stw_yudhistira_cost_satwika": 1, "stw_yudhistira_cost_univ": 1,
    "stw_arjuna_hp": 110, "stw_arjuna_pasupati_dmg": 50, "stw_arjuna_pasupati_cost": 3,
    "rjs_balarama_hp": 70, "rjs_balarama_dmg": 38, "rjs_balarama_cost": 1,
    "rjs_karna_hp": 90, "rjs_karna_dmg": 60, "rjs_karna_recoil": 10, "rjs_karna_cost": 2,
    "tms_sengkuni_hp": 95, "tms_sengkuni_dmg": 35, "tms_sengkuni_mill": 2, "tms_sengkuni_cost_tamasika": 1, "tms_sengkuni_cost_univ": 1,
    "tms_duryodana_hp": 135, "tms_duryodana_angkara_dmg": 42, "tms_duryodana_scale_value": 5, "tms_duryodana_angkara_cost": 2,
}


def linear_r_squared(xs, ys):
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    ss_xy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    ss_xx = sum((x - mean_x) ** 2 for x in xs)
    ss_yy = sum((y - mean_y) ** 2 for y in ys)
    if ss_xx == 0 or ss_yy == 0:
        return None
    r = ss_xy / (ss_xx * ss_yy) ** 0.5
    return r ** 2


def main():
    seed_everything(BASE_SEED)

    hp_range = list(range(60, 145, 5))
    wr_tamasika_vs_rajasika = []
    wr_rajasika_vs_satwika = []
    ci_tamasika_vs_rajasika = []
    ci_rajasika_vs_satwika = []

    original_stdout = sys.stdout
    for hp in hp_range:
        params = BASE_PARAMS.copy()
        params["rjs_karna_hp"] = hp
        sys.stdout = io.StringIO()
        try:
            _, rates = evaluate_chromosome(params, num_runs=NUM_RUNS)
        finally:
            sys.stdout = original_stdout
        wr_tamasika_vs_rajasika.append(rates["TAMASIKA_vs_RAJASIKA"])
        wr_rajasika_vs_satwika.append(rates["RAJASIKA_vs_SATWIKA"])

        # evaluate_chromosome only returns the win-rate %, not the raw win
        # count -- recover it exactly (rate was computed as count/NUM_RUNS*100,
        # so round-tripping through round() is exact at this scale).
        wins_a = round(rates["TAMASIKA_vs_RAJASIKA"] / 100 * NUM_RUNS)
        wins_b = round(rates["RAJASIKA_vs_SATWIKA"] / 100 * NUM_RUNS)
        ci_a = wilson_ci(wins_a, NUM_RUNS)
        ci_b = wilson_ci(wins_b, NUM_RUNS)
        ci_tamasika_vs_rajasika.append({"wins": wins_a, "n": NUM_RUNS, "lower": ci_a.lower, "upper": ci_a.upper})
        ci_rajasika_vs_satwika.append({"wins": wins_b, "n": NUM_RUNS, "lower": ci_b.lower, "upper": ci_b.upper})

        print(f"  Karna HP {hp:<3} | Tamasika_vs_Rajasika={ci_a} | Rajasika_vs_Satwika={ci_b}")

    r2_a = linear_r_squared(hp_range, wr_tamasika_vs_rajasika)
    r2_b = linear_r_squared(hp_range, wr_rajasika_vs_satwika)

    # Second-difference magnitude: near-zero everywhere would indicate a
    # straight line; spikes indicate kinks/steps (threshold effects).
    def second_diffs(ys):
        return [ys[i + 1] - 2 * ys[i] + ys[i - 1] for i in range(1, len(ys) - 1)]

    artifact = {
        "seed": BASE_SEED,
        "num_runs_per_point": NUM_RUNS,
        "swept_param": "rjs_karna_hp",
        "hp_range": hp_range,
        "win_rate_tamasika_vs_rajasika": wr_tamasika_vs_rajasika,
        "win_rate_rajasika_vs_satwika": wr_rajasika_vs_satwika,
        "wilson_ci_95_tamasika_vs_rajasika": ci_tamasika_vs_rajasika,
        "wilson_ci_95_rajasika_vs_satwika": ci_rajasika_vs_satwika,
        "note": (
            f"n={NUM_RUNS}/point is far below N_MATCH=20000 (see "
            "results/exp01_sample_size.json) -- this is a Phase 1 diagnostic, "
            "not a paper-citable win rate, exactly because n is this small."
        ),
        "linear_fit_r_squared": {"tamasika_vs_rajasika": r2_a, "rajasika_vs_satwika": r2_b},
        "second_differences": {
            "tamasika_vs_rajasika": second_diffs(wr_tamasika_vs_rajasika),
            "rajasika_vs_satwika": second_diffs(wr_rajasika_vs_satwika),
        },
    }

    out_path = Path(__file__).resolve().parent.parent / "results" / "exp00_threshold_nonlinearity.json"
    out_path.parent.mkdir(exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2))
    print(f"\nR^2 (linear fit) Tamasika_vs_Rajasika : {r2_a:.4f}")
    print(f"R^2 (linear fit) Rajasika_vs_Satwika   : {r2_b:.4f}")
    print(f"Artifact written to {out_path}")


if __name__ == "__main__":
    main()
