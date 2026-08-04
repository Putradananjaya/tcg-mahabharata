"""Wilcoxon signed-rank test + rank-biserial effect size, from scratch (no
scipy in this venv -- normal-approximation p-value via
statistics.NormalDist, same approach already used for Expected Improvement
in src.surrogate.model_management).

Used by experiments/exp07_optimizer_ablation.py to compare optimizers
pairwise on the SAME seeds (a paired, non-parametric test is appropriate
here because "final scalarized_objective value across >=15 seeds" is not
assumed normally distributed, and pairing by seed removes seed-to-seed
variance common to both methods -- a common-random-numbers-style variance
reduction, same spirit as src.metrics.winrate.paired_comparison).
"""
from __future__ import annotations

from dataclasses import dataclass
from statistics import NormalDist

_STD_NORMAL = NormalDist(0.0, 1.0)


@dataclass(frozen=True)
class WilcoxonResult:
    n_pairs: int          # number of non-zero-difference pairs actually used
    n_ties_dropped: int    # pairs with x_i == y_i, excluded (standard convention)
    w_statistic: float     # min(W+, W-)
    z: float
    p_value: float          # two-sided, normal approximation with continuity correction
    rank_biserial_r: float  # effect size, in [-1, 1]; sign follows (w_plus - w_minus)


def wilcoxon_signed_rank(x: list, y: list) -> WilcoxonResult:
    """Two-sided Wilcoxon signed-rank test on paired samples x, y (same
    length, x[i]/y[i] paired e.g. by seed). Zero differences are dropped
    (standard convention). Requires n_pairs >= ~10 for the normal
    approximation used here to be reasonable -- exp07 always calls this
    with >=15 seeds, but this function does not enforce a minimum itself.
    """
    if len(x) != len(y):
        raise ValueError("x and y must be the same length (paired samples)")

    diffs = [xi - yi for xi, yi in zip(x, y)]
    nonzero = [d for d in diffs if d != 0]
    n_ties_dropped = len(diffs) - len(nonzero)
    n = len(nonzero)

    if n == 0:
        return WilcoxonResult(n_pairs=0, n_ties_dropped=n_ties_dropped, w_statistic=0.0,
                               z=0.0, p_value=1.0, rank_biserial_r=0.0)

    abs_diffs = [abs(d) for d in nonzero]
    order = sorted(range(n), key=lambda i: abs_diffs[i])

    # Average ranks for ties in |d|.
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and abs_diffs[order[j + 1]] == abs_diffs[order[i]]:
            j += 1
        avg_rank = (i + 1 + j + 1) / 2.0
        for k in range(i, j + 1):
            ranks[order[k]] = avg_rank
        i = j + 1

    w_plus = sum(ranks[i] for i in range(n) if nonzero[i] > 0)
    w_minus = sum(ranks[i] for i in range(n) if nonzero[i] < 0)
    w_stat = min(w_plus, w_minus)

    mean_w = n * (n + 1) / 4.0
    # Tie correction for the variance (standard formula; a no-op when there
    # are no tied |d| groups).
    tie_groups = {}
    for r in ranks:
        tie_groups[r] = tie_groups.get(r, 0) + 1
    tie_correction = sum(t ** 3 - t for t in tie_groups.values()) / 48.0
    var_w = n * (n + 1) * (2 * n + 1) / 24.0 - tie_correction
    std_w = var_w ** 0.5 if var_w > 0 else 1e-12

    # Continuity-corrected z, sign toward the smaller of W+/W-.
    signed_stat = w_plus - mean_w
    correction = 0.5 if signed_stat > 0 else (-0.5 if signed_stat < 0 else 0.0)
    z = (signed_stat - correction) / std_w
    p_value = 2.0 * (1.0 - _STD_NORMAL.cdf(abs(z)))
    p_value = min(1.0, p_value)

    total = n * (n + 1) / 2.0
    rank_biserial_r = (w_plus - w_minus) / total if total > 0 else 0.0

    return WilcoxonResult(n_pairs=n, n_ties_dropped=n_ties_dropped, w_statistic=w_stat,
                           z=z, p_value=p_value, rank_biserial_r=rank_biserial_r)
