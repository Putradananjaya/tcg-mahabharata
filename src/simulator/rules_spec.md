# Simulator Rules Specification (Appendix A)

Formal specification of the game rules implemented by `src/simulator/engine.py`,
`src/simulator/fitness.py`, and `src/domain/models.py`. This document is the
source of truth for what the engine *does*; every statement below was checked
directly against that code (and, where noted, against the interactive
TypeScript dashboard at `dashboard/src/app/data/repositories/battle-simulator.impl.ts`)
on 2026-08-01, not inferred from design intent. Anything the engine does not
implement is called out explicitly as **Not implemented** rather than assumed.

Canonical faction names used throughout this document and in all technical
labels (code identifiers, CSV/JSON output, figure legends): **Satwika,
Rajasika, Tamasika**. "Pandawa" and "Kurawa" are narrative house names for the
Satwika- and Tamasika-aligned sides respectively; they may appear in flavor
text (card names, UI copy) but must never appear on the same figure axis,
legend, or matchup table as "Rajasika" — see section 5.2.

## 1. Turn structure

### 1.1 Setup phase (`Player.setup_phase`, `Player.play_basic_to_active`, `Player.play_basic_to_bench`)

1. Each player draws 7 cards from their shuffled deck into `hand` (`draw_card(7)`).
2. Each player places one Basic-stage "Tokoh" (character) card from hand as
   their `active_character`. Selection is **not random**: `Yudhistira`,
   `Patih Sengkuni`, and `Karna` are checked first, in that fixed priority
   order, and the first one found in hand is played; if none of those three
   are in hand, the first Basic-stage Tokoh card found (in hand-list order)
   is played instead.
3. Each player then places every remaining Basic-stage Tokoh card from hand
   onto their `bench`, up to a hard cap of 5 bench slots. Cards beyond the
   cap, and any non-Basic/non-Tokoh cards, stay in `hand` and are never used
   again (see 1.4).
4. **Mulligan: not implemented.** There is no re-draw for a hand with zero
   Basic-stage characters. This is currently unreachable with the shipped
   decks (`data/satwika.json`, `data/rajasika.json`, `data/tamasika.json`),
   because every card in every deck is a Basic-stage Tokoh card (see 1.4) —
   any 7-card draw guarantees at least one. It would surface as a silent
   soft-lock (see 1.5) the moment a deck includes a non-Basic or non-Tokoh
   card and a bad draw is possible.

### 1.2 Main loop (`run_logged_simulation` in `engine.py`, mirrored in `fitness.py`'s `run_simulation`/`run_simulation_multi`)

1. A coin toss (`random.shuffle([p1, p2])`) picks `first_player` once, at the
   start of the match.
2. **`first_player` acts first on every subsequent turn, not just turn 1.**
   The loop is `while turn <= 100: first_player acts; (if game not over) second_player acts; turn += 1`.
   There is no alternation of who moves first. This is a real, structural
   first-mover advantage for the entire match, not just an opening-turn
   edge — worth accounting for explicitly in any balance analysis (e.g. as a
   control variable, or by running every matchup both ways and averaging).
3. Each player's "act" is: `attach_prana()` then `attack(opponent)` (2.2, 4).
   There is **no separate draw step per turn** — see 1.4.
4. The match ends the instant either player's `attack()` call returns
   `"GAME_OVER"` or `"GAME_OVER_SUICIDE"` (see 3).
5. **Turn cap: 100.** If neither player has won by turn 100, the match ends
   with no `winner` from the loop itself; a tie-break rule decides (1.6).

### 1.3 Prana curve

**Not meaningful with the current card pool.** Each faction deck
(`data/{satwika,rajasika,tamasika}.json`) contains exactly 2 unique cards,
each duplicated 20x (`copies=20` default), for a 40-card deck. A "curve"
normally describes the cost distribution across a large, varied card pool;
with 2 unique cards per faction this reduces to: each faction's 2 characters
have attacks costing 1-3 Prana (see 4.1 for the full cost table). There is no
deck-building or hand-management decision around cost curve in the current
implementation.

### 1.4 No per-turn draw / no card-play beyond setup

After setup (1.1), `hand` is never touched again by the core loop — no
"draw for turn," no playing new cards from hand, no evolving/upgrading the
active or bench characters. The entire rest of the match plays out through
`attach_prana` + `attack` using only the characters already placed at setup.
The `deck` list is only touched via the `mill_enemy_deck` effect (4.3), which
moves cards from the **opponent's** deck to their discard pile — a player's
own deck size never decreases except through being milled by the opponent.
`card_repository.py`'s extra cards (Gatotkaca, Bhishma Pitamaha, Abimanyu,
Drona, Kresna) are not referenced by any of the three faction deck JSONs and
are not currently playable through this pipeline (see 4.4 for a related gap).

### 1.5 Soft-lock case

If `play_basic_to_active` returns `False` (no Basic Tokoh in the initial
7-card hand), `active_character` stays `None`. `Player.attack()` returns
`False` immediately when `active_character` is `None`, so that player takes
no further action for the rest of the match — there is no mechanism to
recover once this happens. As noted in 1.1, this cannot currently occur with
the shipped decks; it is a latent gap if the card pool is ever expanded to
include multi-stage or non-Tokoh cards.

### 1.6 Turn-cap tie-break

If turn 100 is reached with no `GAME_OVER`, the winner is decided by
comparing the two active characters' current HP (`p1.active_character.current_hp`
vs `p2`'s; a player with no active character defaults to 0). Higher HP wins;
`engine.py`'s tie-break defaults to `faksi_1_name` on an exact tie (`hp1 >= hp2`).

## 2. Deck & hand

- Deck size: 40 cards (2 unique x 20 copies), no duplicate-count limit is
  enforced beyond what `copies=20` produces.
