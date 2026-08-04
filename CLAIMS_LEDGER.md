# Claims Ledger

Maps every empirical claim that will appear in the paper to the script,
config, and artifact that produces it. Per Aturan Main §0: a claim with no row
here, or whose artifact doesn't exist / doesn't back the stated number, must
be deleted from the paper, not hedged.

## Win-rate reporting standard (Fase 2)

Every win rate reported as a paper result (not an internal GA/PSO search
evaluation) must be stated as: **win rate (n=N_MATCH, Wilson 95% CI [lower,
upper])** — see `src/metrics/winrate.wilson_ci`. Never a bare percentage.

- **N_MATCH = 20,000** games per configuration. Derived in
  `experiments/exp01_sample_size.py` -> `results/exp01_sample_size.json` /
  `figures/sample_size_justification.png`, from
  `src/metrics/winrate.required_n(delta=0.01, alpha=0.05, power=0.8) = 19620`
  (rounded up). This is the n needed to detect a 1-percentage-point shift
  from 50% with 80% power at alpha=0.05 — the "can we tell HP=95 from HP=94
  apart" bar from Aturan Main Fase 2. State N_MATCH and its derivation in
  every figure caption that reports a win rate.
- Any experiment run at a *smaller* n than N_MATCH (e.g. GA/PSO fitness
  evaluations during search, which use num_runs in the low hundreds for
  compute reasons) is search/exploration, not a citable result — its output
  must not appear in the paper as a win-rate claim without being re-run at
  N_MATCH first.
- Comparing two configurations directly (e.g. HP=95 vs HP=94)? Prefer
  `src/metrics/winrate.paired_comparison` (common random numbers) over two
  independent N_MATCH runs — it needs far fewer games for the same power
  because shared randomness cancels out of the paired difference. See its
  docstring.
- Banned in paper prose describing simulator results: "exact", "exactly",
  "perfectly", "precisely" (and inflections) — every reported number carries
  sampling error; state the CI instead of implying certainty. **Not yet
  checked against an actual paper draft — no paper manuscript file exists in
  this repository as of this review; this rule applies the moment one is
  added.**

## Balance parity standard (Fase 3)

**"50% parity" is retired as a claim on its own.** Restate it as: **"marginal
parity and pairwise parity, both within 95% CI."** These are different
claims that can each independently hold or fail — a game can have perfect
marginal parity (every faction's win rate, averaged over all opponents, is
~50%) while individual matchups are badly lopsided (the classic
rock-paper-scissors-degenerate case: A beats B 70%, B beats C 70%, C beats A
70% averages to exactly 50% marginal for everyone). Report both numbers,
always, never one implying the other:

- **Marginal parity**: `src/metrics/balance_objective.marginal_win_rates`
  (each faction's win rate averaged over the other two).
- **Pairwise parity**: the full n x n `src/metrics/payoff_matrix` grid, every
  off-diagonal cell with its own Wilson CI, plus the diagonal (mirror-match)
  cells as a sanity check that should be ~50% — a mirror match that isn't
  ~50% signals an engine bug (e.g. the first-mover-advantage issue in
  rules_spec.md 1.2, or the name-collision bug in 4.5), not a balance
  finding.
- If pairwise parity does **not** hold even though marginal parity does,
  report that plainly as a finding, not a caveat to hide — see the
  `SMART_START` vs `ga_balanced_params.json` result below, which is exactly
  this repo's version of that scenario in miniature (marginal deviation
  0.130 -> 0.0005 and pairwise deviation 0.449 -> 0.004 moving from
  `SMART_START` to `ga_balanced_params.json` — both dropped together here,
  but they are tracked and could have diverged, and the pipeline would have
  caught it if they had).

Methodological note: this Wilson-CI-over-N_MATCH-games standard is the
specific, statistically grounded standard for *win-rate proportions*. Aturan
Main §0's blanket ">=10 seeds" rule still governs other stochastic results
(e.g. GA/PSO run-to-run variance across random initializations) where the
uncertainty being quantified is genuinely across independent runs, not
within-run binomial sampling of a fixed configuration.

## Policy population standard (Fase 4)

