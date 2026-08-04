"""Fase 3: balance metrics beyond marginal win rate.

Builds the real 3x3 Satwika x Rajasika x Tamasika payoff matrix at N_MATCH
games/cell (see results/exp01_sample_size.json for why N_MATCH=20000), then
runs every Fase 3 metric against it:

  - Wilson CI per cell, mirror-match sanity check (src.metrics.payoff_matrix)
  - Nash averaging (src.metrics.nash_averaging) -- clone-invariant rating
  - Elo + Bradley-Terry (src.metrics.elo) over the same match log
  - Faction Identity Index (src.metrics.diversity) -- attack-RANK
    distribution, not attack name (see note below on why)
  - Restricted play (src.metrics.restricted_play): how much does Satwika's
    win rate vs Tamasika drop if Sabda Rahayu's heal is banned?
  - The composite balance objective (src.metrics.balance_objective)

Runs this full pipeline against TWO parameter sets, not one:
  - "smart_start": src.simulator.fitness.SMART_START, the hand-authored
    pre-optimization seed.
  - "ga_balanced": data/ga_balanced_params.json, a prior GA run's claimed
    balanced output.
Comparing them is the point: SMART_START is not expected to be balanced (GA
exists to fix it) -- what actually matters is whether ga_balanced_params.json
holds up under a full pairwise-CI matrix instead of the 3-matchup-cycle loss
evaluate_chromosome() optimized against. Report both, whatever they show
(Aturan Main Fase 3 acceptance criteria: report real imbalance, don't hide
it).

Methodological note on Faction Identity Index: every attack in this game has
a globally unique NAME, so comparing factions' *raw attack-name*
distributions is trivially maximal (JSD=1.0 always, since no two factions
ever share a name) and would prove nothing. Instead this compares each
faction's distribution over attack *rank* (0 = the character's own
highest-base_damage attack, 1 = its second, matching exactly what
Player.attack() itself sorts on -- see rules_spec.md section 4.1) -- a
shared, comparable axis grounded in real engine behavior: how often does
this faction lean on its best option vs fall back to a cheaper one.

Run: venv/bin/python experiments/exp03_balance_matrix.py
Artifacts: results/exp03_balance_matrix.json,
           figures/payoff_matrix_3x3_smart_start.png,
           figures/payoff_matrix_3x3_ga_balanced.png
"""
import copy
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.metrics.balance_objective import balance_objective
from src.metrics.diversity import faction_identity_index
from src.metrics.elo import bradley_terry_ratings, elo_ratings
from src.metrics.nash_averaging import nash_average
from src.metrics.payoff_matrix import build_payoff_matrix
from src.metrics.restricted_play import restricted_play_depth
from src.simulator.determinism import seed_everything
from src.simulator.fitness import SMART_START, build_faction_decks, run_simulation, run_simulation_multi

N_MATCH = 20000  # see CLAIMS_LEDGER.md "Win-rate reporting standard"
BASE_SEED = 20260801
FACTIONS = ["SATWIKA", "RAJASIKA", "TAMASIKA"]
ROOT = Path(__file__).resolve().parent.parent


def build_rank_map(faction_deck: dict) -> dict:
    """attack name -> rank (0 = that card's own highest base_damage attack),
    matching Player.attack()'s own sort key exactly."""
    rank_map = {}
    for card in faction_deck["cards"]:
        sorted_attacks = sorted(card["attacks"], key=lambda a: a.get("base_damage", 0), reverse=True)
        for rank, atk in enumerate(sorted_attacks):
            rank_map[atk["name"]] = rank
    return rank_map


