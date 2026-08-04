"""Nash averaging over a payoff matrix (Balduzzi et al., "Re-evaluating
Evaluation", NeurIPS 2018).

Motivation: a plain average win rate over opponents is not clone-invariant --
if you add near-duplicate strategies to the opponent pool, they dominate the
average and distort every other strategy's score. Nash averaging instead
rates each strategy by its payoff against the maximum-entropy Nash
equilibrium mixture of the *symmetric zero-sum game* induced by the payoff
matrix, which is provably invariant to adding clones (a clone just splits
the equilibrium mass with its twin instead of changing anyone else's rating).

Implementation: exact support enumeration, not an LP solver or iterative
approximation (no scipy in this environment, and support enumeration is
exact and fully tractable for the small strategy counts this repo has --
3 factions today, at most a handful of archetypes later). For an n-strategy
game there are 2^n - 1 candidate supports; each candidate requires solving
one (|S|+1) x |S| linear system via numpy. That's 7 subsets for n=3, trivial.
If n grows large enough that this becomes slow, switch to an LP solver
instead of trying to prune this algorithm -- don't silently approximate.
"""

from __future__ import annotations

import itertools

import numpy as np


def _solve_support(A_sub: np.ndarray) -> np.ndarray | None:
    """Solve for a mixed strategy pi over the given support (A_sub is the
    payoff matrix restricted to that support) such that pi is indifferent
    across the support (A_sub @ pi == 0) and sums to 1. Returns None if no
    valid probability vector solves it."""
    k = A_sub.shape[0]
    if k == 1:
        return np.array([1.0])

    # Stack the indifference conditions (A_sub @ pi = 0) with the
    # normalization condition (sum pi = 1); solve via least squares since
    # A_sub is antisymmetric and singular for odd k (0 is always an
    # eigenvalue of an odd-dimensional antisymmetric matrix).
    M = np.vstack([A_sub, np.ones((1, k))])
    b = np.zeros(k + 1)
    b[-1] = 1.0
    pi, residuals, rank, _ = np.linalg.lstsq(M, b, rcond=None)

    if np.linalg.norm(M @ pi - b) > 1e-6:
        return None  # no exact solution for this support
    if np.any(pi < -1e-6):
        return None  # not a valid probability vector
    return np.clip(pi, 0.0, None)


def _entropy(pi: np.ndarray) -> float:
    p = pi[pi > 1e-12]
    return float(-np.sum(p * np.log(p)))


def nash_average(payoff_matrix, names: list = None, tol: float = 1e-6) -> dict:
    """Compute the maxent Nash equilibrium of the symmetric zero-sum game
    induced by a win-rate payoff matrix, and each strategy's Nash rating.

    Parameters
    ----------
    payoff_matrix : (n, n) array-like of win rates, payoff_matrix[i][j] =
        P(strategy i beats strategy j). Does not need to be a perfectly
        antisymmetric 0.5-centered matrix -- real matrices from finite
        simulation have sampling noise, so this function antisymmetrizes
        it first: A[i,j] = (payoff[i,j] - payoff[j,i]) / 2, which averages
        the two noisy estimates of the same underlying edge strength
        instead of trusting either one alone.
    names : optional strategy names, purely for the returned dict's keys.

    Returns
    -------
    dict with:
      - "names": strategy names (or 0..n-1 if not given)
      - "nash_mixture": {name: probability} for the maxent equilibrium
      - "nash_rating": {name: payoff against the equilibrium mixture} --
        ~0 for strategies in the support (they're mutually indifferent, by
        construction), <0 for strategies outside the support (dominated:
        they lose on average to the equilibrium mixture)
      - "support": list of names with nonzero equilibrium probability
      - "entropy": entropy of the returned equilibrium, in nats
      - "num_equilibria_found": how many valid supports were found (>1
        means the game is degenerate -- e.g. exact ties or near-clones --
        and the max-entropy tie-break actually mattered)
    """
    P = np.asarray(payoff_matrix, dtype=float)
    n = P.shape[0]
    if P.shape != (n, n):
        raise ValueError("payoff_matrix must be square")
    if names is None:
        names = list(range(n))
    if len(names) != n:
        raise ValueError("names must match payoff_matrix size")

    A = (P - P.T) / 2.0  # antisymmetrized payoff, A[i,j] = -A[j,i]

    best_pi = None
    best_entropy = -1.0
    num_found = 0

    for size in range(1, n + 1):
        for support in itertools.combinations(range(n), size):
            support = list(support)
            A_sub = A[np.ix_(support, support)]
            pi_sub = _solve_support(A_sub)
            if pi_sub is None:
                continue

            pi_full = np.zeros(n)
            for idx, s in enumerate(support):
                pi_full[s] = pi_sub[idx]

            # Best-response check: no strategy outside the support should
            # earn a positive expected payoff against pi_full.
            payoffs = A @ pi_full
            outside = [i for i in range(n) if i not in support]
            if any(payoffs[i] > tol for i in outside):
                continue

            num_found += 1
            ent = _entropy(pi_full)
            if ent > best_entropy:
                best_entropy = ent
                best_pi = pi_full

    if best_pi is None:
        raise RuntimeError(
            "No valid Nash equilibrium found by support enumeration -- this "
            "should not happen for a real antisymmetric payoff matrix "
            "(the full-support case is always a candidate); check that "
            "payoff_matrix is actually square and numeric."
        )

    ratings = A @ best_pi
    return {
        "names": list(names),
        "nash_mixture": {names[i]: float(best_pi[i]) for i in range(n)},
        "nash_rating": {names[i]: float(ratings[i]) for i in range(n)},
        "support": [names[i] for i in range(n) if best_pi[i] > tol],
        "entropy": best_entropy,
        "num_equilibria_found": num_found,
    }