- Starting hand: 7 cards, no further draws (1.4).
- Bench cap: 5 characters.
- `retreat_cost` **is defined on every card but is not used by the core
  engine.** There is no retreat/switch-active action in `Player`/`engine.py`.
  (The RL self-play code in `src/agents/dqn_agent.py` has an ad-hoc bench-swap
  action that ignores `retreat_cost` entirely — see 6.3. The interactive
  dashboard's TypeScript simulator also does not charge `retreat_cost`.)

## 3. Win conditions

Two independent ways a match ends in `GAME_OVER`, both driven by
`Player.check_knockout`:

1. **Sasmita depletion.** See 5.1 for the exact accounting. A player wins
   when their own `sasmita` counter reaches 0.
2. **Bench exhaustion.** If a player's active character is knocked out and
   their bench is empty, the match ends immediately in the opponent's favor
   *regardless of the opponent's remaining Sasmita*. This mirrors the
   standard Pokemon-TCG-style rule ("no more characters to send out = you
   lose even with prizes remaining") and is intentional, not a bug — but it
   is a second, independent termination condition that must be documented
   alongside Sasmita, not folded into it.
3. **`"GAME_OVER_SUICIDE"`**: if an attack's own side-effect (currently only
   `recoil_damage`, 4.3) drops the *attacker's own* active character to 0 HP
   in the same action where they also knocked out the defender's active
   character, `Player.attack()` runs `check_knockout` a second time with
   attacker and defender swapped — crediting the **defender** with the KO
   caused by the attacker's self-inflicted damage. This is a real, if
   non-obvious, rule: recoiling yourself to death hands the opponent a prize,
   exactly as if they'd landed the hit.
4. Turn-cap tie-break: see 1.6 (not a `GAME_OVER`, a fallback when the loop
   exits without one).

## 4. Combat resolution

### 4.1 Attack selection (`Player.attack`)

Not chosen by the player/agent — the engine picks automatically:

1. Sort the active character's `attacks` by `base_damage` descending.
2. If the highest-damage attack is affordable (`can_afford`, 4.2), use it.
3. Otherwise, if the active character is in **panic** (`current_hp <= 0.4 * hp`,
   i.e. at or below 40% of *max* HP, not the fixed HP buckets used elsewhere —
   see 6.1), try each attack in descending-damage order and use the first
   affordable one.
4. If neither applies (not panic, and the best attack isn't affordable), the
   player takes no action that turn — `attack()` returns `False`. Prana was
   still attached before this check, so it carries over to next turn.

### 4.2 Prana economy (`attach_prana`, `can_afford`, `pay_prana`)

- Each `attach_prana()` call adds exactly 1 Prana of one type to `prana_pool`.
  The type is derived automatically: scan the active character's `attacks`
  in order, and within each attack's `prana_cost` dict, take the first
  non-`"Universal"` key found; stop at the first attack that has one. In
  practice, for the current 1-2-attack cards, this deterministically resolves
  to the character's own alignment type.
- `can_afford`: non-Universal cost types must be covered exactly by the
  matching pool; any remaining `Universal` cost is covered by whatever total
  pool is left over after that (type-agnostic).
- `pay_prana` spends the same way: exact-type costs first, then drains
  `Universal` cost from any non-empty pool bucket (iteration order = dict
  insertion order, i.e. `Satwika`/`Tamasika`/`Rajasika`/`Universal` as first
  attached).

### 4.3 Damage & effect resolution order

Within a single `attack()` call, in this order:

1. Compute `base_damage` of the chosen attack.
2. Add bonus damage terms, computed inline (not via the effect table below):
   - `bench_scaling`: `+min(len(self.bench) * 5, 15)`.
   - `scaled_damage_per_discard_tamasika`: `+len(opponent.discard_pile) * scale_value`.
3. Subtract defender's flat `damage_reduction` (default 0), floored at 0:
   `final_damage = max(0, base + bonuses - defender.damage_reduction)`.
4. Apply `final_damage` to the defender's active character's `current_hp`.
5. Resolve the attack's named side-effect via `trigger_attack_effect`
   (separate from the inline bonus-damage terms above):

   | `effect` string | Behavior |
   |---|---|
   | `mill_enemy_deck` | Move `value` cards from **opponent's** deck to their discard pile. |
   | `heal_bench_card` | **Mathematically a no-op as of this review.** Picks a **random** (`random.choice`, not filtered for "damaged") bench card and heals `min(value, target.hp - target.current_hp)`. Nothing else in `models.py` ever reduces a bench character's `current_hp` (damage only ever applies to `active_character` — see 2, and confirmed by grep: the only writes to a bench member's `.current_hp` are its initialization at full HP and this heal itself). So `target.hp - target.current_hp` is always 0, `heal_amount` is always `min(value, 0) = 0`, regardless of `value`. Verified empirically in `experiments/exp03_balance_matrix.py`'s restricted-play run: banning this effect changes zero games out of 20,000 paired comparisons (depth = 0.00pp exactly, paired_correlation = 1.000 — not sampling noise, a deterministic tie). Satwika's flagship heal mechanic (`stw_yudhistira_heal` parameter) currently does nothing in play; any GA/PSO run tuning that parameter is tuning a dead variable. |
   | `recoil_damage` | Subtract flat `value` HP from the **attacker's own** active character. Can trigger the suicide case (3.3). |
   | anything else (`None`, `"lifesteal"`, ...) | **No-op.** `trigger_attack_effect` only recognizes the three effects above; any other string (e.g. `"lifesteal"`, defined on `card_repository.py`'s Gatotkaca but that card isn't in any playable deck — see 1.4) silently does nothing. |
6. Check for knockout / suicide (3).

### 4.4 Known Python engine <-> TypeScript dashboard divergence

The interactive dashboard (`battle-simulator.impl.ts`) is a **separate,
independent reimplementation** of combat, not a client of the Python engine.
As of this review it diverges in ways beyond naming:

- It implements `lifesteal` (heal attacker by 50% of net damage dealt) and
  `poison_recoil` (recoil as a % of net damage dealt) — neither exists in the
  Python engine's `trigger_attack_effect`, which only knows flat
  `recoil_damage` and has no lifesteal handling at all.
- Its mill effect is keyed as `'mill'`; the Python engine's is
  `'mill_enemy_deck'` — different string identifiers for the same concept, so
  a card authored for one engine's effect table is a silent no-op on the
  other.
- `runBatchSimulation` in the TS file adds a +/-10% damage variance the
  Python engine does not have.

None of this was in scope to reconcile in this pass (Phase 1 targets the
Python research simulator specifically); it's recorded here so a future
"engine parity" pass has a concrete list instead of having to rediscover it.

### 4.5 Mirror-match win identification is broken by name collision

`run_simulation`, `run_simulation_multi`, and `run_logged_simulation` all
identify the winner by comparing **name strings**
(`winner = first_player.name if res == "GAME_OVER" else second_player.name`,
then compared against the caller's `name1`/`name2` arguments), never by
object identity or call-argument position. This works for any two
differently-named calls, but is silently wrong for a **mirror match** (same
faction played against itself, e.g. evaluating `SATWIKA_vs_SATWIKA` for a
payoff matrix diagonal, section 5.2): if both `Player` instances are
constructed with the same name, the returned winner string is always equal
to both `name1` and `name2` regardless of which physical player object
actually won.

Confirmed by direct test (`run_simulation_multi(satwika, satwika, "SATWIKA",
"SATWIKA")` 20 times, one seeded run): all 20 results reported `"SATWIKA"` as
the winner — a 100% "win rate," which is not a real result, just this
name-collision artifact. There is currently no code path in `src/` that runs
mirror matches except `experiments/exp03_balance_matrix.py`, which works
around it locally (passing temporary distinct labels like `"SATWIKA__A"` /
`"SATWIKA__B"` for the two sides of a mirror match and mapping back
afterward) rather than changing the engine. Any future code that runs a
faction against itself needs the same workaround, or the engine's win
identification needs to change to something position-based
(`first_player is p1` rather than `first_player.name == name1`) — flagged
here rather than fixed silently, since it's a real behavior change to
shared simulator code.

## 5. Terminology

### 5.1 Sasmita — canonical definition

**Sasmita = prize-card count**, starting at 3 for each faction, **not** a
life total. Before this review, the codebase had three different
implementations of this in force at once — decided and reconciled here:

- Each `Player` starts with `sasmita = 3`.
- **Every time you knock out the opponent's active character** (by dealing
  the finishing damage, or via the suicide case in 3.3), **your own**
  `sasmita` decreases by 1 — you are claiming one of your 3 prizes.
- A faction wins when **their own** Sasmita reaches 0 (all 3 prizes
  claimed), or when the opponent has no bench character left to send out (3.2).
- Equivalently, from a single player's perspective: your Sasmita only ever
  goes down, and it goes down because of something *you* did (landed a KO),
  not because of something that happened *to* you.

This matches `Player.check_knockout` in `src/domain/models.py` exactly (the
attacking player's own `sasmita` is decremented on landing a KO) and is now
also what `dashboard/src/app/data/repositories/battle-simulator.impl.ts`
implements, after this review (`checkKnockouts()` and `runBatchSimulation()`
previously decremented the *victim's* own Sasmita and declared the *victim*
the loser at 0 — a life-total model, the exact opposite direction). The
dashboard's prose (guide/flow/simulator components' glossary text) was also
rewritten to match; it previously described the life-total model even in
places labeled "(Prize Cards)".

Any figure, table, or UI element that shows Sasmita must use this definition
and the range 0-3. Do not reuse the label "Sasmita" for anything else
(HP, damage, etc.) — the dashboard's power-spike chart used to label its
y-axis "Remaining Sasmita (Faction HP)", which reads as if Sasmita and HP
were interchangeable; the "(Faction HP)" qualifier has been removed (it
was a labeling artifact, not evidence of a second underlying metric — the
charted data was confirmed to be the real 0-3 Sasmita series both before
and after the fix).

### 5.2 Faction naming scheme

Two independent naming schemes exist for the same three factions:

- **Alignment names** (canonical, used in all technical/data contexts):
  `Satwika`, `Rajasika`, `Tamasika`.
- **Narrative house names** (lore/flavor only): `Pandawa` (= Satwika-aligned
  side), `Kurawa` (= Tamasika-aligned side). Rajasika has no distinct house
  name in the current lore/data.

Rule: **alignment names only** in anything that is a figure axis, chart
legend, matchup key, CSV column, or JSON field — anywhere Rajasika might
plausibly appear alongside the other two. `Pandawa`/`Kurawa` may still be
used in narrative prose or as a parenthetical gloss (e.g. a UI dropdown
option labeled `"Satwika (Pandawa)"`), but never as the *only* identifier
standing in for a faction next to `Rajasika` in the same output. Card/attack
*names* (e.g. the Tamasika attack literally called "Angkara 100 Kurawa") are
narrative flavor text, not technical labels, and are unaffected by this rule.

Confirmed, fixed instances of this rule being violated before this review:
`src/simulator/fitness.py`'s matchup labels (`PANDAWA_vs_KURAWA` etc., used
by every GA/PSO/NSGA2/surrogate run), `src/infrastructure/analysis/academic_tests.py`'s
`figures/sensitivity_analysis.png` legend, and the dashboard's power-spike
chart legend/series names. See section 7 for the current repo-wide grep audit.

## 6. RL state vector (Equation 1) — POMDP observation, not full state

`src/agents/dqn_agent.py`'s `QLearningAgent.get_state(player, opponent, is_first_mover)`
returns a 10-field tuple. **This is an observation, not the environment's
full state** — the game is a **POMDP** (partially observable Markov decision
process): a real player cannot see the opponent's hand contents, deck order,
or the private RNG draws the engine uses internally (e.g. `heal_bench_card`'s
random bench target, 4.3). The simulator's Python objects happen to expose
all of this to both sides equally (both `Player` instances are fully
inspectable), but the state vector deliberately only reads information a real
player-facing agent could legitimately observe:

| # | Field | Range | Notes |
|---|---|---|---|
| 0 | `hp_bucket` | 0-2 | Own active character HP: <=35 / <=80 / >80. |
| 1 | `prana_bucket` | 0-1 | Own total Prana, `P_faction^(i)`: <2 / >=2. |
| 2 | `opp_prana_bucket` | 0-1 | Opponent total Prana, `P_faction^(3-i)`. Publicly observable in a physical card game (Prana counters are on the table). |
| 3 | `bench_wounded` | 0-1 | Own bench has a damaged card. |
| 4 | `deck_size_bucket` | 0-1 | Own remaining deck size: <10 / >=10. |
| 5 | `own_hand_bucket` | 0-3 | `\|Hand^(i)\|`, capped. |
| 6 | `opp_hand_bucket` | 0-3 | `\|Hand^(3-i)\|`, capped. Hand *count* is public in a physical game even though contents are private — legitimately observable under the POMDP framing. |
| 7 | `is_panic` | 0-1 | Own active character at/below the 40%-max-HP panic threshold that `Player.attack()` itself branches on (4.1) — the only persistent status-like flag this engine currently has. |
| 8 | `sasmita_bucket` | 0-3 | Own Sasmita (5.1). |
| 9 | `turn_parity` | 0-1 | 1 if this player has initiative this turn (acts first) — see 1.2 for why this matters every turn, not just turn 1. |

**No other persistent status effects exist to flag.** Every effect in 4.3 is
instantaneous (resolved fully within the `attack()` call that triggered it);
there is no multi-turn buff/debuff/poison-over-time state in the engine, so
field 7 is the only meaningful "status flag" available today. If persistent
effects are added later, they belong in this vector as additional flags, not
folded into `is_panic`.

## 7. Grep audit for mixed faction-naming labels

As of this review, `grep -rniE "pandawa|kurawa" --include=*.py --include=*.ts` repo-wide
still returns hits outside `src/`, `experiments/exp*.py`, `scripts/`, and this
spec — all in `dashboard/`'s internal API surface, e.g.
`balance-optimizer.service.ts`'s `getPandawaDeck()`/`getKurawaDeck()` methods
coexisting with its newer `getDeckByFaction('SATWIKA'|'RAJASIKA'|'TAMASIKA')`,
and `optimizer.component.ts`'s custom-card-faction dropdown (`'PANDAWA'|'KURAWA'`
only — no Rajasika option, because `balance-optimizer.impl.ts` stores Rajasika
cards inside the same array as Tamasika cards, filtered out by ID prefix).
These are internal-API and data-model duplication in the interactive
dashboard, not figure/output labels, and were left alone in this pass —
flagged here as a known follow-up rather than silently fixed or silently
ignored.

## 8. Open questions for the paper

- The permanent first-mover advantage (1.2) should probably be either
  addressed (alternate initiative each turn) or explicitly controlled for
  (report matchup win rates as an average of both initiative assignments) —
  right now a single coin toss at match start silently advantages one side
  for the whole game, which will bias every win-rate number reported.
- `retreat_cost` is defined on every card but unused (2) — decide whether
  retreat is an intended mechanic before citing card `retreat_cost` values as
  meaningful design parameters anywhere in the paper.
- Section 4.4's Python/TS divergence means any claim about "the simulator"
  needs to say which one; they are not currently interchangeable.

## 9. Balance metrics findings (Fase 3)

From `experiments/exp03_balance_matrix.py` (full 3x3 payoff matrix,
N_MATCH=20000/cell, run against both `SMART_START` and
`data/ga_balanced_params.json`; see `results/exp03_balance_matrix.json` and
`figures/payoff_matrix_3x3_{smart_start,ga_balanced}.png`):

- **`SMART_START` is badly imbalanced, not just "unoptimized."** Rajasika
  loses to Satwika 96.8% of the time (Wilson 95% CI [96.6%, 97.1%], n=20000)
  — this is not a subtle rock-paper-scissors-style degeneracy, it's visible
  in both the marginal win rate (Rajasika: 20% marginal vs. an ideal 50%)
  and every individual pairwise cell involving Rajasika. Expected, since
  `SMART_START` is explicitly a pre-optimization seed, but worth stating
  precisely rather than assuming "probably roughly fine."
- **`data/ga_balanced_params.json` holds up under the full matrix, not just
  the 3-matchup cycle it was optimized against.** Every one of the 9 cells
  (including all 3 mirror matches) falls within a few points of 50%, and the
  composite `balance_objective` drops from 0.652 (`SMART_START`) to 0.080.
  This is the positive result: the prior GA claim survives a strictly harder
  test than the one it was fit to.
- **The maxent Nash mixture is not uniform even when every pairwise cell is
  near 50%** (`ga_balanced`: Satwika 1.7% / Rajasika 39.9% / Tamasika 58.5%).
  Small, individually-insignificant per-cell deviations from exactly 50% can
  still add up to a non-trivial equilibrium skew — "every CI contains 50%"
  and "the Nash mixture is uniform" are different claims; don't conflate them
  in the paper.
