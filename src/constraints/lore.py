"""Narrative-fidelity (lore) constraints for Fase E9 (docs/FASE_E9_SPEC.md).

Eighteen constraints g_k(theta), each expressing a narrative claim about
relative character power drawn from the source text cited in that
constraint's `source` field. Convention (standard constraint-handling,
matches Deb 2000's constraint-domination used by
src.optim.nsga2.run_nsga2_lore_constrained): **g_k(theta) <= 0 means
satisfied**.

Strict relational constraints ("a > b") between two BOUNDS integers directly
use an integer margin epsilon=1, per docs/FASE_E9_SPEC.md section 2.1:
g(theta) = b - a + 1.

L16 and L17 are the exception, revised 2026-09-17 (human decision): they
compare MEANS of two integers, not two integers directly, so their smallest
possible nonzero difference is 0.5, not 1 -- eps=1 there over-tightens the
constraint beyond what the narrative asks for (verified: eps=0.5 gives
numerically identical results to a plain strict "<" with no margin at all;
eps=1 does not). See L16/L17's own comments below for the verified numbers.
The margin convention itself (which quantum applies where) is a
narrative-fidelity design choice made by the paper's author (Aturan Main
Aturan 5.3), not something this module re-derives or adjusts on its own.

Non-strict relational constraints ("a >= b" or "a <= b") use no margin:
g(theta) = b - a (for >=) or g(theta) = a - b (for <=).

Do not add, remove, or loosen any constraint here without the human
sign-off docs/FASE_E9_SPEC.md section 4 requires -- narrative justification
is the paper author's call, not this module's.
"""
from __future__ import annotations

from collections import namedtuple

LoreConstraint = namedtuple("LoreConstraint", ["id", "expr", "rationale", "source"])


def _mean(theta: dict, keys: list) -> float:
    return sum(theta[k] for k in keys) / len(keys)


_SATWIKA_HP_KEYS = ["stw_yudhistira_hp", "stw_arjuna_hp"]
_RAJASIKA_HP_KEYS = ["rjs_balarama_hp", "rjs_karna_hp"]
_SATWIKA_DMG_KEYS = ["stw_yudhistira_dmg", "stw_arjuna_pasupati_dmg"]
_RAJASIKA_DMG_KEYS = ["rjs_balarama_dmg", "rjs_karna_dmg"]


