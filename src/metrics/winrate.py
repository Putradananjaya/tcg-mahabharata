"""Win-rate confidence intervals and sample-size planning.

Backs the repo-wide rule that every stochastic result is reported as
mean +/- 95% CI over >=10 seeds (see CLAIMS_LEDGER.md), and specifically the
Fase 2 rule that every reported win rate comes with (n, Wilson CI).
"""

import math
from dataclasses import dataclass
from statistics import NormalDist


@dataclass(frozen=True)
class WilsonInterval:
    wins: int
    n: int
    alpha: float
    p_hat: float
    lower: float
    upper: float

    def __str__(self) -> str:
        conf_pct = (1 - self.alpha) * 100
        return (
            f"{self.p_hat * 100:.2f}% (n={self.n}, {conf_pct:.0f}% CI "
            f"[{self.lower * 100:.2f}%, {self.upper * 100:.2f}%])"
        )


def _z(alpha: float) -> float:
    """Two-sided critical z-value for significance level alpha."""
    if not 0 < alpha < 1:
        raise ValueError("alpha must be in (0, 1)")
    return NormalDist().inv_cdf(1 - alpha / 2)


def wilson_ci(wins: int, n: int, alpha: float = 0.05) -> WilsonInterval:
    """Wilson score interval for a binomial win rate.

    Deliberately not the normal/Wald approximation (p_hat +/- z*SE): Wald
    under-covers badly near p=0/1 and at the small-to-moderate n this repo
    actually runs (see required_n below for why n stays in the thousands,
    not millions). Wilson stays well-calibrated in that regime.
    """
    if n <= 0:
        raise ValueError("n must be positive")
    if not 0 <= wins <= n:
        raise ValueError("wins must be between 0 and n")

    z = _z(alpha)
    p_hat = wins / n
    denom = 1 + z**2 / n
    center = (p_hat + z**2 / (2 * n)) / denom
    half_width = (z / denom) * math.sqrt((p_hat * (1 - p_hat) / n) + (z**2 / (4 * n**2)))

    lower = max(0.0, center - half_width)
    upper = min(1.0, center + half_width)
    return WilsonInterval(wins=wins, n=n, alpha=alpha, p_hat=p_hat, lower=lower, upper=upper)


def standard_error(n: int, p: float = 0.5) -> float:
    """SE of a binomial proportion estimate, sqrt(p(1-p)/n).

    Defaults to p=0.5, the worst-case (maximum-variance) value -- this is
    the SE ~ 0.5/sqrt(n) rule of thumb used for simulation-budget planning
    when the true win rate isn't known yet.
    """
    if n <= 0:
        raise ValueError("n must be positive")
    if not 0 <= p <= 1:
        raise ValueError("p must be in [0, 1]")
    return math.sqrt(p * (1 - p) / n)


def required_n(delta: float, alpha: float = 0.05, power: float = 0.8, p0: float = 0.5) -> int:
    """Sample size (per configuration) needed for a two-sided one-sample
    test of H0: p=p0 vs H1: p=p0+delta to reach `power` at significance
    `alpha`. Standard normal-approximation formula:

        n = [z_(alpha/2)*sqrt(p0(1-p0)) + z_power*sqrt(p1(1-p1))]^2 / delta^2

    where p1 = p0 + delta.

    This is a genuine power calculation -- it accounts for both a false
    positive (alpha) and a false negative (power/beta) -- so it comes out
    roughly 2x higher than the simpler margin-of-error rule of thumb
    n ~ z_(alpha/2)^2 * p(1-p) / delta^2, which only controls alpha and
    says nothing about the probability of actually detecting a real delta.
    For delta=0.01, alpha=0.05, power=0.8 this gives n ~ 19,600 per
    configuration, not the ~10,000 a margin-of-error-only estimate would
    suggest -- see experiments/exp01_sample_size.py for the full derivation
    and the N_MATCH this repo actually uses.
    """
    if delta <= 0:
        raise ValueError("delta must be positive")
    if not 0 < power < 1:
        raise ValueError("power must be in (0, 1)")
    p1 = p0 + delta
    if not 0 < p1 < 1:
        raise ValueError("p0 + delta must be in (0, 1)")

    z_alpha = _z(alpha)
    z_power = NormalDist().inv_cdf(power)

    numerator = z_alpha * math.sqrt(p0 * (1 - p0)) + z_power * math.sqrt(p1 * (1 - p1))
    return math.ceil((numerator / delta) ** 2)


def paired_comparison(run_condition_a, run_condition_b, n: int, base_seed: int = 0, alpha: float = 0.05) -> dict:
    """Compare two conditions using common random numbers (CRN).

    Pair i calls both `run_condition_a(seed)` and `run_condition_b(seed)`
    with the *same* seed (`base_seed + i`) via
    `src.simulator.determinism.seed_everything` inside each callable -- so
    shared randomness (deck shuffle, mulligan/opening hand, coin toss, and
    any RNG draws before the two conditions' game states diverge) cancels
    out of the paired difference instead of contributing independent noise
    to each side. This is what makes the resulting variance far lower than
    running condition A and B as two independent unpaired samples.

    Parameters
    ----------
    run_condition_a, run_condition_b : Callable[[int], float]
        Each takes a seed and returns one match's outcome, e.g. 1.0 for a
        win, 0.0 for a loss (or a continuous score, if you want the paired
        difference of something other than a win rate).
    n : number of paired matches to run.
    base_seed : seeds used are base_seed, base_seed+1, ..., base_seed+n-1.

    Returns
    -------
    dict with n, mean_a, mean_b, mean_diff (= mean_b - mean_a), se_diff,
    ci_diff (normal-approximation CI on the mean paired difference -- not
    Wilson, which is defined for a single binomial proportion, not a
    paired difference of two correlated ones), and paired_correlation (the
    empirical correlation between the two paired series; positive means
    CRN actually reduced variance relative to independent sampling, which
    is the whole point of using it).
    """
    if n <= 0:
        raise ValueError("n must be positive")

    a_outcomes = []
    b_outcomes = []
    for i in range(n):
        seed = base_seed + i
        a_outcomes.append(run_condition_a(seed))
        b_outcomes.append(run_condition_b(seed))

    mean_a = sum(a_outcomes) / n
    mean_b = sum(b_outcomes) / n
    diffs = [b - a for a, b in zip(a_outcomes, b_outcomes)]
    mean_diff = sum(diffs) / n

    if n > 1:
        var_diff = sum((d - mean_diff) ** 2 for d in diffs) / (n - 1)
        var_a = sum((a - mean_a) ** 2 for a in a_outcomes) / (n - 1)
        var_b = sum((b - mean_b) ** 2 for b in b_outcomes) / (n - 1)
        cov_ab = sum((a - mean_a) * (b - mean_b) for a, b in zip(a_outcomes, b_outcomes)) / (n - 1)
    else:
        var_diff = var_a = var_b = cov_ab = 0.0
    se_diff = math.sqrt(var_diff / n)

    denom = math.sqrt(var_a * var_b)
    correlation = cov_ab / denom if denom > 0 else 0.0

    z = _z(alpha)
    ci_diff = (mean_diff - z * se_diff, mean_diff + z * se_diff)

    return {
        "n": n,
        "mean_a": mean_a,
        "mean_b": mean_b,
        "mean_diff": mean_diff,
        "se_diff": se_diff,
        "alpha": alpha,
        "ci_diff": ci_diff,
        "paired_correlation": correlation,
    }
