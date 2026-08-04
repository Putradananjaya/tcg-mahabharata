"""Fase 9: replace "Fig. 2" (the Karna-HP sweep) with a version that has
confidence bands, and investigate why the Satwika and Rajasika curves
were reported as nearly coincident.

Review motivation: the original figure plotted point estimates with no
uncertainty band, and reportedly showed Satwika's and Rajasika's curves
nearly overlapping as Karna HP is swept -- which is suspicious on its
face: these are described elsewhere in this project as very asymmetric
factions (rules_spec.md 1.3/9), so an apparently IDENTICAL response to a
single Rajasika-only stat buff would be an internal contradiction a
reviewer should catch. This script re-runs the sweep at real (n=300/point)
precision, computing Wilson 95% CIs for every curve, AND separates two
different things that could plausibly be labeled "Satwika's curve" /
"Rajasika's curve":

  (a) per-MATCHUP win rates: SATWIKA_vs_TAMASIKA (a control -- Karna does
      not appear in this matchup at all, so this curve MUST be flat in
      Karna HP, or something is wrong with the sweep), TAMASIKA_vs_RAJASIKA,
      RAJASIKA_vs_SATWIKA.
  (b) per-FACTION marginal win rates (mean win rate vs. the field): a
      faction's marginal is an average over ITS OWN matchups (e.g.
      Satwika's marginal = mean(SATWIKA_vs_TAMASIKA, 100-RAJASIKA_vs_SATWIKA)),
      which is where two different factions' curves CAN end up looking
      similar even though the underlying per-matchup mechanics are not
      symmetric -- averaging can manufacture a coincidence that isn't
      there in the raw matchup data. Reports which framing (if either)
      actually produces near-overlapping curves, rather than asserting one.

Sweeps rjs_karna_hp across its actual src.simulator.fitness.BOUNDS range
(70-110) -- NOT beyond it (the legacy experiments/exp00_threshold_nonlinearity.py
swept 60-145, which includes values outside what any optimizer could ever
produce) -- around data/ga_balanced_params.json as the baseline for every
other parameter (the "golden equilibrium" this whole phase is stress-testing,
not an arbitrary reference point).

Run: venv/bin/python experiments/exp09_karna_hp_ci.py
Artifacts: results/exp09_karna_hp_ci.json, figures/exp09_karna_hp_ci.png
"""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.metrics.winrate import wilson_ci
from src.simulator.fitness import BOUNDS, evaluate_chromosome

ROOT = Path(__file__).resolve().parent.parent
BASE_SEED = 20260801
NUM_RUNS = 300  # games/matchup/point -- real Wilson CIs, not a diagnostic-grade n
HP_STEP = 2