# Each entry: (id, g_k callable, LoreConstraint metadata)
_DEFINITIONS = [
    (
        "L1",
        lambda t: t["stw_arjuna_hp"] - t["stw_yudhistira_hp"] + 1,
        LoreConstraint(
            "L1", "stw_yudhistira_hp > stw_arjuna_hp",
            "Yudhishthira as the receiver of dharma teachings",
            "Anusasana Parva (Vol. XI)",
        ),
    ),
    (
        "L2",
        lambda t: t["stw_yudhistira_dmg"] - t["stw_arjuna_pasupati_dmg"] + 1,
        LoreConstraint(
            "L2", "stw_yudhistira_dmg < stw_arjuna_pasupati_dmg",
            "Arjuna unmatched among Kshatriya",
            "Vol. II, Kairata Parva",
        ),
    ),
    (
        "L3",
        lambda t: 1 - t["stw_yudhistira_dr"],
        LoreConstraint(
            "L3", "stw_yudhistira_dr > 0",
            "dharma as protection",
            "Anusasana Parva",
        ),
    ),
    (
        "L4",
        # Revised 2026-09-17 (human decision, Aturan Main Aturan 5.2): the
        # -15 term corrects for src/domain/models.py's bench_scaling bonus
        # (`min(len(bench)*5, 15)`, line ~211), which Panah Pasupati gets on
        # top of its raw `stw_arjuna_pasupati_dmg` base_damage but which
        # isn't itself a BOUNDS parameter -- so comparing raw base_damage
        # values across attacks with different scaling mechanics understates
        # Pasupati's real output. 15 is deterministic from theta (in fact
        # constant regardless of theta: both decks always ship 2 unique
        # cards x 20 copies, so the >=3-bench-copies saturation point is
        # reached by deck construction alone, not by any BOUNDS dimension),
        # so it is safe to fold into a static g_k the way the omitted
        # discard-pile-scaling term (see below) is not.
        #
        # Angkara 100 Kurawa's OWN scaling term (`scaled_damage_per_discard_tamasika`,
        # `bonus_damage += len(opponent.discard_pile) * scale_value`) is
        # deliberately EXCLUDED from this comparison, and NOT because it is
        # rarely relevant -- measured directly (experiments/exp09_angkara_scaling_diagnostic.py,
        # data/ga_balanced_params.json, SATWIKA_vs_TAMASIKA + TAMASIKA_vs_RAJASIKA,
        # N_MATCH=20000/matchup, seed=20260801, n=171,767 uses of that attack):
        # the bonus is active (>0) in 80.65% of uses and contributes 27.36%
        # of the attack's total dealt damage -- clearly not negligible. It is
        # excluded because `opponent.discard_pile`'s length is a
        # SIMULATION-TIME quantity (it grows via mill effects turn by turn),
        # not a static function of theta -- a g_k that depends on it would
        # make Theta_lore membership stochastic (the same theta could be
        # feasible in one run and infeasible in another), which NSGA-II's
        # constraint-domination assumes is not the case (g_k must be a
        # cheap, deterministic function of theta alone). This will be
        # reported in the paper's Threats to Validity: L4 as implemented
        # does not fully compare "effective max damage output" for
        # Duryodana, only its statically-known component.
        lambda t: max(
            t["rjs_karna_dmg"], t["rjs_balarama_dmg"],
            t["tms_sengkuni_dmg"], t["tms_duryodana_angkara_dmg"],
        ) - t["stw_arjuna_pasupati_dmg"] - 15,
        LoreConstraint(
            "L4",
            "stw_arjuna_pasupati_dmg + 15 >= max(rjs_karna_dmg, rjs_balarama_dmg, "
            "tms_sengkuni_dmg, tms_duryodana_angkara_dmg)",
            "Pasupata, weapon of Mahadeva (bench-scaling-adjusted)",
            "Vol. II, Sec. XL",
        ),
    ),
    (
        "L5",
        lambda t: 3 - t["stw_arjuna_pasupati_cost"],
        LoreConstraint(
            "L5", "stw_arjuna_pasupati_cost >= 3",
            "obtained through austerity and combat",
            "Vol. II, Sec. XXXVIII-XLI",
        ),
    ),
    (
        "L6",
        lambda t: t["rjs_balarama_dmg"] - t["rjs_karna_dmg"] + 1,
        LoreConstraint(
            "L6", "rjs_karna_dmg > rjs_balarama_dmg",
            "Balarama withdraws from the war",
            "Vol. IV, Sec. CLVIII",
        ),
    ),
    (
        "L7",
        lambda t: 1 - t["rjs_karna_recoil"],
        LoreConstraint(
            "L7", "rjs_karna_recoil > 0",
            "power paid for with lifespan",
            "Vol. III, Kundala-harana",
        ),
    ),
    (
        "L8",
        lambda t: t["rjs_karna_hp"] - t["stw_yudhistira_hp"] + 1,
        LoreConstraint(
            "L8", "rjs_karna_hp < stw_yudhistira_hp",
            "armor surrendered, fragility gained",
            "Vol. III",
        ),
    ),
    (
        "L9",
        lambda t: t["rjs_karna_hp"] - t["tms_duryodana_hp"] + 1,
        LoreConstraint(
            "L9", "rjs_karna_hp < tms_duryodana_hp",
            "Duryodhana trained 13 years",
            "Vol. VII, Salya Parva",
        ),
    ),
    (
        "L10",
        lambda t: t["stw_yudhistira_dmg"] - t["rjs_karna_dmg"],
        LoreConstraint(
            "L10", "rjs_karna_dmg >= stw_yudhistira_dmg",
            "Karna the equal of Bhishma/Drona/Kripa",
            "Vol. IV, p. 276",
        ),
    ),
    (
        "L11",
        lambda t: t["tms_sengkuni_hp"] - t["tms_duryodana_hp"] + 1,
        LoreConstraint(
            "L11", "tms_sengkuni_hp < tms_duryodana_hp",
            "Sakuni the instigator, not a warrior",
            "Vol. II, Dyuta Parva",
        ),
    ),
    (
        "L12",
        lambda t: t["tms_sengkuni_dmg"] - t["tms_duryodana_angkara_dmg"] + 1,
        LoreConstraint(
            "L12", "tms_sengkuni_dmg < tms_duryodana_angkara_dmg",
            "manipulation over might",
            "Vol. II, Dyuta Parva",
        ),
    ),
    (
        "L13",
        lambda t: 1 - t["tms_sengkuni_mill"],
        LoreConstraint(
            "L13", "tms_sengkuni_mill >= 1",
            "ruin through manipulation",
            "Vol. II, Dyuta Parva",
        ),
    ),
    (
        "L14",
        lambda t: t["stw_arjuna_hp"] - t["tms_duryodana_hp"],
        LoreConstraint(
            "L14", "tms_duryodana_hp >= stw_arjuna_hp",
            "skill and endurance from training",
            "Vol. VII, p. 467",
        ),
    ),
    (
        "L15",
        lambda t: 1 - t["tms_duryodana_scale_value"],
        LoreConstraint(
            "L15", "tms_duryodana_scale_value > 0",
            "Angkara scales with destruction",
            "Vol. VII",
        ),
    ),
    (
        "L16",
        # Revised 2026-09-17 (human decision): margin 0.5, not the integer
        # margin eps=1 used for L1-L15/L18. The module docstring's eps=1
        # rule is stated for comparisons between BOUNDS integers directly;
        # L16/L17 instead compare MEANS of two integers, whose smallest
        # possible nonzero difference is 0.5 (one side's pair sums to an
        # odd total, the other's to an even total), not 1 -- verified
        # directly (400,000 samples, seed=20260801): eps=0.5 here gives
        # numerically IDENTICAL results to strict "<" with no margin at
        # all, whereas eps=1 rejects an extra ~0.2-2.7pp of samples whose
        # true mean-difference is already a full 0.5 in the intended
        # direction, over-tightening a constraint the source narrative
        # never asked to be that strict.
        lambda t: _mean(t, _RAJASIKA_HP_KEYS) - _mean(t, _SATWIKA_HP_KEYS) + 0.5,
        LoreConstraint(
            "L16", "mean(Satwika HP) > mean(Rajasika HP)",
            "goodness vs. passion",
            "Vol. V, Bhagavad Gita",
        ),
    ),
    (
        "L17",
        # See L16's comment above -- same margin-quantum correction, same
        # verification method.
        lambda t: _mean(t, _SATWIKA_DMG_KEYS) - _mean(t, _RAJASIKA_DMG_KEYS) + 0.5,
        LoreConstraint(
            "L17", "mean(Rajasika damage) > mean(Satwika damage)",
            "goodness vs. passion",
            "Vol. V, Bhagavad Gita",
        ),
    ),
    (
        "L18",
        lambda t: t["rjs_karna_cost"] - t["stw_arjuna_pasupati_cost"],
        LoreConstraint(
            "L18", "rjs_karna_cost <= stw_arjuna_pasupati_cost",
            "passion as fast tempo",
            "Vol. V",
        ),
    ),
]