**"Balanced" is not a well-formed claim without naming the policy (or
population of policies) it was measured against.** Fase 3's balance result
was measured under exactly one implicit policy: `Player.attack()`'s
automatic best-damage/panic-fallback selection. Fase 4
(`experiments/exp04_policy_dependence.py`, `src/agents/*`,
`src/simulator/agent_env.py`) tested whether that result survives when the
decision-maker is made explicit and varied, using this population of 9
policies (self-play — both sides of every matchup controlled by the same
policy):

> `RandomAgent`, `GreedyAgent`, `AggroAgent` (scripted_aggro), `ControlAgent`
> (scripted_control), `TabularQLearningAgent` checkpointed at 25% / 50% /
> 100% of a 3000-game self-play training run (`dqn_25pct`/`dqn_50pct`/`dqn_100pct`),
> `MCTSAgent(budget=100)`, `MCTSAgent(budget=2000)`.

It does not survive uniformly. Any balance claim about
`data/ga_balanced_params.json` (or any future parameter set) must state
which policy or population it was tested against — see
`results/exp04_policy_dependence.json` and rules_spec.md section 11 for the
full breakdown. n/cell is calibrated per agent (783 for the 7 fast agents,
15 for `mcts_budget100`, 3 for `mcts_budget2000`) and reported per-agent in
the artifact — never treat the MCTS cells as having the same precision as
the fast-agent cells.

## RL agent evaluation standard (Fase 5)

**"Tactical accuracy" is retired — there is no ground-truth optimal action
for this game, so no number can be reported against it.** Any paper claim
about the RL agent (`src.agents.dqn_agent.TabularQLearningAgent` — see
rules_spec.md section 12.1 for why this is tabular Q-learning, not DQN,
and why the older `QLearningAgent` is deprecated and excluded) must instead
be one of:

- **Win rate vs. a named baseline agent, with Wilson 95% CI** (same
  standard as the "Win-rate reporting standard" above) — e.g. vs.
  `RandomAgent`, vs. `GreedyAgent`. State which baseline; a win rate
  without a named opponent is not a well-formed claim, same principle as
  the policy-population standard above.
- **Elo within an explicitly named population and comparison graph**
  (`src.metrics.elo.elo_ratings`) — state the full population and whether
  the comparison graph is a round-robin or a star topology through common
  opponents (the latter is cheaper but the resulting ratings are only as
  reliable as the connecting matches).
- Exploitability / best-response gap, only if a script producing it exists
  — as of Fase 5 none does (rules_spec.md 12.6 explains why it wasn't
  attempted); do not report an exploitability number without one.

**Every reward-shaping hyperparameter must be named and its value stated**
(`src.agents.dqn_agent.RewardWeights`: `w1_step_cost`, `w2_hp_potential`,
`w3_aggression_bias`, `w_ko` — rules_spec.md 12.4). If a claim depends on
reward shaping, state the exact weights used and, ideally, cite whether the
conclusion held across `results/exp05_reward_sensitivity.json`'s sweep or
only at the one setting evaluated — see rules_spec.md 12.5 for why "the
conclusion didn't flip in this sweep" is a narrower claim than "the
conclusion is robust to reward shaping in general."

The full hyperparameter table (architecture, alpha, gamma, epsilon
schedule, replay buffer/target network/batch size — all N/A for a tabular
agent, stated explicitly rather than left blank — state discretization,
empirical Q-table size, training regime) lives in `results/dqn_hparams.json`
and is the Appendix B source; do not restate hyperparameter numbers in
paper prose that don't trace back to that file.

## Surrogate modeling standard (Fase 6)

**"MAE X" is not a citable claim for a surrogate without a baseline, a
protocol, and a split unit.** The prior "MAE 0.024" claim had none of the
three and is retired outright (not requalified) — see rules_spec.md
section 13. Any future surrogate-accuracy claim must state:

- **Split unit = design point, never match/game.** A dataset row is one
  parameter vector Theta; if multiple noisy evaluations of the same Theta
  exist, they must land entirely on one side of a train/test split — see
  `experiments/exp06_surrogate_validation.py`'s `leakage_demo()` for a
  quantified example of what a match-level split costs (an apparent 1.40
  MAE-point improvement that is pure leakage, not model quality).
- **All three mandatory baselines, on the same split**: constant predictor
  (w_hat=50.0), linear regression, gradient boosting
  (`src/surrogate/baselines.py`). A model that does not beat the constant
  predictor by a bootstrap-significant margin (paired bootstrap on
  per-point MAE, 95% CI excluding 0) contributes nothing and must be
  reported as such, not quietly kept. A model that loses to a simpler
  baseline (Fase 6: the MLP ensemble lost to gradient boosting on both ID
  and OOD splits) must say so — beating the weakest mandatory baseline is
  not the same claim as being the best available model.
