"""Restricted play (Jaffe, Miller & Andersen, "A Statistical Analysis of the
Game Rock Paper Scissors...", AIIDE 2012's restricted-play framework as used
in TCG balance analysis): measure how much a faction's win rate drops when
it is banned from using one of its mechanics.

This measures *depth*, not fairness: a mechanic that can be banned with no
win-rate cost is decorative (the faction wins the same way either way); a
mechanic whose removal causes a large drop is load-bearing for that
faction's win rate. Fairness (is the faction still ~50%?) is a payoff_matrix
question -- this module answers a different one.

Deliberately simulator-agnostic, like payoff_matrix.py: takes injected
callables rather than importing src.simulator directly. Uses
src.metrics.winrate.paired_comparison (common random numbers) so the
baseline-vs-restricted comparison shares deck shuffle / mulligan / coin-toss
randomness -- the whole point of "depth", the marginal effect of one
mechanic, gets badly swamped by unpaired sampling noise otherwise.
"""

from __future__ import annotations

from src.metrics.winrate import paired_comparison


def restricted_play_depth(baseline_run_fn, restricted_run_fn, n: int, base_seed: int = 0, alpha: float = 0.05) -> dict:
    """baseline_run_fn(seed) -> 1/0: outcome with the mechanic available.
    restricted_run_fn(seed) -> 1/0: outcome with the mechanic banned, same
    matchup and parameters otherwise.

    Returns a dict with baseline/restricted win rates, the depth (baseline
    minus restricted -- positive means the mechanic helps), its CRN-paired
    CI, and paired_correlation as a diagnostic (see paired_comparison).
    Depth near 0 (CI straddling 0) means the mechanic is decorative for win
    rate, not that it's unbalanced -- those are different questions.
    """
    comparison = paired_comparison(baseline_run_fn, restricted_run_fn, n, base_seed, alpha)
    depth = comparison["mean_a"] - comparison["mean_b"]
    lo, hi = comparison["ci_diff"]  # CI on mean_b - mean_a; flip sign for depth's convention
    return {
        "n": n,
        "baseline_win_rate": comparison["mean_a"],
        "restricted_win_rate": comparison["mean_b"],
        "depth": depth,
        "depth_ci_95": (-hi, -lo),
        "paired_correlation": comparison["paired_correlation"],
    }