LORE_CONSTRAINTS = [meta for _id, _fn, meta in _DEFINITIONS]
_G_FUNCTIONS = {cid: fn for cid, fn, _meta in _DEFINITIONS}

assert list(_G_FUNCTIONS) == [f"L{i}" for i in range(1, 19)], (
    "lore.py must define exactly L1..L18, in order, no more, no fewer"
)


def constraint_violations(theta: dict) -> dict:
    """{constraint_id: g_k(theta)}. A value <= 0 means that constraint is
    satisfied."""
    return {cid: fn(theta) for cid, fn in _G_FUNCTIONS.items()}


def total_violation(theta: dict) -> float:
    """Sum of max(0, g_k) over every constraint. 0.0 means fully feasible."""
    return sum(max(0.0, g) for g in constraint_violations(theta).values())


def is_feasible(theta: dict) -> bool:
    return total_violation(theta) == 0.0


def feasibility_report(theta: dict) -> dict:
    """{'feasible': bool, 'n_satisfied': int, 'violated': [ids],
    'total_violation': float}"""
    violations = constraint_violations(theta)
    violated = [cid for cid, g in violations.items() if g > 0]
    return {
        "feasible": len(violated) == 0,
        "n_satisfied": len(violations) - len(violated),
        "violated": violated,
        "total_violation": sum(max(0.0, g) for g in violations.values()),
    }