- **In-distribution AND out-of-distribution numbers, both**, with an
  explicit, measured definition of "out of distribution" (Fase 6: mean
  |z-score| from the training distribution) — never just the ID number.
- **A calibration check for any reported sigma_hat**, and an honest
  verdict — Fase 6's deep ensemble passed the "beats constant" bar but
  FAILED calibration (reliability curves flat around 0.5 instead of
  diagonal, both ID and OOD); that failure is reported plainly in
  rules_spec.md 13.4, not smoothed into a vaguer "reasonably calibrated."
- **A surrogate-assisted optimization result's FINAL claim is always a
  real-simulator verification, at N_MATCH-or-higher precision, never a
  surrogate prediction and never a low-N in-loop checkpoint.** Fase 6
  found the loop's own n=150 in-loop "best true loss" tracker
  (39.56) disagreed sharply with the same candidate's n=20000 verification
  (176.75) — exactly the kind of noisy-selection overconfidence this rule
  exists to prevent; see rules_spec.md 13.6.

## Optimizer ablation standard (Fase 7)

**"Hybrid X+Y" is not a citable claim without an ablation against X-only
and Y-only on an identical evaluation budget.** Fase 7's own ablation
found `hybrid_ga_pso` does NOT beat `ga_only` significantly (Wilcoxon
signed-rank p=0.7652, rank-biserial r=+0.081, n=20 seeds) — per the
acceptance criteria agreed before running it, **the "hybrid GA+PSO" framing
is retracted from any paper title/abstract claim**, not requalified or
hedged. See rules_spec.md section 14.4 for the full ranking and why PSO
alone, not the hybrid, is the actual best performer.

- **Budget = evaluation count, never wall-clock time.** Every optimizer in
  `src/optim/` compared in `experiments/exp07_optimizer_ablation.py` takes
  `budget` (number of `scalarized_objective` calls) as its unit of
  comparison; report which budget was used, never a time-based comparison.
- **Pers. (4) (`BalanceDeviation(Theta) + lambda*PowerCreepPenalty(Theta)`)
  is now fully defined** (`src/optim/objective.py`: lambda=8000, calibrated
  against `SMART_START`'s own imbalance and `PowerCreepPenalty`'s worst
  case — see rules_spec.md 14.1) but is explicitly NOT the recommended way
  to trade off balance against power creep — `src.optim.nsga2.run_nsga2_power_balance`'s
  genuine 3-objective Pareto front (rules_spec.md 14.2) is, whenever an
  actual trade-off surface rather than one arbitrarily-weighted point is
  wanted.
- **Constraint handling for continuous optimizers on this integer search
  space must be stated explicitly** (round-then-clip, in raw units for
  PSO/Hybrid or in normalized [0,1]^25 space for CMA-ES/BO — rules_spec.md
  14.3) — "how does a continuous algorithm handle an integer BOUNDS space"
  is not something a reader should have to infer.
- **"Rapid convergence" must be scoped to the methods that actually show
  it in a convergence-curve figure**, not asserted as a blanket property.
  Fase 7 found GA/PSO/Hybrid/CMA-ES converge within ~50-80 of 300
  evaluations; Random Search and this phase's (fixed-hyperparameter) GP-based
  Bayesian Optimization baseline do not converge within the same budget —
  see `figures/exp07_convergence_curves.png`.

## Cost accounting and complexity standard (Fase 8)

**A speedup number is not citable without stating whether it is
per-evaluation (marginal) or amortized (full pipeline, including one-time
setup costs) — and an amortized claim additionally requires the
break-even point.** Fase 8's own numbers: per-evaluation speedup 354.4x
(surrogate eval vs. real-simulator eval, both trained/untrained cost
excluded); amortized speedup 7.0x at N=10 re-balancing runs, break-even at
N*=0.67 runs (`results/exp08_cost_accounting.json`). Neither number alone
is "the" speedup — report both, labeled, every time.

- **Every wall-clock claim must state `population_size`, `n_generations`,
  and `n_match_per_eval` explicitly** (Fase 8 task 3) so a reader can
  audit the total against those parameters — a bare total-minutes number
  with no stated configuration cannot be checked or reproduced.