- **Satwika's heal (`heal_bench_card` / `stw_yudhistira_heal`) has zero
  measured depth** (restricted play, n=20000 paired games, depth = 0.00pp
  exactly) because it's the dead mechanic documented in 4.3 — bench
  characters can never be damaged, so there is nothing for it to ever heal.
  This is real and reproducible, not a restricted-play methodology failure
  (`paired_correlation` = 1.000, i.e. banning it changed literally 0 of
  20,000 paired outcomes).
- **Faction Identity Index's attack-rank entropy is 0.0 for Rajasika and
  Tamasika in both parameter sets**, not because those factions lack
  identity, but because of a structural artifact of the tiny card pool (1.3,
  2): Rajasika's two cards (Balarama, Karna) each have exactly one attack,
  so "attack rank" has only one possible value for that faction by
  construction, and Tamasika's Duryodana's second attack (`Gada Kelana`,
  rank 1) is apparently never favorable enough over `Angkara 100 Kurawa`
  (rank 0) to be selected under either parameter set. Read this diversity
  axis as "does this faction have any within-card attack variety to show"
  (mostly no, given 2 cards/faction), not as a general claim about
  strategic depth.

## 10. Agent-controllable play (Fase 4)

Every prior section describes `Player.attack()`'s **automatic** attack
selection (4.1: highest-damage affordable attack, panic fallback
otherwise) — until this phase, nothing in `src/` actually let an external
decision-maker choose differently, despite `src/agents/*` existing since the
Fase 0 scaffold. This phase makes that real:

- `Player.attack(opponent, forced_attack=None)` gained an optional
  parameter (`src/domain/models.py`): pass a specific entry from the active
  character's own `attacks` list to use it instead of the automatic
  selection. `forced_attack=None` (the default, used by every pre-existing
  caller: `engine.py`, `fitness.py`, `academic_tests.py`, `dqn_agent.QLearningAgent`)
  reproduces the exact original behavior byte-for-byte — this was a
  purely-additive change, re-verified against `fitness.evaluate_chromosome`
  after making it.
