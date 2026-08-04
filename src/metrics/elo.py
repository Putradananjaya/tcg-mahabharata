"""Elo and Bradley-Terry rating estimation from match outcomes.

"Per faction + per archetype deck" (Aturan Main Fase 3): both functions here
work over an arbitrary list of competitor names, so they apply to factions
today. There is currently only one deck per faction (see rules_spec.md
section 1.3 -- 2 unique cards x 20 copies, no deck-building), so "per
archetype" reduces to "per faction" until the card pool supports real
archetype variety; this module does not fabricate archetypes that don't
exist yet.
"""

from __future__ import annotations

import math

import numpy as np


def elo_ratings(match_results, k_factor: float = 32.0, initial_rating: float = 1500.0) -> dict:
    """Sequential Elo updates over a match log.

    match_results : iterable of (winner_name, loser_name) pairs, processed
        in order (Elo is order-dependent -- unlike Bradley-Terry's MLE, this
        deliberately models ratings *as of* each point in the sequence, e.g.
        if match order matters for a paper claim about rating convergence).
    Returns {name: rating}, with unseen names starting at initial_rating.
    """
    ratings: dict = {}

    def get(name):
        if name not in ratings:
            ratings[name] = initial_rating
        return ratings[name]

    for winner, loser in match_results:
        r_w, r_l = get(winner), get(loser)
        expected_w = 1.0 / (1.0 + 10 ** ((r_l - r_w) / 400.0))
        expected_l = 1.0 - expected_w
        ratings[winner] = r_w + k_factor * (1.0 - expected_w)
        ratings[loser] = r_l + k_factor * (0.0 - expected_l)

    return ratings


def bradley_terry_ratings(match_results, iterations: int = 1000, tol: float = 1e-10) -> dict:
    """Maximum-likelihood Bradley-Terry strengths via Zermelo's algorithm
    (minorization-maximization; Newman 2023, "Efficient computation of
    rankings from pairwise comparisons"). No scipy dependency needed --
    this is a simple fixed-point iteration:

        gamma_i <- W_i / sum_{j != i} (w_ij + w_ji) / (gamma_i + gamma_j)

    where W_i is i's total win count and w_ij is the number of times i beat
    j. Converges monotonically to the MLE for any starting point with all
    gamma_i > 0. Strengths are normalized to sum to 1 (Bradley-Terry
    strengths are only identified up to a scale factor).

    match_results : iterable of (winner_name, loser_name) pairs (unordered
        collection is fine -- unlike elo_ratings, order doesn't matter here).
    Returns {name: strength}. A competitor that never won (all losses) will
    converge to a strength near 0, not exactly 0 (avoids a hard zero that
    would make the next iteration's division degenerate).
    """
    names = sorted({n for pair in match_results for n in pair})
    if not names:
        return {}
    idx = {name: i for i, name in enumerate(names)}
    n = len(names)

    wins = np.zeros(n)  # W_i
    w = np.zeros((n, n))  # w[i, j] = times i beat j
    for winner, loser in match_results:
        i, j = idx[winner], idx[loser]
        wins[i] += 1
        w[i, j] += 1

    games_between = w + w.T  # w_ij + w_ji, symmetric

    gamma = np.ones(n)
    for _ in range(iterations):
        denom = np.array([
            sum(games_between[i, j] / (gamma[i] + gamma[j]) for j in range(n) if j != i)
            for i in range(n)
        ])
        # A competitor with denom==0 (no games at all) keeps its current
        # gamma instead of dividing by zero.
        new_gamma = np.where(denom > 0, wins / np.where(denom > 0, denom, 1.0), gamma)
        new_gamma = np.clip(new_gamma, 1e-12, None)
        new_gamma = new_gamma / new_gamma.sum()
        if np.max(np.abs(new_gamma - gamma / max(gamma.sum(), 1e-12))) < tol:
            gamma = new_gamma
            break
        gamma = new_gamma

    return {names[i]: float(gamma[i]) for i in range(n)}