- **"O(1)" is never a correct description of this pipeline.** The
  surrogate's fitness evaluation is `O(P*G*d*h)`, not O(1) — it is
  constant only with respect to simulation depth (M, T), and linear (with
  a currently-small constant) in parameter dimensionality d. See
  rules_spec.md 15.1 for the exact phrasing that survives scrutiny, and
  15.2 for why the complexity figure must show a range wide enough to
  reveal the linear term's eventual rise (d=200 alone is not wide enough —
  the rise only becomes visible past d~1,000-5,000 in this repo's
  benchmark) rather than a range narrow enough to look like O(1).
- **A cost comparison between two pipelines must separately report every
  phase's wall-clock time** (`t_data_generation`, `t_surrogate_training`,
  `t_optimization`, `t_elite_verification` — Fase 8 task 1), not just a
  single end-to-end total; a reader cannot tell whether a speedup is real
  or an artifact of excluding setup cost from only one side of the
  comparison without the breakdown.

## Global sensitivity and equilibrium standard (Fase 9)

**"Isolated the exact equilibrium point" is retired.** Fase 9 found 21
distinct, comparably-balanced-but-mutually-distant parameter sets from 24
independent search restarts, and found the reference equilibrium itself
only passes its own balanced-band test 40% of the time across repeated
re-evaluation at fixed Theta (Monte Carlo noise, not perturbation). Replace
with: "identified a region of parameter space in which pairwise parity is
statistically indistinguishable from 50% (n=…, 95% CI)" — see
rules_spec.md 16.5 for the full replacement sentence.

- **A balance-sensitivity claim about "which parameters matter" requires a
  global method (Sobol and/or Morris) over the FULL parameter space, not a
  1D sweep of one parameter.** Fase 9's Sobol/Morris analysis found prana
  COST fields dominate (top 5 by both methods are all `_cost` parameters),
  not the HP/damage fields a 1D sweep would naturally focus attention on —
  a 1D sweep of any single parameter cannot surface this, or the
  substantial interaction effects found (sum of ST=3.39 vs. sum of
  S1=0.76 across 25 parameters).
- **Any parameter-space robustness claim must state whether it was tested
  under perturbation (basin of attraction) and under independent multi-start
  search (uniqueness) — these answer different questions and neither
  substitutes for the other.** Fase 9's basin is narrow (parity mostly
  breaks down by a 2-5%-of-range Gaussian perturbation); Fase 9's
  multi-start search found the equilibrium is not unique. Both are true
  simultaneously and both must be reported.
- **A "curves nearly overlap" observation must be re-verified against the
  actual data before being repeated, not assumed.** Fase 9 could NOT
  reproduce the specific "Satwika and Rajasika curves nearly coincide"
  claim under a real re-analysis (closest pair was Satwika/Tamasika,
  4.14pp; Satwika/Rajasika was the LARGEST gap, 14.15pp) — reported as a
  non-reproduction, not silently dropped or forced to match. See
  rules_spec.md 16.4.