- `src/simulator/agent_env.AgentGameEnv` is the actual environment: same
  setup phase, same attach_prana-then-act turn structure and fixed
  first-mover-every-turn rule as 1.1-1.2, but each turn asks an
  `src.agents.base.Agent` to pick from `legal_actions()` — either
  `Action("ATTACK", i)` (must be affordable) or `Action("SWITCH", j)`
  (retreat to bench member `j`, ending the turn without attacking, no
  `retreat_cost` charged — matching 2's finding that `retreat_cost` is
  unused by the core engine; this environment doesn't invent a cost that
  isn't in the canonical rules). Win/loss is tracked by which **side**
  (not name string) triggered `GAME_OVER`/`GAME_OVER_SUICIDE` — see 4.5 for
  why name-based tracking would be wrong here too (mirror matches).
- Deliberately a different, finer action space than
  `src.agents.dqn_agent.QLearningAgent`'s older 3-macro-action space
  (Attack/Heal/Switch) from the original RL self-play code: that space's
  "Heal" action is dead code given 4.3 (bench characters can never be
  damaged) and its "Attack" action was never actually agent-controlled
  (always went through the automatic selection this phase's `forced_attack`
  now lets you bypass). `src.agents.dqn_agent.TabularQLearningAgent` is a
  second, separate Q-learning implementation built for this new action
  space; the original `QLearningAgent`/`play_rl_game`/`run_rl_self_play`
  are untouched and still valid for whatever they were being used for.
- **MCTS compute cost, measured on this machine** (`src/agents/mcts_agent.py`,
  UCT with real `AgentGameEnv.clone()` per simulation, rollout depth capped
  at 10 ply with a heuristic value at cutoff — a full rollout to natural
  game-end was not tractable, see that module's docstring): ~7.9s per
  complete game at `budget=100`, ~162s per complete game at `budget=2000`
  (dominated by `clone()` at ~0.47ms each, not the rollout steps
  themselves). This is why `experiments/exp04_policy_dependence.py` uses far
  fewer games/cell for MCTS than for the other 7 agents — see section 11 and
  the artifact for the exact n used per agent, never assume it's uniform.

## 11. Policy-dependence of balance (Fase 4 findings)

From `experiments/exp04_policy_dependence.py` (self-play per agent — both
sides of every matchup controlled by the same policy — against
`data/ga_balanced_params.json`, the parameter set section 9 found "balanced"
under `Player.attack()`'s automatic selection; 9 agents x 3 faction pairs; n
calibrated per agent as documented in section 10 — 783 games/cell for the 7
fast agents via `required_n(delta=0.05)`, 15/cell for `mcts_budget100`,
3/cell for `mcts_budget2000`; full numbers with Wilson 95% CIs in
`results/exp04_policy_dependence.json`, heatmap in
`figures/policy_dependence_heatmap.png`, titled "Balance is
policy-dependent" since the max deviation cleared the 10pp threshold set in
that script):

- **Section 9's near-50% balance claim does not generalize across policies.**
  Deviation from 50% ranges from 1.47pp (`scripted_control`,
  SATWIKA_vs_TAMASIKA: 51.47%, CI [47.97%, 54.95%], n=783) to 50.0pp (both
  MCTS agents, RAJASIKA_vs_SATWIKA: 0.00% observed, n=15 and n=3
  respectively) across the 9-agent x 3-pair grid. Per-agent max |deviation
  from 50%| is >=28pp for every single one of the 9 agents tested — even the
  best-behaved agent (`greedy`, 28.03pp max) is far outside anything section
  9 would have called balanced.
- **RAJASIKA vs SATWIKA flips which side is favored depending on policy, not
  just by how much.** Under 7 of 9 agents, Rajasika loses badly to Satwika:
  `random` 6.13% (CI [4.65%, 8.03%]), `scripted_control` 42.15% (CI
  [38.73%, 45.63%]), `dqn_25pct` 3.96% (CI [2.80%, 5.56%]), `dqn_50pct`
  6.26% (CI [4.77%, 8.18%]), `dqn_100pct` 11.49% (CI [9.45%, 13.92%]),
  `mcts_budget100` 0.00% (CI [0.00%, 20.39%]), `mcts_budget2000` 0.00% (CI
  [0.00%, 56.15%]). Under the remaining 2, Rajasika *wins* the same
  matchup under the same parameters: `greedy` 59.26% (CI [55.78%, 62.65%]),
  `scripted_aggro` 70.50% (CI [67.21%, 73.59%]). The `random`/`dqn_*` CIs and
  the `greedy`/`scripted_aggro` CIs don't overlap — this is a genuine
  reversal of the favored side, not noisier estimates scattered around 50%.
- **More DQN training narrows the gap but doesn't close it.** The DQN
  checkpoints' RAJASIKA_vs_SATWIKA win rate rises monotonically with
  training — 3.96% (25%) -> 6.26% (50%) -> 11.49% (100%, over 3000 self-play
  games total) — but even the fully-trained checkpoint stays far below 50%.
  `dqn_100pct`'s 11.49% is higher than `random`'s own self-play baseline on
  that cell (6.13%), so 3000 games of training bought a real but small
  improvement, nowhere near parity.
- **`Player.attack()`'s automatic selection — what section 9 actually
  measured — most closely resembles `GreedyAgent`** (both pick the
  highest-damage affordable attack; `GreedyAgent` additionally has a real
  switch action that the automatic selection never voluntarily takes).
  `GreedyAgent` is the best-behaved agent in this population (28.03pp max
  deviation, the lowest of the 9) but still doesn't reproduce section 9's
  "every cell within a few points of 50%" result — the two policies aren't
  identical, so this is the closest available check, not a replication, and
  even the closest check falls short.
- **The two MCTS cells agree with the majority direction but aren't
  independently precise.** n=15 and n=3 give Wilson CIs of [0.00%, 20.39%]
  and [0.00%, 56.15%] on RAJASIKA_vs_SATWIKA — wide enough that "0.00%
  observed" should be read as "consistent with the 7-agent majority," not as
  a sharper number than the fast agents already established. The 50.0pp
  figure driving the top of the population-wide deviation range comes from
  these small-n cells; don't cite it as evidence of a *more* extreme effect
  than the fast agents (already up to 46.04pp for `dqn_25pct`) show on their
  own.
- **Bottom line: the balance found in section 9 is valid only against the
  population of policies it was actually tested against.** Section 9 tested
  exactly one policy (`Player.attack()`'s automatic best-damage/panic
  logic); it does not transfer to the 9-agent population tested here
  (`RandomAgent`, `GreedyAgent`, `AggroAgent`, `ControlAgent`,
  `TabularQLearningAgent` at 25%/50%/100% training, `MCTSAgent` at
  budget=100 and budget=2000 — see `src/agents/*` and this experiment's
  module docstring for exact definitions). Any future balance claim about
  this ruleset and parameter set must name the policy or population of
  policies it was measured against; "balanced," unqualified, is not a
  well-formed claim for this simulator.

## 12. RL agent: specification, evaluation, ablation (Fase 5)

Review motivation for this section: the update equation was missing alpha,
"Q-Learning/DQN" was never disambiguated, "88.6% tactical accuracy" had no
ground truth, and the reward weights w1/w2/w3/w_KO were never named. Each
is addressed below.

### 12.1 Which agent, and the corrected update equation

**This project's RL agent is tabular Q-learning, not DQN.** There is no
neural network anywhere in `src/agents/dqn_agent.py` despite the filename
— no function approximation, no experience replay, no target network. Every
Q-value is a dictionary lookup, `{(features, action): value}` (or a fixed
3-array in the older `QLearningAgent`; see 12.2). "Q-Learning/DQN" in prior
writeups must become "tabular Q-learning" throughout — a DQN is a specific,
different architecture (see 12.6 for why we didn't build one).

The canonical agent going forward is **`TabularQLearningAgent`**
(`src/agents/dqn_agent.py`, added Fase 4), trained via `train_tabular_agent`
against `src.simulator.agent_env.AgentGameEnv`. Its update rule, exactly as
implemented in `TabularQLearningAgent.learn_from_episode`, is the standard
one-step tabular Q-learning / TD(0) target — **Equation (2), corrected**:

```
Q(s,a) <- Q(s,a) + alpha * [ R + gamma * max_a' Q(s',a') - Q(s,a) ]
```

with `alpha` (learning rate), `gamma` (discount), and `R` (immediate reward,
see 12.4) all present and named — the prior version of this equation, which
this section's motivating review flagged, was missing `alpha` entirely.
This is not merely the "intended" equation — it is what the code computes,
line for line:

```python
old = self._q(features, action)
self.q[(features, action)] = old + self.alpha * (reward + self.gamma * next_max - old)
```

(`next_max` is `max_a' Q(s', a')` over `s'`'s legal actions, 0.0 at a
terminal transition — the `next_max = max(..., default=0.0)` in
`learn_from_episode`.)

### 12.2 Legacy `QLearningAgent`: deprecated, not used for any claim

`QLearningAgent` / `play_rl_game` / `run_rl_self_play` (top of
`dqn_agent.py`) is the original tabular Q-learning implementation, over the
3-macro-action space (Attack/Heal/Switch) described in section 10. As of
Fase 5 it is explicitly deprecated and excluded from paper claims, for two
independent reasons already on the record:

- Its Heal action (`action=1`) is dead in expectation: `damaged_bench` is
  always empty (bench characters can never be damaged, section 4.3), so the
  heal-shaping term always resolves to its failure branch (-10), never its
  success branch (+10). A reward component that can only ever fire one way
  is not really shaping anything.
- `run_rl_self_play` used to print an un-seeded, non-CI'd, single-run
  "Kesimpulan" claiming success once win rate exceeded 70% — precisely the
  unproven-claim pattern Aturan Main Fase 2 exists to prevent. That print
  statement has been deleted (not hedged) rather than kept as a caveated
  claim; see the module's legacy-code docstring banner.

Nothing in this section's findings, or in `results/dqn_hparams.json`,
`results/exp05_reward_sensitivity.json`, or `results/exp05_learning_curve.json`,
derives from the legacy path.

### 12.3 State discretization scheme

`AgentGameEnv.observation()` (the feature vector `TabularQLearningAgent`
actually keys its Q-table on — see `src/agents/base.Observation`) discretizes
continuous game state into a 10-field tuple. Bin boundaries, verbatim from
the code:

| # | Field | Bins | Boundary rule |
|---|---|---|---|
| 0 | `hp_bucket` | 3 (0,1,2) | `hp<=35` -> 0, `hp<=80` -> 1, `hp>80` -> 2 (raw HP, **not** a fraction of that character's own max HP — see caveat below) |
| 1 | `prana_bucket` | 2 | own total prana `<2` -> 0, else 1 |
| 2 | `opp_prana_bucket` | 2 | opponent total prana `<2` -> 0, else 1 |
| 3 | `deck_size_bucket` | 2 | own remaining deck `<10` -> 0, else 1 |
| 4 | `own_hand_bucket` | 4 (0-3) | `min(len(hand), 3)` |
| 5 | `opp_hand_bucket` | 4 (0-3) | `min(len(opp_hand), 3)` |
| 6 | `is_panic` | 2 | `hp <= 0.4 * max_hp` |
| 7 | `sasmita_bucket` | 4 (0-3) | raw prize count, `Player.sasmita` starts at 3, only decreases (`src/domain/models.py`) |
| 8 | `num_attacks_affordable` | 3 (0-2) | count of currently-affordable attacks; every character has 1 or 2 attacks (verified against `data/*.json`: max is 2, e.g. Arjuna, Duryodana) |
| 9 | `turn_parity` (`is_first_mover`) | 2 | 1 if this side has initiative this turn |

**Theoretical maximum table size**: 3x2x2x2x4x4x2x4x3x2 = **18,432** unique
feature tuples (before multiplying by the action dimension, which varies
per state with the number of legal attacks/bench slots). This is an upper
bound assuming every combination is reachable, which it is not — see below
and 12.7 for the actually-observed table size from real training runs.

**Caveat: bucket 0's boundaries are on raw HP, not HP fraction, and this
makes one bucket structurally unreachable for one character.** Max HP
varies by card (`data/*.json`: Balarama 70, Karna 90, Patih Sengkuni 95,
Raden Arjuna 110, Yudhistira 130, Duryodana 135). Bucket 2 requires
`hp > 80` — for Balarama (max HP 70), that condition can never be true even
at full health, so `hp_bucket` can only ever be 0 or 1 for Balarama, never
2. Balarama is one of Rajasika's two cards. This is a real, verifiable
structural asymmetry in the state representation available to the agent
when playing Rajasika (not a claim about why Rajasika loses more often
under most policies, section 11 — that would be over-claiming a causal
link this section did not test — but it is a documented fact about the
discretization that a reader modeling "why might Rajasika be harder to
play well" should know about).

### 12.4 Reward weights (w1, w2, w3, w_KO) and potential-based shaping

`train_tabular_agent`'s reward is `src.agents.dqn_agent.RewardWeights`, four
explicitly named fields (previously: unnamed magic numbers with no
documented values):

- **`w1_step_cost`** (default -0.01): flat reward on every action,
  regardless of state or action. A uniform per-step time cost, not a
  function of a state potential -- outside the scope of the potential-based
  shaping theorem below, but a constant offset does not on its own create
  a rock-paper-scissors-style incentive to prefer one action over another
  in a given state, so it is treated as a comparatively low-risk shaping
  choice (not proven risk-free, just not the term this section stress-tests).
- **`w2_hp_potential`** (default 0.0, i.e. off, reproducing Fase 4 exactly):
  coefficient on `F(s,a,s') = gamma * Phi(s') - Phi(s)`, with
  `Phi(s) = own_active_hp_fraction(s) - opp_active_hp_fraction(s)`
  (`AgentGameEnv.hp_fraction`), `Phi(terminal) := 0` by convention. This is
  **potential-based shaping in the exact sense of Ng, Harada & Russell
  (ICML 1999)**: their Theorem 1 states that for any potential function
  Phi, adding `F(s,a,s')=gamma*Phi(s')-Phi(s)` to the reward leaves the
  optimal policy (and Q*-induced policy ranking) unchanged, for *any*
  scale of the shaping term — only the speed of learning changes. `w2` is
  swept in 12.6 specifically to check this empirically: if the balance
  conclusion moved as `w2` moved, that would indicate either a
  implementation bug (e.g. `Phi(terminal)` not actually zeroed, breaking
  the telescoping sum across an episode) or a violation of the theorem's
  preconditions.
- **`w3_aggression_bias`** (default 0.0, off): flat bonus added when the
  chosen action is `ATTACK` (0 for `SWITCH`), independent of the resulting
  state `s'`. This is **deliberately not potential-based** — it depends on
  the action taken, not on a difference of a state-potential function, so
  it is exactly the case Ng et al. warn *can* change the optimal policy.
  Included as the sensitivity sweep's contrasting case to `w2`.
- **`w_ko`** (default 1.0): magnitude of the terminal `+w_ko` (win) /
  `-w_ko` (loss) reward appended to the acting side's last transition of
  the episode. This is the actual task reward, not an auxiliary shaping
  term — Ng et al.'s theorem does not apply to it (nor need it).

Every default reproduces Fase 4's original, unnamed reward exactly
(`w1=-0.01`, `w2=w3=0`, `w_ko=1.0`), so `results/exp04_policy_dependence.json`
remains fully reproducible under `RewardWeights()` with no argument changes
— this section adds names and an ablation, it does not silently change what
Fase 4 already reported.

### 12.5 Reward sensitivity sweep: does the balance conclusion move?

From `experiments/exp05_reward_sensitivity.py` (6 settings x 3 self-play
faction pairs + vs-`RandomAgent` + vs-`GreedyAgent`, n=783/cell —
`required_n(delta=0.05)`, same standard as Fase 4 — 3000-game training per
setting; full numbers in `results/exp05_reward_sensitivity.json`, figure
`figures/reward_sensitivity.png`):

- **The favored side of RAJASIKA_vs_SATWIKA never flipped**, across every
  one of the 6 settings tested (baseline, `w2` in {0.5, 1.0, 2.0}, `w3` in
  {0.1, 0.5}) — Satwika won that self-play cell under all 6, from 2.55%
  (CI [1.66%, 3.91%], baseline) up to 43.68% (CI [40.24%, 47.17%], `w3=0.5`,
  the closest any setting came to 50%) but never crossed it.
- **This does not confirm Ng, Harada & Russell's (1999) theorem for `w2`,
  and it does not refute it for `w3`** — read it more narrowly than that.
  The theorem is about the *asymptotic optimal* policy; this experiment
  trains for a fixed 3000 games with epsilon-greedy exploration, nowhere
  near guaranteed convergence over an ~18,432-feature-tuple state space
  (12.3). The win-rate swings observed under `w2` (2.55% -> 22.22% -> 9.07%
  -> 19.54% as `w2` goes 0 -> 0.5 -> 1.0 -> 2.0) are consistent with the
  theorem's own caveat that potential-based shaping changes *learning
  speed*, not the optimal policy — different speeds produce different
  quality snapshots at a fixed training budget, not evidence the theorem
  is wrong. But by the same logic, this experiment cannot *positively*
  confirm the theorem either (that would need training to convergence).
- **The `w2` (potential-based) and `w3` (non-potential-based) sweeps show
  comparably large swings in magnitude** — `w3`'s range (2.55% to 43.68%)
  is not obviously wider or narrower than `w2`'s (2.55% to 22.22%). This
  experiment does NOT cleanly demonstrate the textbook contrast ("`w2`
  stable, `w3` unstable") the sweep was designed to surface. A fair
  reading: in the specific range tested, reward shaping changed the
  *degree* of imbalance substantially (multiple non-overlapping Wilson
  CIs) without changing *which side* is favored — but this experiment did
  not sweep far enough, or train to full convergence, to say whether a
  larger `w3` would eventually flip the direction, which is exactly what
  the theorem predicts *could* happen for a non-potential-based term and
  what would need a wider sweep to actually observe.
- **Every setting's Q-table size lands in the same narrow band** (1201-1264
  entries, all 6 settings), consistent with the ~1200-1254 range measured
  independently across the 10 learning-curve seeds in 12.7 — the reward
  weights change *which* policy is learned, not how much of the state
  space self-play visits.

### 12.6 Replacing "tactical accuracy": win rate vs. baselines, Elo, exploitability

"88.6% tactical accuracy" had no stated ground truth (no oracle for
"optimal action" exists for this game) and cannot be reproduced from
anything in this repository — it is retired, not requalified. In its
place, from the same `exp05_reward_sensitivity.py` run:

- **Win rate vs. `RandomAgent` and vs. `GreedyAgent`, both with Wilson 95%
  CIs**, for every reward-weight setting (`results/exp05_reward_sensitivity.json`,
  `vs_random_agent`/`vs_greedy_agent` per setting). The baseline setting:
  94.51% vs `RandomAgent` (CI [92.68%, 95.90%], n=783) but only 17.50% vs
  `GreedyAgent` (CI [15.00%, 20.31%], n=783) — the trained agent
  comprehensively beats random play but loses badly to a simple
  always-highest-damage heuristic. Every one of the 6 settings shows the
  same qualitative pattern (crushes `RandomAgent`, loses to `GreedyAgent`)
  — see 12.7 for why the `RandomAgent` number in particular should not be
  read as evidence of learning.
- **Elo within the tested population** (`src.metrics.elo.elo_ratings`,
  8 competitors: `RandomAgent`, `GreedyAgent`, the 6 reward-weight
  variants; match log = every vs-`RandomAgent` and vs-`GreedyAgent` game
  played above, plus a direct `GreedyAgent`-vs-`RandomAgent` set — a star
  topology through the two baselines, not a full round-robin between DQN
  variants, for compute reasons, stated here rather than silently
  implied): `GreedyAgent` rated highest (1768.1), then `w2=0.5`
  (1722.9) — notably the single best-performing DQN variant in this
  population, consistent with 12.5's reading that a well-chosen
  potential-based shaping coefficient can speed up learning within a fixed
  budget — down through `w3=0.5` (1574.9), `w2=1.0` (1554.1), `w3=0.1`
  (1507.1), `w2=2.0` (1501.6), the unshaped baseline (1439.2), and
  `RandomAgent` last (932.3). Every DQN variant, including the unshaped
  baseline, outrates `RandomAgent` by a wide margin and is outrated by
  `GreedyAgent`.
- **Exploitability / best-response gap: not computed, and not currently
  feasible with this codebase's tooling.** An exact best-response oracle
  would need either a full game-tree solver (the fine-grained
  `AgentGameEnv` action space has a branching factor and horizon that make
  exhaustive search intractable, and this Python 3.9 venv has no LP/CFR
  solver available — the same scipy-less constraint `nash_averaging.py`
  already works around via exact support enumeration on a *much* smaller
  3-faction payoff matrix, section 9) or an RL-trained approximate best
  responder, which would be circular here (bounding one RL agent's
  exploitability with another RL agent's approximate best response is not
  a real bound, just two heuristics compared to each other). Flagged as
  future work requiring a deliberately state-abstracted, exactly-solvable
  variant of this game — not attempted this phase rather than faked.

### 12.7 Learning curve (>=10 seeds) and why it's flat

From `experiments/exp05_learning_curve.py` (10 independent training seeds,
default `RewardWeights()`, checkpoints every 500 games to 3000, n=200
eval games/checkpoint/seed vs `RandomAgent`; full numbers in
`results/exp05_learning_curve.json`, figure `figures/rl_learning_curve.png`):

- **The learning curve is flat, not rising** — mean win rate vs
  `RandomAgent` across the 10 seeds is 95.0% (95% CI across seeds
  [94.2%, 95.9%]) at 0 games trained (an untrained agent, empty Q-table)
  and 91.0% (CI [84.0%, 98.0%]) at 3000 games trained. Every intermediate
  checkpoint sits in the same 89-92% band. There is no visible learning
  trend against this opponent.
- **This is a ceiling effect from a weak evaluation opponent, not evidence
  the agent isn't learning.** An *untrained* `TabularQLearningAgent`
  (empty Q-table, so `max(legal, key=...)` ties every candidate at 0.0 and
  `max()` deterministically returns the first tied entry) already beats
  `RandomAgent` ~95% of the time, because `AgentGameEnv.legal_actions()`
  lists `ATTACK` options before `SWITCH` options (section 4/12.3), so the
  untrained policy's tie-break default is "always attack" — already a
  strong heuristic against a uniformly-random opponent that wastes turns
  on bad switches. `RandomAgent` is too weak a baseline to show learning
  progress here; 12.6's `GreedyAgent` comparison (baseline setting: 17.50%
  vs `GreedyAgent`, far below the ~95% vs `RandomAgent`) is the more
  informative baseline precisely because it isn't saturated.
- **Q-table size grows monotonically and consistently across seeds**
  (mean final size 1222.8, range 1199-1254 across the 10 seeds — see
  `results/dqn_hparams.json`), confirming training *is* happening (new
  states are being visited and written) even though it isn't visible in
  the vs-`RandomAgent` metric.
- Total env steps per seed across the full 3000-game training run: mean
  236,254 (range 231,743-240,834) — see `results/dqn_hparams.json` for the
  full hyperparameter table (Appendix B candidate).

## 13. Surrogate model: validation, uncertainty, model management (Fase 6)

Review motivation: a prior "MAE 0.024" claim for the win-rate surrogate
(`src/surrogate/mlp.py`) had no runner, no artifact, no baseline, and no
train/test protocol anywhere in this repo — retired outright, not
requalified (CLAIMS_LEDGER.md "no row, no claim"). This section covers the
replacement built this phase: `src/surrogate/baselines.py` (constant /
linear / gradient-boosting baselines, all from scratch — no
sklearn/scipy in this venv), `src/surrogate/ensemble.py` (deep ensemble,
Lakshminarayanan et al. 2017), `src/surrogate/model_management.py`
(surrogate-assisted EA per Jin, *Swarm and Evolutionary Computation*,
2011), `experiments/exp06_surrogate_validation.py`, and
`experiments/exp06_surrogate_assisted_ea.py`.

**Bug fixed in passing**: `MLPSurrogate.__init__` used to call the GLOBAL
`np.random.seed(42)`, giving every instance IDENTICAL initial weights —
harmless for a single network, fatal for a deep ensemble (member
disagreement is the whole uncertainty signal). Now takes a per-instance
`seed` via `np.random.default_rng`.

### 13.1 Does the MLP beat the mandatory baselines?

From `experiments/exp06_surrogate_validation.py` (300 ID-train / 80
ID-test design points, narrow Gaussian neighborhood of `SMART_START`
(`NARROW_SCALE=0.08`), 150 games/matchup/point; `results/exp06_surrogate_validation.json`,
`figures/surrogate_baseline_comparison.png`):

| Model | ID-test MAE | OOD-test MAE |
|---|---|---|
| `constant_0.5` (w_hat=50.0) | 20.16 | 36.37 |
| `linear_regression` | 6.85 | 42.13 |
| `gradient_boosting` | **5.24** | **30.46** |
| `mlp_ensemble` (5-model deep ensemble) | 9.01 | 32.55 |

- **The MLP ensemble beats the constant predictor by a bootstrap-significant
  margin on both splits** (paired bootstrap, 3000 resamples, 95% CI on
  MAE difference: ID [10.14, 12.09], OOD [1.71, 5.86], both exclude 0) —
  the surrogate contribution is not vacuous.
- **But it loses to plain gradient boosting on BOTH splits, and to plain
  linear regression on ID-test.** A from-scratch, 60-tree, depth-3
  gradient booster (`src/surrogate/baselines.GradientBoostingBaseline`)
  beats the MLP by 3.8 MAE points ID and 2.1 OOD. This is the headline
  finding this section's acceptance criteria asked for: "if MLP doesn't
  beat the baseline, know it now" — here it does beat the *weakest*
  baseline but not the strongest one. Nothing downstream (13.5) depends on
  the MLP being the best possible regressor, only on it beating the
  constant predictor and having a usable ensemble-disagreement signal, but
  a future iteration should seriously consider gradient boosting (with a
  bootstrap/jackknife uncertainty estimate in place of the deep-ensemble
  mechanism) as the primary surrogate.
- **`linear_regression` is actively worse than the constant predictor
  out-of-distribution** (42.13 vs 36.37) — linear extrapolation to
  parameter combinations far from where it was fit is actively harmful, not
  just unhelpful. Consistent with 13.3's OOD framing: the model that looks
  best in-distribution is not automatically the safest choice out of it.

### 13.2 Split by design point, not by match: a quantified leakage demo

`leakage_demo()` in `experiments/exp06_surrogate_validation.py`: 100 design
points, 4 noisy replicate labels each (40 games/matchup) plus one low-noise
ground-truth label (200 games/matchup, held out of all training). Two
linear-regression models scored on the IDENTICAL 20 held-out points' ground
truth — the only thing that differs is whether those points' own rows were
allowed into training:

- **Point-level split** (every one of a design point's replicates goes
  entirely to train or entirely to test): MAE = 9.00.
- **Match-level split** (400 individual replicate rows pooled and split
  randomly, ignoring which point a row came from): MAE = 7.60 on the *same*
  20 held-out points — **1.40 MAE-points better, purely from leakage.**
  20 of 20 nominally "held-out" points had at least one sibling replicate
  leak into that model's training set.
- A third, NOT directly comparable number is also reported (naive
  self-reported MAE = 9.25, scored against the leaky test rows' own noisy
  40-game label rather than the 200-game truth) — worse than the honest
  9.00/7.60 pair because it's dominated by label noise, not leakage; kept
  in the artifact for completeness but flagged so it isn't misread as "the"
  leakage number.
- Every dataset used for a real claim in this section (13.1, 13.3) is
  already one-row-per-design-point, so it cannot exhibit this failure mode
  — this demo exists to make the *reason* concrete, not because the main
  dataset needed fixing.

### 13.3 Out-of-distribution evaluation

ID-test points average |z-score| 0.41 from the training distribution;
OOD-test points (sampled uniformly across the full `BOUNDS` range, not a
narrow neighborhood) average 3.73 — a substantially different regime, not
just a relabeled subsample. Every model's MAE roughly doubles or worse
moving from ID to OOD (see 13.1's table) — expected, but worth stating
with a number rather than assuming "probably generalizes fine." Any
surrogate-assisted search that proposes candidates far from the training
distribution (13.5) should expect this degradation, which is exactly why
uncertainty-aware infill (not naked point prediction) matters.

### 13.4 Ensemble calibration: real, and not good

`figures/surrogate_calibration.png` (CDF-quantile reliability diagram,
Kuleshov, Fenner & Ermon, ICML 2018): for confidence level p, what
fraction of true values fall at or below the ensemble's predicted
p-quantile? Both ID and OOD curves are **nearly flat around 0.45-0.58**
across the entire p in [0.05, 0.95] range, far from the diagonal a
well-calibrated model would trace.

- **This means sigma_hat is badly over-dispersed relative to how far the
  ensemble mean actually is from the truth**, in a way that makes almost
  every quantile level land close to the mean itself — the ensemble
  members disagree with each other by more than their collective mean
  actually errs by. This is a real, unflattering, unresolved limitation,
  reported rather than hidden: `sigma_hat(Theta)` from this specific
  5-model deep ensemble should not be read as a calibrated confidence
  interval in this problem, only as a rough relative signal (more
  disagreement in one region than another).
- Practical consequence for 13.5: the EI acquisition function is
  mathematically correct given (mu, sigma), but a miscalibrated sigma
  degrades how well EI's exploration/exploitation balance reflects reality
  — this is a plausible contributor to 13.6's noisy (not cleanly
  monotonic) gap curve, alongside ordinary optimization variance. Improving
  calibration (recalibration layer, conformal prediction, or switching to
  a gradient-boosting-plus-jackknife uncertainty estimate per 13.1) is
  flagged as follow-up work, not fixed this phase.

### 13.5 Surrogate-assisted EA with model management vs. the naive pipeline

`src/surrogate/model_management.run_surrogate_assisted_ea` implements
Jin's (2011) generation-based evolution control: `src.optim.ga`'s
crossover/mutate propose candidates; an `MLPEnsemble` predicts (mu, sigma);
candidates are ranked by Expected Improvement (`expected_improvement`,
computed via `statistics.NormalDist`, no scipy needed) against `f_best`
(the best REAL-simulator loss observed so far, never a surrogate value);
every `validate_every=3` generations the top-`M=5` EI-ranked elites are
re-evaluated on the real simulator and folded back into the training set;
the ensemble is retrained from scratch on the growing dataset (full
retrain, not incremental — justified by how cheap this simulator is to
query: ~9000 games/sec measured, see 13.6). Contrasted against
`src.surrogate.mlp.run_surrogate_training`, the OLD pipeline this phase's
review was actually about: one frozen surrogate fit, 100 GA generations
against its point predictions with no re-validation, one real-simulator
check at the very end.

Both run under a comparable real-evaluation budget (50 initial design
points) and the SAME final check: `evaluate_chromosome(best_chromo,
num_runs=20000)` — N_MATCH, the Fase 2 win-rate standard — on each
pipeline's own best candidate (`results/exp06_surrogate_assisted_ea.json`):

| | Managed loop (this phase) | Naive frozen-surrogate GA (legacy) |
|---|---|---|
| SATWIKA_vs_TAMASIKA | 39.47% | 67.70% |
| TAMASIKA_vs_RAJASIKA | 56.86% | 55.58% |
| RAJASIKA_vs_SATWIKA | 54.35% | 12.53% |
| Loss (sum sq. dev. from 50%) | **176.75** | 1748.86 |
| Real-simulator evaluations spent | 155 | 50 |
| Wall time | 17.9s | 1.3s |

**The managed loop's final candidate is ~10x better by the real simulator's
own verdict** — the naive pipeline's GA-on-frozen-surrogate did exactly
what the review worried about: it steered toward a candidate the surrogate
liked (RAJASIKA_vs_SATWIKA severely lopsided at 12.53%, nowhere near what
the surrogate must have predicted near 50% for the GA to have selected it)
that the real simulator does not endorse. Naturally more real-simulator
evaluations were spent to get there (155 vs 50) and it took longer
wall-clock (17.9s vs 1.3s) — the honest tradeoff is real-simulator-call
budget and wall time for a result that survives verification, not a free
win.

### 13.6 Surrogate error vs. generation (required figure)

`figures/surrogate_error_vs_generation.png`: top panel is the mean
|surrogate-predicted loss - true loss| for the top-M elites at each of the
21 validation checkpoints (every 3 generations); bottom panel is the best
real-simulator-verified loss found so far.

- **The gap stays bounded (roughly 2000-5900 loss units across the whole
  60-generation run) and never diverges**, which is the qualitative
  "controlled gap" the acceptance criteria asked for — but it is NOT a
  clean monotonic decline. It spikes early (peaking at generation 9, right
  after the acquisition function starts pulling candidates from regions
  the seed dataset covered thinly) and only trends down in the back half
  of the run: mean gap over the first 10 checkpoints is 3928, over the
  last 11 is 3009, about a 23% reduction — real, but modest, and 13.4's
  calibration finding is a plausible contributor to why it isn't cleaner.
- **A genuine limitation surfaced by this run, not smoothed over**: the
  bottom panel's "best true loss found so far" is completely FLAT at 39.56
  for all 60 generations — the seed dataset (evaluated at
  `num_runs_seed=150`) already contained a point that scored 39.56 by that
  metric, and no acquisition-guided candidate across the entire run beat
  it *at the same n=150 precision*. But the FINAL verification of that
  exact candidate at `num_runs_final=20000` scored 176.75, not 39.56 — a
  large gap between the in-loop "true" tracking and the actually-true
  value. This is the same lesson as the rest of this section applied to
  the loop's own bookkeeping: **n=150 is still noisy enough that greedily
  updating `f_best` from it is subject to the same winner's-curse selection
  bias as trusting a surrogate's point prediction** — a lucky low-noise
  draw gets locked in as "the best," and only a much higher-N check
  reveals it wasn't. This does not invalidate the final claim (13.5's
  headline numbers ARE the num_runs_final=20000 check, not the in-loop
  39.56), but it does mean `num_runs_real`/`num_runs_seed=150` is
  arguably too low-precision for the loop's *internal* bookkeeping and a
  higher in-loop N (at proportionally higher compute cost) is flagged as
  follow-up work.

### 13.7 Final claim discipline

Per this phase's acceptance criteria, every number in 13.5's comparison
table is a real `evaluate_chromosome(..., num_runs=20000)` call on the
respective pipeline's best candidate — never a surrogate prediction, and
never the noisier in-loop `num_runs_real=150` checkpoints (13.6 shows
directly why the latter would be over-optimistic). Any future paper claim
about a surrogate-assisted-optimization result must be traceable to a
final real-simulator verification at N_MATCH-or-higher precision, exactly
like every other win-rate claim in this repository (CLAIMS_LEDGER.md
"Win-rate reporting standard").

## 14. Optimizer: genuine multi-objective + ablation (Fase 7)

Review motivation: "Pers. (4) adalah weighted-sum scalarization, bukan
multi-objective; klaim 'hybrid GA+PSO' tanpa ablasi tidak membuktikan
apa-apa." Both are addressed below.

### 14.1 Pers. (4), formally: lambda and PowerCreepPenalty(Theta)

Neither symbol existed anywhere in this repository before this phase.
Both are now real code:

- **`src.metrics.power_creep.power_creep_penalty(Theta)`**: for each of the
  25 `BOUNDS` dimensions, a stated (not derived) POWER_SIGN table says
  whether increasing that stat makes the card more powerful (+1: HP,
  damage, heal, damage-reduction, mill, scale_value) or less powerful
  (-1: prana costs, Karna's recoil). `raw_power_delta_i(Theta) =
  POWER_SIGN[i] * (Theta_i - SMART_START_i) / (BOUNDS[i].high - BOUNDS[i].low)`;
  `aggregate_power_delta(Theta)` is the mean of those 25 terms (range
  [-1, 1] by construction); `PowerCreepPenalty(Theta) = max(0,
  aggregate_power_delta(Theta))^2` -- one-sided, so only a NET increase in
  aggregate power relative to `SMART_START` is penalized (a net decrease
  scores 0 by definition: that is not "creep"). Verified empirically:
  `SMART_START` itself scores exactly 0; the all-stats-maximally-powerful
  BOUNDS corner scores ~0.241 (the practical maximum); uniformly random
  Theta scores ~0.0000-0.0001 (independent per-dimension random deltas
  cancel in the aggregate before the one-sided max(0,.), so this term is
  inert against undirected search and only bites an optimizer that
  systematically escalates every stat together).
- **`src.optim.objective.scalarized_objective`**: `Objective(Theta) =
  BalanceDeviation(Theta) + lambda * PowerCreepPenalty(Theta)`, with
  `BalanceDeviation` = the existing `evaluate_chromosome` pairwise
  3-matchup squared-deviation-from-50% loss (unchanged, so this is
  directly comparable to every pre-Fase-7 GA/PSO run) and **lambda = 8000**,
  calibrated (not guessed): at lambda=8000, the worst-case PowerCreepPenalty
  (~0.241) contributes ~1925 loss units, comparable to `SMART_START`'s own
  BalanceDeviation (2159, n=150/matchup) -- "fully escalating power" and
  "being about as imbalanced as the unbalanced starting point" are put on
  comparable footing by construction, neither dominating the other.

**This scalarization is defined for completeness and to give the
single-objective ablation (14.4) a fair, well-specified shared target -- it
is not endorsed as the preferred way to trade off balance against power
creep.** A single lambda cannot correctly balance two objectives of
unknown relative importance and different units (the same caveat
`src.metrics.balance_objective` already flagged for its own weights,
section 9). 14.2's genuine Pareto treatment is the recommended approach
where an actual trade-off surface, not one arbitrarily-weighted point on
it, is wanted.

### 14.2 Genuine multi-objective: NSGA-II Pareto front (balance vs. power creep vs. identity)

`src.optim.nsga2.run_nsga2_power_balance` keeps three objectives SEPARATE
(never summed): f1 = pairwise balance deviation (same formula as
`BalanceDeviation` above), f2 = `power_creep_penalty(Theta)`, f3 =
-Faction Identity Index (negated mean pairwise Jensen-Shannon divergence
between factions' attack-choice distributions,
`src.metrics.diversity.faction_identity_index`) -- all three MINIMIZED,
reusing the same generic `dominates`/`fast_non_dominated_sort`/
`crowding_distance` machinery `run_nsga2_balancing` (predates this phase,
different objectives, left untouched) already had.

**Fixed a real degeneracy before this produced anything useful**: the
first implementation keyed the identity comparison on raw attack NAME,
and every card's attacks have faction-unique names by data construction
(no two factions ever share an attack name) -- so a name-keyed
cross-faction JSD is trivially 1.0 (maximum) for literally every Theta,
constant, providing zero gradient. This is the exact same trap
`configs/exp03_balance_matrix.yaml` already flagged ("action_axis:
attack_rank -- NOT raw attack name") for a different metric in Fase 3;
`evaluate_chromosome_power_balance` now keys on attack RANK (0 = a
character's first listed attack, 1 = second) instead, which factions
genuinely share as vocabulary and which DOES respond to Theta (verified:
f3 ranges from -0.09 to -0.24 across random Theta samples, not stuck at
-1). Note this does mean Rajasika's own contribution is structurally
fixed at "always rank 0" (both its cards have exactly one attack each) --
not a bug, just a fact about Rajasika's kit; the cross-faction comparison
still varies via the OTHER faction's rank-1 usage frequency.

From `experiments/exp07_nsga2_power_balance.py` (pop_size=40,
generations=40, num_runs=60/matchup during search, final front
re-validated at num_runs=500; `results/exp07_nsga2_power_balance.json`,
`figures/nsga2_power_balance_pareto_front.png`):

- **A genuine 13-solution Pareto front, not a single equilibrium point.**
  F1 ranges [250.60, 5170.04], F2 ranges [0.0000, 0.0002], F3 ranges
  [-0.482, -0.312].
- **A real, visible trade-off between balance and identity**: the
  best-balance solution on the front (F1=250.60) has the WORST identity
  score of the front (F3=-0.312, closest to 0 -- least distinct
  factions); solutions with worse balance (up to F1=5170.04) buy
  meaningfully better identity (down to F3=-0.482). This is the "much more
  interesting than one equilibrium point" figure the review asked for --
  a reader can see what balance is being traded for what amount of
  faction-identity gain, not just one arbitrarily-weighted answer.
- **Power creep (F2) shows no comparable tension with balance in this
  parameter space** -- every front member has F2 at or near 0.0000
  (max 0.0002, three orders of magnitude below the ~0.24 theoretical
  worst case). The optimizer never needed to escalate power to improve
  balance or identity; report this as a real (if less dramatic) finding,
  not a flaw in the front -- it means, in this specific 25-parameter
  space, balance and power-neutrality are not fundamentally in tension,
  which is itself informative.

### 14.3 Constraint handling: continuous optimizers on an integer search space

Every `BOUNDS` dimension (HP, damage, prana cost, etc.) is integer-valued,
but PSO, CMA-ES, and Bayesian Optimization are all natively continuous
algorithms. All three (plus the Hybrid's PSO-refinement phase) use the
same **round-then-clip** repair, stated explicitly rather than left
implicit:

- **PSO / Hybrid** (`src.optim.pso._round_clip`): operates directly in raw
  parameter units. After the continuous velocity update, each dimension is
  rounded to the nearest integer via `int(round(...))`, then clipped into
  `[low, high]`.
- **CMA-ES / Bayesian Optimization** (`src.optim.baselines._normalize`/
  `_denormalize`): operate in a NORMALIZED `[0,1]^25` space instead (an
  isotropic step size / GP length-scale is only meaningful when every
  dimension has comparable scale -- raw ranges vary from 1 to 60 across
  the 25 `BOUNDS` dimensions). `_denormalize` linearly maps back to
  `[low, high]`, rounds, then clips -- the same round-then-clip philosophy,
  just composed with the normalization step.

**Known failure mode of round-then-clip, stated rather than hidden**: once
a particle/candidate's continuous position sits within 0.5 of an integer
on every dimension it is still exploring, repeated rounding can make its
EFFECTIVE step collapse toward 0 even while its underlying continuous
state keeps moving -- the visible integer position freezes early. No
correction (e.g. stochastic rounding, a dithering repair) was implemented
for this; it is flagged as a limitation of this phase's baselines, not
fixed. A more sophisticated repair operator (boundary reflection,
resampling, or dithered rounding) is future work.

### 14.4 Optimizer ablation: does "hybrid" survive?

From `experiments/exp07_optimizer_ablation.py` (6 methods, 20 seeds each
(>= 15 required), identical budget=300 `scalarized_objective` evaluations,
num_runs=60 games/matchup/evaluation; `results/exp07_optimizer_ablation.json`,
`figures/exp07_convergence_curves.png`, `figures/exp07_final_value_comparison.png`):

Mean final objective (lower = better), n=20 seeds, 95% CI:

| Method | Mean | 95% CI |
|---|---|---|
| `pso_only` | 16.44 | [9.99, 22.89] |
| `hybrid_ga_pso` | 25.55 | [14.32, 36.77] |
| `ga_only` | 41.82 | [8.49, 75.15] |
| `cma_es` | 52.01 | [30.98, 73.05] |
| `random_search` | 279.37 | [179.94, 378.80] |
| `bayesian_optimization` | 289.35 | [225.96, 352.75] |

**ACCEPTANCE CRITERION RESULT: "hybrid" does NOT beat GA-only
significantly.** `hybrid_ga_pso` (25.55) vs. `ga_only` (41.82): Wilcoxon
signed-rank p=0.7652, rank-biserial r=+0.081 (a negligible effect size,
and not remotely close to alpha=0.05). Per this phase's own acceptance
criteria, stated in advance of running this ablation: **the "hybrid
GA+PSO" framing must be dropped from the paper's title and abstract.**
This is not a implementation failure being explained away -- `run_hybrid_ablation`
(src/optim/hybrid.py) is a real, working hybrid (GA breeds the population,
PSO refines the top-3 elites every round, both phases genuinely execute
and both consume evaluation budget, verified in 13.4/14.3's testing) that
simply does not out-search GA-only on this problem within this budget.

- **The real finding is PSO, not the hybrid.** `pso_only` (16.44) is the
  single best-performing method in this ablation, though NOT
  significantly better than `hybrid_ga_pso` (p=0.3134, r=-0.262) or
  `ga_only` (p=0.2708, r=+0.286) -- all three of {PSO, Hybrid, GA} are
  statistically indistinguishable from each other here, and ALL THREE
  significantly beat both `random_search` and `bayesian_optimization`
  (every PSO/Hybrid/GA-vs-RandomSearch/BO pair: p < 0.01, |r| > 0.7).
  If a paper claim is wanted from this ablation, "an evolutionary/swarm
  method beats naive random search and this particular fixed-hyperparameter
  GP-BO baseline" is supported; "the hybrid specifically beats GA-only" is
  not.
- **CMA-ES (52.01) is competitive with GA-only** (p=0.2250, r=-0.314, not
  significant) but is clearly worse than PSO (p=0.0021, r=-0.790,
  significant).
- **Bayesian Optimization does not beat Random Search** (p=0.9553,
  r=+0.019) -- both plateau around 280-290, far behind the other four
  methods (see the convergence figure: RS and BO's curves flatten around
  evaluation ~80-100 and never catch up within the 300-evaluation budget).
  This is a real limitation of THIS BO implementation, not a claim about
  Bayesian Optimization in general: the GP uses FIXED kernel
  hyperparameters (no marginal-likelihood fitting, see
  `src.optim.baselines.run_bayesian_optimization`'s docstring) and 25
  dimensions is a lot for ~10-15 initial design points to inform a GP
  usefully -- a properly-tuned GP or a trust-region BO variant would
  likely do better, but that is future work, not what was measured here.
- **Convergence claim, checked against a real figure (the abstract
  previously asserted "rapid convergence" with no supporting plot)**:
  GA/PSO/Hybrid/CMA-ES all visibly flatten out within roughly the first
  50-80 of 300 evaluations (see `figures/exp07_convergence_curves.png`);
  Random Search and Bayesian Optimization do not -- they continue
  improving slowly across the entire budget without converging. "Rapid
  convergence" is a defensible claim for four of the six methods, and
  should be scoped to those four explicitly, not stated as a general
  property of "the optimizer."

**Revised claim for the paper, replacing "hybrid GA+PSO converges rapidly
to a balanced solution"**: GA, PSO, and the GA+PSO hybrid all converge
within roughly 50-80 evaluations to statistically indistinguishable
final objective values (all three significantly better than random search
and this phase's Bayesian Optimization baseline); the hybrid does not
demonstrate a measurable advantage over GA alone in this ablation, and the
single best-performing individual method was PSO, not the hybrid.

## 15. Honest cost accounting and complexity claims (Fase 8)

Review motivation: "94.2% speedup tidak menghitung biaya training
surrogate; klaim O(1) salah." Neither the 94.2% number nor the O(1) claim
traces to anything in this repository -- both are retired, replaced below
with real, instrumented numbers.

### 15.1 Corrected complexity statement

The complexity claim that survives scrutiny, stated precisely:

- **Monte Carlo (GA/PSO/Hybrid/CMA-ES against the real simulator)**:
  `O(P * G * M * T)` -- P = population size, G = generations, M = matches
  per evaluation (`num_runs`), T = match length (turns). Every one of
  those four factors is a REAL cost driver: doubling M or T genuinely
  doubles the wall-clock cost, because each match is actually simulated.
- **Surrogate (forward pass through a trained `MLPSurrogate`/`MLPEnsemble`)**:
  `O(P * G * d * h)` -- d = parameter dimensionality (25 in this game),
  h = hidden layer width (16). **Independent of M and T** -- a surrogate
  evaluation never plays a match, so simulation depth cannot appear in its
  cost at all.
- **The one sentence that is actually defensible**: "Evaluasi fitness
  menjadi konstan terhadap kedalaman simulasi (M, T), dan
  linear-dengan-konstanta-kecil terhadap dimensi parameter d. Pada
  rentang d in [4, 20] yang diuji, biaya ini berada di bawah overhead
  sistem sehingga tampak datar secara empiris." -- constant in M/T is
  categorically true (M and T never appear in the surrogate's forward-pass
  formula); "linear in d with a small constant" is also true, but "looks
  flat" is an artifact of the tested range being too narrow to see that
  linear term rise above measurement noise, not evidence that the term
  isn't there. **"O(1)" must be removed from the abstract, Table 1, and
  the conclusion** -- nothing in this pipeline is O(1); the honest claim
  is "O(d*h), and d*h is currently small enough to be dominated by system
  overhead."

### 15.2 Extending Fig. 1: where does the curve actually rise?

From `experiments/exp08_dimension_scaling.py` (synthetic benchmark of
`MLPSurrogate.forward()` cost only, hidden_dim=16, batch=12, median of 7
timing blocks x 2000 reps per point -- the real game's 25-dim `BOUNDS`
space cannot itself be resized, so this isolates the d-dependent term in
isolation; `results/exp08_dimension_scaling.json`,
`figures/exp08_dimension_scaling.png`):

- **At d=200 (the extension this phase's task explicitly asked for), the
  curve is STILL flat**: 1.44 us/eval vs. 1.21 us/eval at d=4 -- only
  1.19x, well within noise. Simply extending to d=200 as literally
  requested would still look almost perfectly flat and would not, on its
  own, demonstrate the honest rising trend.
- **Extending further (to d=50,000) is what actually shows the rise**:
  cost grows to 36.4 us/eval at d=50,000 (30.1x the d=4 cost), with the
  curve visibly leaving "flat" territory somewhere around d=1,000-5,000
  (first point exceeding 2x the d=4 baseline: d=5,000). This flat-then-rising
  shape is the credible result the task asked for -- a curve that is flat
  everywhere tested, with no visible ceiling anywhere, invites (correct)
  suspicion that the tested range was chosen to avoid ever seeing the
  rise; a curve that visibly bends is more convincing precisely because it
  shows the method being tested past its comfort zone.
- **For context, every single point measured (d=4 to d=50,000) remains
  3-4 orders of magnitude cheaper than one real-simulator evaluation**
  (33.3 ms, n_match=60, and genuinely constant across the entire d sweep,
  confirming the "independent of M, T" half of the complexity claim
  directly): even at d=50,000 -- 2000x the real game's actual 25
  dimensions -- the surrogate is still ~915x cheaper per evaluation. The
  point of this section is not that the surrogate is slow; it's that
  "flat" and "O(1)" are not the same claim, and only one of them is true.

### 15.3 Honest cost accounting: per-evaluation vs. amortized speedup

From `experiments/exp08_cost_accounting.py` (5 repetitions, explicit
parameters per Fase 8 task 3: population_size=12, n_generations=30,
n_match_per_eval=60, dataset_size=200 real-simulator design points,
ensemble_epochs=2000, final_verification_n_match=2000;
`results/exp08_cost_accounting.json`, `figures/exp08_breakeven_analysis.png`):

Phase breakdown (mean over 5 repetitions), frozen-surrogate pipeline:

| Phase | Mean time |
|---|---|
| `t_data_generation` (200 real-simulator design points) | 6.61 s |
| `t_surrogate_training` (5-model ensemble, 2000 epochs) | 1.19 s |
| `t_optimization` (30-generation GA against the frozen surrogate) | 0.04 s |
| `t_elite_verification` (1 real-simulator check, n=2000) | 0.97 s |
| **Total** | **8.82 s** |

Pure Monte Carlo (`src.optim.ga.run_ga_ablation`, real simulator every
evaluation, identical population_size x n_generations budget): **12.58 s**.

- **(a) Per-evaluation speedup (marginal cost only)**: mean real-simulator
  evaluation = 32.8 ms (n_match=60); mean surrogate evaluation = 0.092 ms
  -- **354.4x**. This is the number a "94.2%"-style claim is usually
  built from, and it is real, but it silently assumes the surrogate is
  already trained and free -- 15.1's `t_data_generation` +
  `t_surrogate_training` = 7.80 s says otherwise.
- **(b) Amortized speedup + break-even point**: treating
  `t_data_generation + t_surrogate_training` (7.80 s) as a ONE-TIME fixed
  cost that can be reused across multiple subsequent re-balancing runs
  (each subsequent run only pays `t_optimization + t_elite_verification`
  = 1.01 s, vs. 12.58 s for a fresh pure-Monte-Carlo run every time):
  cumulative cost crosses over at **N* = 0.67 re-balancing runs** -- i.e.
  the surrogate pipeline's total cost is already lower than pure Monte
  Carlo's after less than a single additional re-balancing run, because
  the one-time setup cost (7.80 s) is smaller than even ONE pure-Monte-Carlo
  run (12.58 s) at this budget. Amortized speedup at N=10 re-balancing
  runs: **7.0x** (a very different, much more defensible number than the
  354x marginal figure, and the one that should be reported alongside it,
  never instead of the phase breakdown that produced it).
- **Both numbers belong in the paper, explicitly labeled as different
  things** -- "the surrogate is 354x faster per evaluation once trained"
  and "the full pipeline, including training, is 7.0x faster than pure
  Monte Carlo after 10 re-balancing runs (break-even under 1 run at this
  budget)" are both true and neither implies the other.

## 16. Global sensitivity and equilibrium robustness (Fase 9)

Review motivation: only one parameter (Karna HP) had ever been swept -- a
1D slice through a 25-dimensional space -- and the "golden equilibrium"
(`data/ga_balanced_params.json`) had never been checked for uniqueness or
stability. Four things were built: `src/sensitivity/sobol.py` (Saltelli
Sobol indices, from scratch), `src/sensitivity/morris.py` (Morris
elementary-effects screening, from scratch),
`experiments/exp09_sensitivity_indices.py`, `experiments/exp09_equilibrium_robustness.py`,
and `experiments/exp09_karna_hp_ci.py`.

### 16.1 Sobol / Morris: which parameters actually control balance?

From `experiments/exp09_sensitivity_indices.py` (Morris: 30 trajectories,
780 evaluations; Sobol: 150 samples, 4050 evaluations; both against
`evaluate_chromosome`'s pairwise balance-deviation loss, n=100 games/matchup/evaluation;
`results/exp09_sensitivity_indices.json`, `figures/exp09_sobol_morris_indices.png`):

| Rank | Parameter | Sobol S1 | Sobol ST | ST-S1 (interaction) |
|---|---|---|---|---|
| 1 | `tms_duryodana_angkara_cost` | -0.06 | 0.39 | 0.44 |
| 2 | `rjs_karna_cost` | -0.05 | 0.27 | 0.31 |
| 3 | `rjs_balarama_cost` | -0.22 | 0.26 | 0.48 |
| 4 | `stw_yudhistira_cost_univ` | 0.16 | 0.23 | 0.07 |
| 5 | `tms_sengkuni_cost_univ` | -0.19 | 0.23 | 0.42 |

(full 25-parameter table in the artifact; Morris's independent top-5 by
mu*: `rjs_karna_cost`, `stw_yudhistira_dmg`, `tms_duryodana_angkara_cost`,
`stw_yudhistira_cost_univ`, `rjs_karna_dmg` -- substantial overlap with
Sobol's ranking, a useful cross-check between two independently-implemented
methods.)

- **PRANA COSTS dominate, not HP or damage.** Every one of the top-5
  Sobol/Morris parameters by influence is a `_cost` field, not the raw HP
  or damage stats the original single-parameter sweep focused on. This is
  the headline finding this section's acceptance criteria asked for:
  Karna's HP was never the primary lever -- his prana COST, and the other
  factions' costs, are.
  Costs are integer fields with small BOUNDS ranges (mostly `(1,2)` or
  `(0,1)`, see rules_spec.md 14.3), so a "1-point" change is a much larger
  RELATIVE move than a 1-point change in an HP field with range ~40-60 --
  consistent with these fields showing outsized influence per unit of raw
  parameter change.
- **Interactions are large and pervasive, not a minor correction term.**
  Sum of S1 across all 25 parameters = 0.76 (would be 1.0 if the model
  were purely additive); sum of ST = 3.39 (total-order indices overlap by
  construction when parameters interact, so >1.0 is expected, but this
  magnitude says interactions are doing a lot of the work). For 4 of the
  top 5 parameters, ST-S1 (the interaction-only contribution) is LARGER
  than S1 itself -- these parameters barely matter in isolation and matter
  a great deal in combination with others. A 1D sweep of any single
  parameter, including the original Karna-HP one, cannot see this by
  construction.
- **Negative S1 point estimates for some parameters** (e.g. `rjs_balarama_cost`
  -0.22, `tms_sengkuni_cost_univ` -0.19) **are estimator noise, not a real
  negative variance contribution** -- true Sobol first-order indices are
  provably >= 0; a negative point estimate under the finite-sample Saltelli
  estimator means "consistent with 0, imprecisely estimated," which the
  reported 95% CIs (also in the artifact) make explicit. Read these as
  "not distinguishable from 0 at this sample size," not as evidence of a
  variance-reducing effect (impossible).
- **Methodological caveat, stated once here rather than repeated per
  bullet**: both methods assume a deterministic model function; applied to
  `evaluate_chromosome` (a stochastic Monte Carlo estimator, n=100/matchup,
  not the N_MATCH=20000 win-rate standard), some of the measured variance
  is irreducible simulation noise rather than true parameter sensitivity.
  This inflates apparent interaction effects and widens the CIs reported
  above; the ranking (which parameters matter most) is more trustworthy
  than the exact index VALUES.

### 16.2 Basin of attraction: how fragile is the equilibrium?

From `experiments/exp09_equilibrium_robustness.py` Part A (Gaussian
perturbation of `ga_balanced_params.json` at 10 noise magnitudes, 25
samples/magnitude, n=100 games/matchup/sample; `results/exp09_equilibrium_robustness.json`,
`figures/exp09_basin_of_attraction.png`):

- **Even AT Theta* (sigma=0, no perturbation at all), only 40% of
  independent re-evaluations land within the +/-10pp "balanced" band on
  all 3 matchups simultaneously** (mean loss 215.16, 95% CI [161.7, 268.6],
  n=25). This is not a perturbation-sensitivity finding -- it is
  Monte-Carlo sampling noise at n=100 games/matchup, and it is exactly why
  16.5 retires "isolated the exact equilibrium point" as a claim: even the
  reference point itself doesn't reliably pass its own balance test at
  this n. There is no infinitely-sharp point to isolate; there is a
  distribution of outcomes even at fixed Theta.
- **The basin is narrow: parity degrades sharply and fast.** The fraction
  of perturbed samples still "balanced" drops from 40% (sigma=0) to 8%
  (sigma=0.02, i.e. Gaussian noise with std = 2% of each parameter's
  BOUNDS range) to 0% by sigma=0.05. Mean loss rises monotonically and
  roughly linearly from 215 (sigma=0) to 4142 (sigma=0.5, 95% CI [3440,
  4843]). A 2%-of-range perturbation -- on an integer-valued field, often
  a 1-2 point nudge -- is enough to mostly break the balanced-band
  criterion. This is a genuinely fragile equilibrium, not a broad, robust
  region, and that fragility is itself worth reporting plainly.

### 16.3 Multi-start optimization: is the equilibrium unique?

From `experiments/exp09_equilibrium_robustness.py` Part B (24 independent
GA runs, `src.optim.ga.run_ga_ablation`, budget=300, num_runs=60,
random -- not Theta*-seeded -- initial populations):

- **21 distinct equilibria found across 24 independent starts** (Union-Find
  clustering at a 0.12 normalized-RMS-distance threshold; one cluster of 4
  starts, the remaining 20 starts each in their own singleton cluster).
  **This is a real finding that must be reported, not smoothed over: the
  search does NOT reliably converge to a single "golden equilibrium."**
  Different random starts land in genuinely different, mutually distant
  regions of the 25-dimensional parameter space.
- **Critically, the resulting solutions are comparably GOOD despite being
  DIFFERENT** -- final loss values across the 24 starts range from 2.78 to
  338.61, with most clustered in the 2.78-80 range regardless of which of
  the 21 clusters they belong to (see `figures/exp09_multistart_clustering.png`).
  This is the multiple-equilibria finding the task anticipated: there is
  not one uniquely-best balanced parameter set, there are MANY comparably-balanced
  parameter sets scattered across the space, and any one optimization run
  (including the one that originally produced `ga_balanced_params.json`)
  only ever finds one of them.
  Mean normalized distance from these 24 runs' final points to the
  reference `ga_balanced_params.json` itself: 0.54 (range 0.35-0.67) --
  the reference point is not even close to most of these independently-found
  equilibria, consistent with it being one member of a large family, not a
  privileged unique solution.
- **Honest caveat on interpretation**: budget=300 is a modest search budget
  (consistent with Fase 7's ablation budget, chosen for compute
  tractability across 24 repeats); part of this dispersion could reflect
  incomplete convergence of individual runs rather than 21 genuinely
  distinct GLOBAL attractors. Both readings support the same practical
  conclusion (a single run's output should not be reported as "the"
  equilibrium), so this caveat affects interpretation of the mechanism,
  not the headline finding.

### 16.4 Fig. 2 replacement: CI bands and the Satwika/Rajasika question

From `experiments/exp09_karna_hp_ci.py` (Karna HP swept across its actual
`BOUNDS` range 70-110, step 2, n=300 games/matchup/point -- real Wilson
95% CIs, not a diagnostic-grade n; baseline = `ga_balanced_params.json` for
every other parameter, not the legacy `exp00_threshold_nonlinearity.py`
script's separate, arbitrary `BASE_PARAMS` dict; `results/exp09_karna_hp_ci.json`,
`figures/exp09_karna_hp_ci.png`):

- **Control check passes**: `SATWIKA_vs_TAMASIKA` (a matchup Karna never
  appears in) ranges only 8.0pp across the entire sweep -- consistent with
  pure sampling noise at n=300, not a real Karna-HP effect leaking into an
  unrelated matchup. This is the sanity check that must pass before
  trusting anything else in this section, and it does.
- **The investigation did NOT reproduce a Satwika/Rajasika near-overlap.**
  Under this re-analysis (per-faction marginal win rate vs. Karna HP,
  `ga_balanced_params.json` baseline), the CLOSEST pair of curves is
  SATWIKA/TAMASIKA (mean |difference| 4.14pp across the sweep), not
  Satwika/Rajasika (14.15pp, the LARGEST of the three pairwise gaps).
  Per-matchup, `TAMASIKA_vs_RAJASIKA` and `RAJASIKA_vs_SATWIKA` visibly
  converge and track closely from Karna HP ~86 onward (see the figure),
  which may be the pair a reader glancing at the original figure identified
  as "nearly coincident" -- if so, it was a Rajasika-vs-{Tamasika-matchup,
  Satwika-matchup} convergence, not a Satwika-vs-Rajasika one. **This
  section cannot confirm the specific Satwika/Rajasika claim as stated**;
  either the original figure used a different parameter baseline (this
  repo's `ga_balanced_params.json` may not be the exact Theta the original
  figure was built around), a different curve definition, or the original
  read of the figure does not hold up under a real re-analysis. Reported
  honestly as a non-reproduction rather than forced to match the expected
  finding.
- **The 4.14pp "closest pair" gap is close to the demonstrated noise
  floor** (8.0pp range on a curve that MUST be flat, from the control
  check above) **and should not be over-read as a confirmed structural
  symmetry either.** At this n, differences below roughly 8pp between any
  two curves are not clearly distinguishable from sampling noise in either
  direction -- "nearly overlapping" and "not clearly different from noise"
  are, at this precision, close to the same statement.

### 16.5 Revised claim language

Per this phase's acceptance criteria, replace:

> "isolated the exact equilibrium point"

with:

> "identified a region of parameter space in which pairwise parity is
> statistically indistinguishable from 50% (n=100-300 depending on the
> analysis, 95% CI) -- not a unique point: at least 21 comparably-balanced
> but mutually distant parameter sets were found from 24 independent
> search restarts (16.3), and the specific region reported here degrades
> to non-balanced within a small (~2-5% of parameter range) Gaussian
> perturbation (16.2)."
