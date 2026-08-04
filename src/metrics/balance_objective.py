"""Composite balance objective combining three distinct failure modes that a
single marginal-win-rate number can't tell apart (Aturan Main Fase 3):

  (a) marginal parity deviation  -- each faction's win rate, averaged over
      all opponents, should be ~50%.
  (b) pairwise deviation from 50% -- EVERY individual matchup cell should
      also be ~50%, not just the average. This is the term that catches the
      rock-paper-scissors-degenerate case the whole phase is about: a cyclic
      RPS-like game (A beats B 70%, B beats C 70%, C beats A 70%) has a
      *perfect* marginal win rate for every strategy (each wins 70% of one
      matchup and 30% of the other, averaging exactly 50%) while every
      individual pairing is badly lopsided. (a) alone is blind to this;
      (a)+(b) together is not.
  (c) identity-loss penalty -- (a)+(b) alone are minimized by making every
      faction play identically (if all kits are the same, every matchup is
      trivially ~50%). This term penalizes collapsing
      src.metrics.diversity.faction_identity_index's mean pairwise JSD below
      a target, so "balanced" can't be achieved by "homogeneous."

This does not replace src.simulator.fitness.evaluate_chromosome's existing
GA/PSO/NSGA2 objective (which only checks 3 of the 9 payoff-matrix cells and
has no identity term) -- it's a strictly more complete alternative, left for
a future optimization pass to adopt; see rules_spec.md-style flagging in
CLAIMS_LEDGER.md for why this wasn't silently swapped in under existing
optimizers without being asked.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.metrics.payoff_matrix import PayoffMatrix


@dataclass(frozen=True)
class BalanceObjective:
    total: float
    marginal_parity_deviation: float
    pairwise_deviation: float
    identity_penalty: float
    marginal_win_rates: dict
    mean_pairwise_jsd: float
    weights: tuple


def marginal_win_rates(matrix: PayoffMatrix) -> dict:
    """Each faction's win rate averaged over all *other* factions (excludes
    the mirror-match cell -- marginal parity is about how a faction fares
    against the field, not against itself)."""
    result = {}
    for name in matrix.names:
        others = [c for c in matrix.names if c != name]
        result[name] = sum(matrix.win_rate(name, c) for c in others) / len(others)
    return result


def balance_objective(
    matrix: PayoffMatrix,
    identity: dict,
    identity_target: float = 0.3,
    weights: tuple = (1.0, 1.0, 1.0),
) -> BalanceObjective:
    """Compute the composite objective.

    matrix : a PayoffMatrix from src.metrics.payoff_matrix.build_payoff_matrix.
    identity : the dict returned by
        src.metrics.diversity.faction_identity_index for the same factions.
    identity_target : minimum acceptable mean pairwise JSD (bits). Below
        this, the identity penalty is positive; above it, 0 (more
        distinctiveness than the target isn't penalized -- this term only
        stops identity from being sacrificed for balance, it doesn't reward
        maximizing divergence for its own sake).
    weights : (w_marginal, w_pairwise, w_identity). Both deviation terms are
        already in the same units (squared win-rate-minus-0.5, range
        [0, 0.25] per term); the identity penalty is in squared-JSD-bits
        units (range [0, identity_target^2]) -- these are NOT automatically
        comparable in magnitude, so the default (1, 1, 1) is a starting
        point to calibrate against real data, not a principled weighting.

    Returns a BalanceObjective with the total and every component broken
    out, so a lower total can always be traced back to which failure mode
    improved -- never report just the scalar.
    """
    w_marginal, w_pairwise, w_identity = weights

    marginals = marginal_win_rates(matrix)
    marginal_dev = sum((wr - 0.5) ** 2 for wr in marginals.values())

    pairwise_dev = sum(
        (matrix.win_rate(a, b) - 0.5) ** 2
        for a in matrix.names
        for b in matrix.names
        if a != b
    )

    mean_jsd = identity["mean_pairwise_jsd"]
    identity_penalty = max(0.0, identity_target - mean_jsd) ** 2

    total = w_marginal * marginal_dev + w_pairwise * pairwise_dev + w_identity * identity_penalty

    return BalanceObjective(
        total=total,
        marginal_parity_deviation=marginal_dev,
        pairwise_deviation=pairwise_dev,
        identity_penalty=identity_penalty,
        marginal_win_rates=marginals,
        mean_pairwise_jsd=mean_jsd,
        weights=weights,
    )