| Claim (paper text) | Config | Runner script | Artifact (results/) | Seeds | Status |
|---|---|---|---|---|---|
| Under `SMART_START`, Rajasika beats Satwika only 2.97% of the time (Wilson 95% CI [2.74%, 3.21%], n=20000) — badly imbalanced, expected of a pre-optimization seed | `configs/exp03_balance_matrix.yaml` | `experiments/exp03_balance_matrix.py` | `results/exp03_balance_matrix.json` (`smart_start`) | 1 stream, n=20000 (Wilson CI standard, not the 10-seed standard — see note above) | verified |
| Under `data/ga_balanced_params.json`, all 9 payoff-matrix cells (marginal deviation 0.0005, pairwise deviation 0.004) fall within a few points of 50%, including all 3 mirror matches | `configs/exp03_balance_matrix.yaml` | `experiments/exp03_balance_matrix.py` | `results/exp03_balance_matrix.json` (`ga_balanced`) | 1 stream, n=20000 | verified |
| The maxent Nash mixture over {Satwika, Rajasika, Tamasika} under `ga_balanced_params.json` is not uniform (1.7% / 39.9% / 58.5%) despite every pairwise cell being within its 95% CI of 50% | `configs/exp03_balance_matrix.yaml` | `experiments/exp03_balance_matrix.py` | `results/exp03_balance_matrix.json` (`ga_balanced.nash_averaging`) | 1 stream, n=20000 per matrix cell | verified |
| Banning Satwika's `heal_bench_card` (Sabda Rahayu) changes 0 of 20,000 paired-CRN games against Tamasika (depth = 0.00pp, paired_correlation = 1.000) — the mechanic is currently dead code, not merely weak (see rules_spec.md 4.3) | `configs/exp03_balance_matrix.yaml` | `experiments/exp03_balance_matrix.py` | `results/exp03_balance_matrix.json` (`restricted_play_satwika_heal_vs_tamasika`) | 1 stream, n=20000 paired games | verified |
| Across the 9-policy population (self-play, `ga_balanced_params.json`), per-agent max \|deviation from 50%\| is >=28pp for every agent — the Fase 3 near-50% result does not generalize beyond the automatic-attack policy it was measured under (best agent: `greedy`, 28.03pp max; population deviation range 1.47pp-50.0pp) | `configs/exp04_policy_dependence.yaml` | `experiments/exp04_policy_dependence.py` | `results/exp04_policy_dependence.json` (`per_agent_max_deviation_pp`, `parity_range_pp`) | 1 stream, n=783/agent (fast agents), n=15 (`mcts_budget100`), n=3 (`mcts_budget2000`) — Wilson CI standard | verified |
| RAJASIKA_vs_SATWIKA reverses which side is favored depending on policy under identical parameters: Rajasika loses badly under 7/9 agents (e.g. `random` 6.13%, CI [4.65%, 8.03%], n=783; `dqn_25pct` 3.96%, CI [2.80%, 5.56%], n=783) but wins under 2/9 (`greedy` 59.26%, CI [55.78%, 62.65%], n=783; `scripted_aggro` 70.50%, CI [67.21%, 73.59%], n=783) — non-overlapping CIs, not sampling noise | `configs/exp04_policy_dependence.yaml` | `experiments/exp04_policy_dependence.py` | `results/exp04_policy_dependence.json` (`agents.*.cells.RAJASIKA_vs_SATWIKA`) | 1 stream, n=783/agent, Wilson CI standard | verified |
| More `TabularQLearningAgent` self-play training narrows but does not close the RAJASIKA_vs_SATWIKA gap: 3.96% (25% trained) -> 6.26% (50%) -> 11.49% (100%, 3000 games total), monotonic but still far below 50% (all n=783, Wilson 95% CIs non-overlapping across checkpoints) | `configs/exp04_policy_dependence.yaml` | `experiments/exp04_policy_dependence.py` | `results/exp04_policy_dependence.json` (`agents.dqn_25pct/dqn_50pct/dqn_100pct.cells.RAJASIKA_vs_SATWIKA`) | 1 stream, n=783/checkpoint, Wilson CI standard | verified |
| The RAJASIKA_vs_SATWIKA balance conclusion (Satwika favored) did not flip across a 6-setting reward-shaping sweep (`w2_hp_potential` in {0,0.5,1.0,2.0}, `w3_aggression_bias` in {0,0.1,0.5}), though the magnitude ranged 2.55% (CI [1.66%,3.91%]) to 43.68% (CI [40.24%,47.17%]) — see rules_spec.md 12.5 for why this is a narrower claim than "robust to reward shaping in general" | `configs/exp05_reward_sensitivity.yaml` | `experiments/exp05_reward_sensitivity.py` | `results/exp05_reward_sensitivity.json` (`settings.*.self_play.RAJASIKA_vs_SATWIKA`, `rajasika_vs_satwika_direction_flip_vs_baseline`) | 1 stream, n=783/setting, Wilson CI standard | verified |
| `TabularQLearningAgent` (baseline reward weights) beats `RandomAgent` 94.51% (CI [92.68%,95.90%], n=783) but only beats `GreedyAgent` 17.50% (CI [15.00%,20.31%], n=783) — win rate vs. a named baseline, replacing the retired "tactical accuracy" metric | `configs/exp05_reward_sensitivity.yaml` | `experiments/exp05_reward_sensitivity.py` | `results/exp05_reward_sensitivity.json` (`settings.baseline_w2_0_w3_0.vs_random_agent`, `.vs_greedy_agent`) | 1 stream, n=783/baseline, Wilson CI standard | verified |
| Elo within the population {`RandomAgent`, `GreedyAgent`, 6 reward-weight variants of `TabularQLearningAgent`} (star-topology comparison graph through the two baselines): `GreedyAgent` highest (1768.1), `w2=0.5` best DQN variant (1722.9), unshaped baseline (1439.2), `RandomAgent` lowest (932.3) | `configs/exp05_reward_sensitivity.yaml` | `experiments/exp05_reward_sensitivity.py` | `results/exp05_reward_sensitivity.json` (`elo_ratings`) | 1 stream, match log from n=783/baseline games (not independent seeds — Elo is a single sequential fit over one match log, see `src/metrics/elo.py`) | verified |
| `TabularQLearningAgent`'s win rate vs. `RandomAgent` is flat across training (95.0% at 0 games trained, CI across seeds [94.2%,95.9%], vs. 91.0% at 3000 games, CI [84.0%,98.0%]) — a ceiling effect from an untrained agent's "always attack" tie-break default already beating `RandomAgent`, not evidence against learning (Q-table size still grows monotonically, mean final size 1222.8) | `configs/exp05_learning_curve.yaml` | `experiments/exp05_learning_curve.py` | `results/exp05_learning_curve.json` (`band_across_seeds`, `final_table_size`) | 10 seeds (Aturan Main >=10-seed standard for run-to-run training variance) | verified |
| The MLP deep ensemble beats the constant predictor (w_hat=50.0) by a bootstrap-significant margin (ID: 95% CI on MAE diff [10.14,12.09]; OOD: [1.71,5.86], n_boot=3000) but loses to a from-scratch gradient-boosting baseline on both splits (ID MAE 5.24 vs MLP 9.01; OOD MAE 30.46 vs MLP 32.55) | `configs/exp06_surrogate_validation.yaml` | `experiments/exp06_surrogate_validation.py` | `results/exp06_surrogate_validation.json` (`results.id_test`, `results.ood_test`) | 1 stream, n=80 ID-test / 80 OOD-test design points, 150 games/matchup/point | verified |
| Splitting a surrogate dataset by match instead of by design point makes an identical linear-regression model look 1.40 MAE-points better than it honestly is, scored on the same 20 held-out design points (point-level split MAE=9.00 vs. match-level-split MAE=7.60); 20/20 nominally held-out points had a sibling replicate leak into the match-level training set | `configs/exp06_surrogate_validation.yaml` | `experiments/exp06_surrogate_validation.py` | `results/exp06_surrogate_validation.json` (`leakage_demo`) | 1 stream, n=100 design points x 4 replicates + 1 truth label each | verified |
| The MLP deep ensemble's uncertainty is poorly calibrated: CDF-quantile reliability curves are flat around 0.45-0.58 (both ID and OOD) instead of tracking the diagonal, across 19 nominal levels p in [0.05,0.95] | `configs/exp06_surrogate_validation.yaml` | `experiments/exp06_surrogate_validation.py` | `results/exp06_surrogate_validation.json` (`results.id_test.calibration`, `results.ood_test.calibration`) | 1 stream, n=80 ID-test / 80 OOD-test points | verified |
| A surrogate-assisted EA with proper model management (EI infill, periodic real-simulator re-validation, online retraining) reaches a final real-simulator-verified loss of 176.75 (n=20000/matchup), ~10x better than a naive frozen-surrogate GA's 1748.86 under a comparable real-evaluation budget (155 vs 50 real design points) | `configs/exp06_surrogate_assisted_ea.yaml` | `experiments/exp06_surrogate_assisted_ea.py` | `results/exp06_surrogate_assisted_ea.json` (`managed_loop.final_verified_*`, `naive_frozen_surrogate_ga.final_verified_*`) | 1 stream, final claim at n=20000 (N_MATCH standard); in-loop checkpoints at n=150-150, not citable on their own (see next row) | verified |
| The surrogate-assisted loop's own in-loop "best true loss" tracker (n=150/matchup) reported 39.56 for its eventual best candidate throughout generations 0-59, but the SAME candidate verified at n=20000 scored 176.75 — an in-loop noisy-selection artifact, not a contradiction, because the final claim above uses only the n=20000 number | `configs/exp06_surrogate_assisted_ea.yaml` | `experiments/exp06_surrogate_assisted_ea.py` | `results/exp06_surrogate_assisted_ea.json` (`managed_loop.history`, `managed_loop.final_verified_loss`) | 1 stream | verified |
| `hybrid_ga_pso` does not beat `ga_only` on identical budget=300 evaluations: mean 25.55 vs. 41.82, Wilcoxon signed-rank p=0.7652, rank-biserial r=+0.081 (n=20 seeds) — the "hybrid" framing is retracted per this phase's pre-agreed acceptance criteria, not requalified | `configs/exp07_optimizer_ablation.yaml` | `experiments/exp07_optimizer_ablation.py` | `results/exp07_optimizer_ablation.json` (`acceptance_criterion_hybrid_vs_ga_only`) | 20 seeds | verified |
| Across all 6 optimizers (ga_only, pso_only, hybrid_ga_pso, random_search, cma_es, bayesian_optimization) at budget=300: pso_only lowest mean (16.44, CI [9.99,22.89]); pso_only/hybrid_ga_pso/ga_only/cma_es all significantly beat random_search and bayesian_optimization (p<0.01, \|r\|>0.7) but are mutually statistically indistinguishable from each other; bayesian_optimization does not beat random_search (p=0.9553) | `configs/exp07_optimizer_ablation.yaml` | `experiments/exp07_optimizer_ablation.py` | `results/exp07_optimizer_ablation.json` (`summary`, `pairwise_wilcoxon`) | 20 seeds | verified |
| GA/PSO/Hybrid/CMA-ES converge within ~50-80 of 300 evaluations; random_search and bayesian_optimization (fixed-kernel-hyperparameter GP) do not converge within the same budget — "rapid convergence" must be scoped to the first four methods, not asserted as a blanket property | `configs/exp07_optimizer_ablation.yaml` | `experiments/exp07_optimizer_ablation.py` | `results/exp07_optimizer_ablation.json` (`convergence_curves`) | 20 seeds | verified |
| NSGA-II on 3 separate objectives (pairwise balance deviation, power creep penalty, -faction identity index) produces a genuine 13-solution Pareto front (not a single point) with a real trade-off between balance and identity: best-balance solution (F1=250.60) has the worst identity score of the front (F3=-0.312), while worse-balance solutions reach F3=-0.482 | `configs/exp07_nsga2_power_balance.yaml` | `experiments/exp07_nsga2_power_balance.py` | `results/exp07_nsga2_power_balance.json` (`pareto_front`, `objective_ranges`) | 1 stream, pop_size=40/generations=40 search + n=500 final re-validation | verified |
| Frozen-surrogate pipeline phase breakdown (population_size=12, n_generations=30, n_match_per_eval=60, dataset_size=200): t_data_generation=6.61s, t_surrogate_training=1.19s, t_optimization=0.04s, t_elite_verification=0.97s, total=8.82s, vs. pure Monte Carlo (same budget) 12.58s | `configs/exp08_cost_accounting.yaml` | `experiments/exp08_cost_accounting.py` | `results/exp08_cost_accounting.json` (`surrogate_pipeline`, `pure_monte_carlo`) | 5 repetitions | verified |
| Per-evaluation speedup (surrogate vs. real simulator, marginal cost only, trained surrogate assumed free) = 354.4x; amortized speedup (full pipeline incl. one-time setup) = 7.0x at N=10 re-balancing runs; break-even point N*=0.67 runs — replaces the unqualified "94.2% speedup" claim with both numbers, explicitly labeled | `configs/exp08_cost_accounting.yaml` | `experiments/exp08_cost_accounting.py` | `results/exp08_cost_accounting.json` (`per_evaluation_speedup`, `amortized_speedup_at_10_runs`, `break_even_num_runs`) | 5 repetitions | verified |
| Surrogate evaluation cost is NOT O(1): flat from d=4 to d=200 (1.19x the d=4 cost, i.e. the task-specified extension is still indistinguishable from flat) but rises to 30.1x by d=50,000, first exceeding 2x baseline at d=5,000 — replaces the "O(1)" claim with O(P*G*d*h), constant only in simulation depth (M,T) | `configs/exp08_dimension_scaling.yaml` | `experiments/exp08_dimension_scaling.py` | `results/exp08_dimension_scaling.json` (`surrogate_costs_seconds`, `ratio_dmax_to_d4`, `first_d_exceeding_2x_baseline`) | median of 7 timing blocks x 2000 reps/point | verified |
| Sobol/Morris global sensitivity over all 25 parameters: top-5 by both methods are prana-cost fields (`tms_duryodana_angkara_cost`, `rjs_karna_cost`, `rjs_balarama_cost`, `stw_yudhistira_cost_univ`, `tms_sengkuni_cost_univ`/`rjs_karna_dmg`), not HP/damage; sum of ST (3.39) far exceeds sum of S1 (0.76) across 25 params, indicating substantial interaction effects a 1D sweep cannot see | `configs/exp09_sensitivity_indices.yaml` | `experiments/exp09_sensitivity_indices.py` | `results/exp09_sensitivity_indices.json` (`sobol`, `morris`, `sobol_ranked_by_ST`, `morris_ranked`) | Sobol n_samples=150 (4050 evals), Morris n_trajectories=30 (780 evals), n_runs_per_eval=100 | verified |
| Basin of attraction around `ga_balanced_params.json`: even at zero perturbation, only 40% of re-evaluations pass the +-10pp balanced-band test (n=25, mean loss 215.16 CI [161.7,268.6]) due to Monte Carlo noise alone; fraction still balanced drops to 8% by 2%-of-range Gaussian noise and 0% by 5% | `configs/exp09_equilibrium_robustness.yaml` | `experiments/exp09_equilibrium_robustness.py` | `results/exp09_equilibrium_robustness.json` (`part_a_basin_of_attraction`) | 25 samples/noise-level x 10 levels, n_runs=100/sample | verified |
| Multi-start optimization (24 independent GA runs, random initial populations, budget=300): 21 distinct equilibria found (Union-Find clustering, threshold=0.12 normalized RMS distance), final losses comparable across clusters (2.78-338.61) — the "golden equilibrium" is not unique; mean normalized distance from these runs' final points to `ga_balanced_params.json` = 0.54 | `configs/exp09_equilibrium_robustness.yaml` | `experiments/exp09_equilibrium_robustness.py` | `results/exp09_equilibrium_robustness.json` (`part_b_multistart`) | 24 independent starts, budget=300, n_runs=60/eval | verified |
| Karna HP sweep (rjs_karna_hp in [70,110], n=300/point, Wilson 95% CI, baseline=ga_balanced_params.json): control check (SATWIKA_vs_TAMASIKA, unaffected by Karna) ranges 8.0pp from noise alone; closest-overlapping per-faction marginal pair is SATWIKA/TAMASIKA (4.14pp), NOT Satwika/Rajasika (14.15pp, the largest gap) — the originally-reported near-overlap could not be reproduced under this baseline | `configs/exp09_karna_hp_ci.yaml` | `experiments/exp09_karna_hp_ci.py` | `results/exp09_karna_hp_ci.json` (`matchup_win_rates`, `faction_marginal_win_rates`, `marginal_pairs_mean_abs_diff_pp`) | 1 stream, n=300/point, Wilson CI standard | verified |