def run_pipeline(params: dict, label: str, seed_offset: int) -> dict:
    print(f"\n{'=' * 70}\n=== Parameter set: {label} ===\n{'=' * 70}")

    satwika, rajasika, tamasika = build_faction_decks(params)
    deck_by_name = {"SATWIKA": satwika, "RAJASIKA": rajasika, "TAMASIKA": tamasika}
    rank_map = {}
    for name, deck in deck_by_name.items():
        rank_map.update(build_rank_map(deck))

    match_results = []  # (winner, loser) for Elo/Bradley-Terry, mirrors excluded
    rank_counts = {name: {} for name in FACTIONS}  # {faction: {rank: count}}

    def play_match_fn(row: str, col: str, seed: int) -> int:
        seed_everything(seed)
        # run_simulation_multi identifies the winner by comparing name
        # strings (see rules_spec.md section 4.5) -- for a mirror match
        # (row == col) that's ambiguous by construction (both sides share a
        # name), so give the two sides temporary distinct labels and map
        # back to row/col afterward. This is a workaround in this script,
        # not a simulator change.
        label_row, label_col = (f"{row}__A", f"{col}__B") if row == col else (row, col)
        winner, _turn, log_row, log_col = run_simulation_multi(deck_by_name[row], deck_by_name[col], label_row, label_col)
        row_won = winner == label_row

        for attack_name in log_row:
            r = rank_map.get(attack_name)
            if r is not None:
                rank_counts[row][r] = rank_counts[row].get(r, 0) + 1
        for attack_name in log_col:
            r = rank_map.get(attack_name)
            if r is not None:
                rank_counts[col][r] = rank_counts[col].get(r, 0) + 1

        if row != col:
            match_results.append((row, col) if row_won else (col, row))

        return 1 if row_won else 0

    print(f"Building 3x3 payoff matrix, N_MATCH={N_MATCH}/cell (9 cells, {9 * N_MATCH} games)...")
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        matrix = build_payoff_matrix(FACTIONS, play_match_fn, N_MATCH, base_seed=BASE_SEED + seed_offset)
    finally:
        sys.stdout = original_stdout

    print("Payoff matrix (row beats column):")
    for row in FACTIONS:
        for col in FACTIONS:
            print(f"  {row:8} vs {col:8}: {matrix.cell(row, col).ci}")
    print(f"Max mirror-match deviation from 50%: {matrix.max_mirror_deviation() * 100:.2f}pp")

    P = np.array([[matrix.win_rate(r, c) for c in FACTIONS] for r in FACTIONS])
    nash = nash_average(P, FACTIONS)
    print(f"\nNash mixture: {nash['nash_mixture']}")
    print(f"Nash rating: {nash['nash_rating']}")

    elo = elo_ratings(match_results)
    bt = bradley_terry_ratings(match_results)
    print(f"\nElo: {elo}")
    print(f"Bradley-Terry: {bt}")

    identity = faction_identity_index(rank_counts)
    print(f"\nFaction Identity Index (mean pairwise JSD, bits): {identity['mean_pairwise_jsd']:.4f}")
    print(f"Per-faction attack-rank entropy: {identity['per_faction_entropy']}")

    objective = balance_objective(matrix, identity)
    print(f"\nBalance objective: total={objective.total:.5f} "
          f"(marginal={objective.marginal_parity_deviation:.5f}, "
          f"pairwise={objective.pairwise_deviation:.5f}, "
          f"identity_penalty={objective.identity_penalty:.5f})")

    satwika_no_heal = copy.deepcopy(satwika)
    for card in satwika_no_heal["cards"]:
        for atk in card["attacks"]:
            if atk.get("effect") == "heal_bench_card":
                atk["effect"] = None

    def baseline_run(seed):
        seed_everything(seed)
        return 1 if run_simulation(satwika, tamasika, "SATWIKA", "TAMASIKA") == "SATWIKA" else 0

    def restricted_run(seed):
        seed_everything(seed)
        return 1 if run_simulation(satwika_no_heal, tamasika, "SATWIKA", "TAMASIKA") == "SATWIKA" else 0

    print(f"\nRestricted play: Satwika's heal_bench_card banned, vs Tamasika, N={N_MATCH} paired games...")
    sys.stdout = io.StringIO()
    try:
        depth = restricted_play_depth(baseline_run, restricted_run, N_MATCH, base_seed=BASE_SEED + seed_offset + 10**7)
    finally:
        sys.stdout = original_stdout
    print(f"Baseline win rate:    {depth['baseline_win_rate']*100:.2f}%")
    print(f"Restricted win rate:  {depth['restricted_win_rate']*100:.2f}%")
    print(f"Depth (baseline-restricted): {depth['depth']*100:+.2f}pp, 95% CI [{depth['depth_ci_95'][0]*100:+.2f}, {depth['depth_ci_95'][1]*100:+.2f}]pp")
    print(f"Paired correlation (CRN diagnostic): {depth['paired_correlation']:.3f}")

    result = {
        "label": label,
        "N_MATCH": N_MATCH,
        "base_seed": BASE_SEED + seed_offset,
        "factions": FACTIONS,
        "payoff_matrix": {
            f"{r}_vs_{c}": {
                "wins": matrix.cell(r, c).wins,
                "n": matrix.cell(r, c).n,
                "win_rate": matrix.cell(r, c).ci.p_hat,
                "wilson_ci_95": {"lower": matrix.cell(r, c).ci.lower, "upper": matrix.cell(r, c).ci.upper},
            }
            for r in FACTIONS for c in FACTIONS
        },
        "max_mirror_deviation_pp": matrix.max_mirror_deviation() * 100,
        "marginal_win_rates": objective.marginal_win_rates,
        "nash_averaging": {"mixture": nash["nash_mixture"], "rating": nash["nash_rating"], "support": nash["support"], "entropy": nash["entropy"]},
        "elo_ratings": elo,
        "bradley_terry_ratings": bt,
        "faction_identity_index": {
            "mean_pairwise_jsd_bits": identity["mean_pairwise_jsd"],
            "pairwise_jsd_bits": {f"{a}_vs_{b}": v for (a, b), v in identity["pairwise"].items()},
            "per_faction_attack_rank_entropy": identity["per_faction_entropy"],
            "rank_counts": rank_counts,
        },
        "balance_objective": {
            "total": objective.total,
            "marginal_parity_deviation": objective.marginal_parity_deviation,
            "pairwise_deviation": objective.pairwise_deviation,
            "identity_penalty": objective.identity_penalty,
            "weights": objective.weights,
        },
        "restricted_play_satwika_heal_vs_tamasika": depth,
    }

    make_figure(matrix, label)
    return result


