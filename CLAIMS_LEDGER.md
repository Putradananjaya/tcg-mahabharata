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

| Claim (paper text) | Config | Runner script | Artifact (results/) | Seeds | Status |
|---|---|---|---|---|---|
| Under `SMART_START`, Rajasika beats Satwika only 2.97% of the time (Wilson 95% CI [2.74%, 3.21%], n=20000) — badly imbalanced, expected of a pre-optimization seed | `configs/exp03_balance_matrix.yaml` | `experiments/exp03_balance_matrix.py` | `results/exp03_balance_matrix.json` (`smart_start`) | 1 stream, n=20000 (Wilson CI standard, not the 10-seed standard — see note above) | verified |
| Under `data/ga_balanced_params.json`, all 9 payoff-matrix cells (marginal deviation 0.0005, pairwise deviation 0.004) fall within a few points of 50%, including all 3 mirror matches | `configs/exp03_balance_matrix.yaml` | `experiments/exp03_balance_matrix.py` | `results/exp03_balance_matrix.json` (`ga_balanced`) | 1 stream, n=20000 | verified |
| The maxent Nash mixture over {Satwika, Rajasika, Tamasika} under `ga_balanced_params.json` is not uniform (1.7% / 39.9% / 58.5%) despite every pairwise cell being within its 95% CI of 50% | `configs/exp03_balance_matrix.yaml` | `experiments/exp03_balance_matrix.py` | `results/exp03_balance_matrix.json` (`ga_balanced.nash_averaging`) | 1 stream, n=20000 per matrix cell | verified |
| Banning Satwika's `heal_bench_card` (Sabda Rahayu) changes 0 of 20,000 paired-CRN games against Tamasika (depth = 0.00pp, paired_correlation = 1.000) — the mechanic is currently dead code, not merely weak (see rules_spec.md 4.3) | `configs/exp03_balance_matrix.yaml` | `experiments/exp03_balance_matrix.py` | `results/exp03_balance_matrix.json` (`restricted_play_satwika_heal_vs_tamasika`) | 1 stream, n=20000 paired games | verified |

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