## Status legend

- `planned` — config exists, runner does not yet.
- `running` — runner exists, artifact not yet generated/committed.
- `verified` — artifact exists, was generated with >=10 seeds, and the number
  in the paper matches the artifact exactly.
- `retracted` — claim removed from the paper because it could not be verified.

## Process

1. Before writing a claim into the paper, add a row here first (status `planned`).
2. Implement the runner + config, run it, commit the resulting `results/*.json`.
3. Update the row to `verified` and copy the exact mean +/- 95% CI into the
   paper text — do not paraphrase or round beyond what the artifact reports.
4. If a runner can't be built or its result contradicts the intended claim,
   set status to `retracted` and remove the claim from the paper in the same
   commit.

## Diagnostics (not paper claims)

Simulator-fidelity QA checks that inform decisions in `src/simulator/rules_spec.md`
but are not themselves paper results, so they don't get a row above. They
still follow the "real script + real artifact, no hardcoded numbers" rule —
just not the >=10-seed / mean+-CI bar, since they're not being cited as a
finding.

- `experiments/exp00_threshold_nonlinearity.py` -> `results/exp00_threshold_nonlinearity.json`
  (single seed, 150 games/point). Checked whether win-rate vs. Karna HP is
  suspiciously linear. R^2 ~0.85 on a straight-line fit, with visible
  non-monotonic noise — not perfectly linear, no sharp step/threshold jumps
  either. See rules_spec.md section 5 for interpretation. If this needs to
  become a paper claim later, rerun across >=10 seeds first.