def make_figure(matrix, label: str):
    # Diverging colormap centered at 50% (this is polarity data --
    # above/below fair -- per the dataviz color-formula, not a
    # sequential/rainbow scale).
    win_rates = np.array([[matrix.win_rate(r, c) for c in FACTIONS] for r in FACTIONS])
    fig, ax = plt.subplots(figsize=(7.5, 6.5))
    im = ax.imshow(win_rates, cmap="RdBu_r", vmin=0.0, vmax=1.0)
    ax.set_xticks(range(len(FACTIONS)))
    ax.set_yticks(range(len(FACTIONS)))
    ax.set_xticklabels(FACTIONS)
    ax.set_yticklabels(FACTIONS)
    ax.set_xlabel("Opponent (column)")
    ax.set_ylabel("Row faction")
    ax.set_title(f"3x3 Payoff Matrix (row win rate vs column)\nparams={label}, N_MATCH={N_MATCH}/cell")

    for i, row in enumerate(FACTIONS):
        for j, col in enumerate(FACTIONS):
            cell = matrix.cell(row, col)
            text_color = "white" if abs(cell.ci.p_hat - 0.5) > 0.25 else "black"
            weight = "bold" if row == col else "normal"
            ax.text(
                j, i,
                f"{cell.ci.p_hat*100:.1f}%\n[{cell.ci.lower*100:.1f}, {cell.ci.upper*100:.1f}]",
                ha="center", va="center", color=text_color, fontsize=10, fontweight=weight,
            )

    cbar = fig.colorbar(im, ax=ax, shrink=0.85)
    cbar.set_label("Row win rate")
    caption = (
        f"N_MATCH={N_MATCH} games/cell, Wilson 95% CI shown per cell. "
        f"Diagonal = mirror-match sanity check (max deviation from 50%: {matrix.max_mirror_deviation()*100:.2f}pp)."
    )
    fig.text(0.5, -0.02, caption, ha="center", fontsize=8, wrap=True)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / f"payoff_matrix_3x3_{label}.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def main():
    ga_balanced_params = json.loads((ROOT / "data" / "ga_balanced_params.json").read_text())

    results = {
        "smart_start": run_pipeline(SMART_START, "smart_start", seed_offset=0),
        "ga_balanced": run_pipeline(ga_balanced_params, "ga_balanced", seed_offset=10**8),
    }

    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp03_balance_matrix.json").write_text(json.dumps(results, indent=2))

    print(f"\n{'=' * 70}")
    print("Artifact: results/exp03_balance_matrix.json")
    print("Figures:  figures/payoff_matrix_3x3_smart_start.png, figures/payoff_matrix_3x3_ga_balanced.png")


if __name__ == "__main__":
    main()
