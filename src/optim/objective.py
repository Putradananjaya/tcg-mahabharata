"""Pers. (4), formally defined: the single-scalar objective every
single-objective optimizer in this package (GA, PSO, Hybrid, Random
Search, CMA-ES, Bayesian Optimization) is compared against in
experiments/exp07_optimizer_ablation.py:

    Objective(Theta) = BalanceDeviation(Theta) + lambda * PowerCreepPenalty(Theta)

BalanceDeviation(Theta) is the existing pairwise 3-matchup squared
deviation from 50% (`src.simulator.fitness.evaluate_chromosome`'s `loss`,
unchanged -- reused, not redefined, so this objective is directly
comparable to every pre-Fase-7 GA/PSO run). PowerCreepPenalty(Theta) is
`src.metrics.power_creep.power_creep_penalty` (see that module for the
full derivation).

lambda = 8000, calibrated (not guessed) as follows: PowerCreepPenalty's
maximum possible value is ~0.241 (at the all-stats-maximally-powerful
corner of BOUNDS -- see power_creep.py's own worked example). At
lambda=8000, that worst case contributes lambda * 0.241 ~= 1925 loss
units, comparable to SMART_START's own BalanceDeviation (2159, measured at
n=150 games/matchup -- SMART_START is a pre-optimization seed, not itself
balanced, rules_spec.md section 9). This puts "fully escalating power" and
"being about as imbalanced as the unbalanced starting point" on comparable
footing: neither is free, neither dominates the other by construction. A
uniformly random Theta's PowerCreepPenalty is typically ~0 (independent
per-dimension random deltas cancel in the aggregate before the one-sided
max(0,.) -- verified empirically, see rules_spec.md section 14.1), so this
term is inert for undirected search and only bites an optimizer that
systematically escalates every stat together.

Per rules_spec.md section 14.1: this scalarization is being formally
specified to correct the paper's previously-undefined Pers. (4), and to
give the single-objective baselines in exp07 a well-specified, fair
comparison target -- it is NOT endorsed as the preferred way to trade off
balance against power creep going forward. A single lambda cannot
correctly balance two objectives of unknown relative importance and
different units; src.optim.nsga2.run_nsga2_power_balance's genuine
multi-objective Pareto treatment (f1=balance, f2=power creep, f3=-identity)
is the recommended approach where a Pareto front, not a single lambda, is
wanted.
"""
from __future__ import annotations

from src.metrics.power_creep import power_creep_penalty
from src.simulator.fitness import evaluate_chromosome

LAMBDA_POWER_CREEP = 8000.0


def scalarized_objective(theta: dict, num_runs: int, lam: float = LAMBDA_POWER_CREEP):
    """Returns (total, balance_deviation, power_creep_term, rates) so a
    total can always be traced back to which term drove it (same
    transparency convention as src.metrics.balance_objective)."""
    balance_deviation, rates = evaluate_chromosome(theta, num_runs=num_runs)
    power_creep_term = lam * power_creep_penalty(theta)
    total = balance_deviation + power_creep_term
    return total, balance_deviation, power_creep_term, rates
