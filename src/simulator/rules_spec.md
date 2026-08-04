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
