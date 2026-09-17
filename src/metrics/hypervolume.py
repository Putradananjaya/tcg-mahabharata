"""Hypervolume indicator for a (minimization) Pareto front, used by Fase E9
(docs/FASE_E9_SPEC.md section 2.4) to compare the unconstrained and
lore-constrained NSGA-II fronts against a shared reference point.

Exact computation via inclusion-exclusion over the axis-aligned boxes
[point, reference] each front member defines: for n points this is
O(2^n * n * d), which is fine for the front sizes NSGA-II actually produces
here (order of 10-20 points) and avoids the approximation error a
Monte-Carlo hypervolume estimator would otherwise require reporting a CI
for. Not intended for fronts with dozens of points -- switch to an
incremental/WFG-style algorithm before this stops being cheap.
"""
from __future__ import annotations

import itertools


def hypervolume(points: list, reference: tuple) -> float:
    """Volume of the region weakly dominated by `points` and bounded above
    by `reference`, for objectives that are all MINIMIZED. `reference` must
    be worse (numerically greater) than every point in every dimension, or
    that point contributes 0 (it does not extend past the reference box).

    points: list of tuples/lists, each of the same length as `reference`.
    Returns 0.0 for an empty front.
    """
    if not points:
        return 0.0

    dims = len(reference)
    for p in points:
        if len(p) != dims:
            raise ValueError("every point must have the same dimensionality as reference")

    n = len(points)
    total = 0.0
    for r in range(1, n + 1):
        sign = 1.0 if (r % 2 == 1) else -1.0
        for subset in itertools.combinations(range(n), r):
            vol = 1.0
            for d in range(dims):
                lower = max(points[i][d] for i in subset)
                side = reference[d] - lower
                if side <= 0:
                    vol = 0.0
                    break
                vol *= side
            total += sign * vol
    return total