def main():
    theta_star = json.loads((ROOT / "data" / "ga_balanced_params.json").read_text())
    low, high = BOUNDS["rjs_karna_hp"]
    hp_range = list(range(low, high + 1, HP_STEP))
    print(f"=== Fase 9: Karna HP sweep with CI, range=[{low},{high}] step={HP_STEP}, n={NUM_RUNS}/point ===")

    matchup_curves = {"SATWIKA_vs_TAMASIKA": [], "TAMASIKA_vs_RAJASIKA": [], "RAJASIKA_vs_SATWIKA": []}
    matchup_ci = {k: [] for k in matchup_curves}
    marginal_curves = {"SATWIKA": [], "TAMASIKA": [], "RAJASIKA": []}

    for hp in hp_range:
        theta = copy.deepcopy(theta_star)
        theta["rjs_karna_hp"] = hp
        _loss, rates = evaluate_chromosome(theta, num_runs=NUM_RUNS)

        for label in matchup_curves:
            wr = rates[label]
            matchup_curves[label].append(wr)
            wins = round(wr / 100 * NUM_RUNS)
            ci = wilson_ci(wins, NUM_RUNS)
            matchup_ci[label].append({"lower": ci.lower * 100, "upper": ci.upper * 100})

        satwika_marginal = (rates["SATWIKA_vs_TAMASIKA"] + (100 - rates["RAJASIKA_vs_SATWIKA"])) / 2
        rajasika_marginal = (rates["RAJASIKA_vs_SATWIKA"] + (100 - rates["TAMASIKA_vs_RAJASIKA"])) / 2
        tamasika_marginal = (rates["TAMASIKA_vs_RAJASIKA"] + (100 - rates["SATWIKA_vs_TAMASIKA"])) / 2
        marginal_curves["SATWIKA"].append(satwika_marginal)
        marginal_curves["RAJASIKA"].append(rajasika_marginal)
        marginal_curves["TAMASIKA"].append(tamasika_marginal)

        print(f"  Karna HP {hp:3d} | SATWIKA_vs_TAMASIKA={rates['SATWIKA_vs_TAMASIKA']:5.1f}%  "
              f"TAMASIKA_vs_RAJASIKA={rates['TAMASIKA_vs_RAJASIKA']:5.1f}%  "
              f"RAJASIKA_vs_SATWIKA={rates['RAJASIKA_vs_SATWIKA']:5.1f}%  "
              f"| marginals S={satwika_marginal:5.1f} T={tamasika_marginal:5.1f} R={rajasika_marginal:5.1f}")

    # --- sanity check: SATWIKA_vs_TAMASIKA must be flat in Karna HP (control) ---
    control_vals = np.array(matchup_curves["SATWIKA_vs_TAMASIKA"])
    control_range_pp = float(control_vals.max() - control_vals.min())
    print(f"\nControl check: SATWIKA_vs_TAMASIKA range across the sweep = {control_range_pp:.2f}pp "
          f"(Karna doesn't appear in this matchup; should be small, driven only by RNG noise)")

    # --- investigate curve overlap ---
    def mean_abs_diff(a, b):
        return float(np.mean(np.abs(np.array(a) - np.array(b))))

    matchup_pairs_diff = {
        "TAMASIKA_vs_RAJASIKA__vs__RAJASIKA_vs_SATWIKA": mean_abs_diff(
            matchup_curves["TAMASIKA_vs_RAJASIKA"], matchup_curves["RAJASIKA_vs_SATWIKA"]),
    }
    marginal_pairs_diff = {
        "SATWIKA__vs__RAJASIKA": mean_abs_diff(marginal_curves["SATWIKA"], marginal_curves["RAJASIKA"]),
        "SATWIKA__vs__TAMASIKA": mean_abs_diff(marginal_curves["SATWIKA"], marginal_curves["TAMASIKA"]),
        "TAMASIKA__vs__RAJASIKA": mean_abs_diff(marginal_curves["TAMASIKA"], marginal_curves["RAJASIKA"]),
    }
    print("\nMean |difference| between curves, per-matchup framing:")
    for k, v in matchup_pairs_diff.items():
        print(f"  {k}: {v:.2f}pp")
    print("Mean |difference| between curves, per-faction-marginal framing:")
    for k, v in sorted(marginal_pairs_diff.items(), key=lambda kv: kv[1]):
        print(f"  {k}: {v:.2f}pp")

    closest_marginal_pair = min(marginal_pairs_diff.items(), key=lambda kv: kv[1])
    print(f"\nClosest-overlapping marginal pair: {closest_marginal_pair[0]} "
          f"(mean |diff| = {closest_marginal_pair[1]:.2f}pp)")

    artifact = {
        "base_seed": BASE_SEED, "num_runs": NUM_RUNS, "hp_range": hp_range,
        "params_source": "data/ga_balanced_params.json (baseline for all params except rjs_karna_hp)",
        "matchup_win_rates": matchup_curves, "matchup_wilson_ci_95": matchup_ci,
        "faction_marginal_win_rates": marginal_curves,
        "control_check_satwika_vs_tamasika_range_pp": control_range_pp,
        "matchup_pairs_mean_abs_diff_pp": matchup_pairs_diff,
        "marginal_pairs_mean_abs_diff_pp": marginal_pairs_diff,
        "closest_overlapping_marginal_pair": closest_marginal_pair,
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp09_karna_hp_ci.json").write_text(json.dumps(artifact, indent=2))

    # --- figure: 2 panels, per-matchup (with CI) and per-faction-marginal ---
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5.5))
    colors = {"SATWIKA_vs_TAMASIKA": "#4C72B0", "TAMASIKA_vs_RAJASIKA": "#DD8452", "RAJASIKA_vs_SATWIKA": "#C44E52"}
    for label, color in colors.items():
        vals = matchup_curves[label]
        lowers = [c["lower"] for c in matchup_ci[label]]
        uppers = [c["upper"] for c in matchup_ci[label]]
        ax1.plot(hp_range, vals, color=color, label=label, marker="o", markersize=3)
        ax1.fill_between(hp_range, lowers, uppers, color=color, alpha=0.2)
    ax1.axhline(50, color="gray", linestyle="--", linewidth=1)
    ax1.set_xlabel("Karna HP (rjs_karna_hp)")
    ax1.set_ylabel("Win rate (%)")
    ax1.set_title(f"Per-matchup win rate vs. Karna HP\n(n={NUM_RUNS}/point, Wilson 95% CI band)")
    ax1.legend(fontsize=7.5, loc="best")

    faction_colors = {"SATWIKA": "#4C72B0", "TAMASIKA": "#DD8452", "RAJASIKA": "#C44E52"}
    for faction, color in faction_colors.items():
        ax2.plot(hp_range, marginal_curves[faction], color=color, label=faction, marker="o", markersize=3)
    ax2.axhline(50, color="gray", linestyle="--", linewidth=1)
    ax2.set_xlabel("Karna HP (rjs_karna_hp)")
    ax2.set_ylabel("Marginal win rate (%)")
    ax2.set_title(f"Per-faction MARGINAL win rate vs. Karna HP\n(closest pair: {closest_marginal_pair[0]}, "
                  f"mean |diff|={closest_marginal_pair[1]:.2f}pp)")
    ax2.legend(fontsize=8, loc="best")

    fig.suptitle("Replacing Fig. 2: Karna HP sweep with confidence bands")
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "exp09_karna_hp_ci.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp09_karna_hp_ci.json")
    print("Figure:   figures/exp09_karna_hp_ci.png")


if __name__ == "__main__":
    main()
