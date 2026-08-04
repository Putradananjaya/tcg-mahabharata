"""Power creep penalty (Fase 7 review: "PowerCreepPenalty(Theta)" was named
in Pers. (4) but never formally defined anywhere in this repo or the paper).

Formal definition
------------------
"Power creep" means the optimizer escalates every stat upward (or every
cost downward) together -- HP, damage, heal, mill, damage-reduction all go
up; prana costs and recoil all go down -- while leaving relative balance
between factions untouched, since a proportional escalation of everyone's
numbers does not change any win-rate. `evaluate_chromosome`'s existing
balance-only loss is blind to this: it would score a "everyone is twice as
strong" chromosome exactly as well as `SMART_START` itself. This module
gives that failure mode a number.

For each of the 25 `src.simulator.fitness.BOUNDS` dimensions, POWER_SIGN
below states whether increasing it makes the card MORE powerful (+1: hp,
damage, heal, damage-reduction, mill, scale_value) or LESS powerful (-1:
prana cost fields, Karna's recoil -- self-damage). This is a stated,
literal design choice (not derived from data), documented here so it can
be checked or disputed, not asserted silently.

    raw_power_delta_i(Theta) = POWER_SIGN[i] * (Theta_i - SMART_START_i)
                                / (BOUNDS[i].high - BOUNDS[i].low)
    aggregate_power_delta(Theta) = mean_i raw_power_delta_i(Theta)   # in [-1, 1]
    PowerCreepPenalty(Theta) = max(0, aggregate_power_delta(Theta)) ** 2

One-sided (via max(0, .)): only a NET increase in aggregate power relative
to SMART_START is "creep" and penalized; a net decrease (everything gets
weaker on average) is not creep and scores 0, by definition -- this
penalty is not a generic "distance from SMART_START" regularizer (that
would also fight legitimate balance-improving deviations that don't
inflate power), it specifically targets the escalate-everything failure
mode described above. Squared, consistent with every other loss term in
this codebase (`evaluate_chromosome`, `balance_objective`) being a squared
deviation, so a small amount of drift is cheap and a large amount is
disproportionately expensive.
"""
from __future__ import annotations

from src.simulator.fitness import BOUNDS, SMART_START

POWER_SIGN = {
    "stw_yudhistira_hp": 1, "stw_yudhistira_dmg": 1, "stw_yudhistira_dr": 1,
    "stw_yudhistira_heal": 1, "stw_yudhistira_cost_satwika": -1, "stw_yudhistira_cost_univ": -1,
    "stw_arjuna_hp": 1, "stw_arjuna_pasupati_dmg": 1, "stw_arjuna_pasupati_cost": -1,
    "rjs_balarama_hp": 1, "rjs_balarama_dmg": 1, "rjs_balarama_cost": -1,
    "rjs_karna_hp": 1, "rjs_karna_dmg": 1, "rjs_karna_recoil": -1, "rjs_karna_cost": -1,
    "tms_sengkuni_hp": 1, "tms_sengkuni_dmg": 1, "tms_sengkuni_mill": 1,
    "tms_sengkuni_cost_tamasika": -1, "tms_sengkuni_cost_univ": -1,
    "tms_duryodana_hp": 1, "tms_duryodana_angkara_dmg": 1, "tms_duryodana_scale_value": 1,
    "tms_duryodana_angkara_cost": -1,
}

assert set(POWER_SIGN) == set(BOUNDS), "POWER_SIGN must classify every BOUNDS dimension, no more, no fewer"


def aggregate_power_delta(theta: dict) -> float:
    """mean_i raw_power_delta_i(Theta), signed (positive = net more
    powerful than SMART_START, negative = net less powerful). Range
    [-1, 1] by construction (each term is a signed fraction of its
    BOUNDS range, clipped implicitly since Theta is assumed within BOUNDS)."""
    deltas = []
    for key, sign in POWER_SIGN.items():
        low, high = BOUNDS[key]
        span = high - low
        deltas.append(sign * (theta[key] - SMART_START[key]) / span)
    return sum(deltas) / len(deltas)


def power_creep_penalty(theta: dict) -> float:
    """PowerCreepPenalty(Theta) = max(0, aggregate_power_delta(Theta))**2.
    See module docstring for the full derivation."""
    return max(0.0, aggregate_power_delta(theta)) ** 2
