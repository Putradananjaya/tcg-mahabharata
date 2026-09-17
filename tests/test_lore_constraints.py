"""Unit tests for src.constraints.lore (Fase E9, docs/FASE_E9_SPEC.md).

Acceptance criteria (spec section 3) require: all 18 g_k tested against
known cases, with `data/ga_balanced_params.json` as the anchor case.

Revision history (both human decisions, 2026-09-17, see src/constraints/lore.py
for the full rationale in each constraint's own comment):
  - L4 reformulated to `max(other damages) - pasupati_dmg - 15`, correcting
    for Panah Pasupati's bench_scaling bonus (deterministic +15 given this
    repo's fixed 2-unique-cards-per-faction deck construction) not being
    captured by comparing raw base_damage values alone. Under this formula,
    `data/ga_balanced_params.json` AND `SMART_START` are both 18/18
    feasible (previously 17/18, violating only L4, under the original
    formula) -- this is the correct, current reference value, not the
    17/18 result from the module's earlier revision.
  - L16/L17's margin corrected from eps=1 to eps=0.5, because they compare
    MEANS of two integers (quantum 0.5), not two integers directly (quantum
    1) -- eps=1 there silently over-tightened the constraint. See
    TestMeanMarginQuantum below, which locks this in.

FEASIBLE_BASE is SMART_START directly (unmodified) -- verified fully
feasible (18/18) under the current formulas, unlike under the original L4
formula where it needed adjustment.
"""
import pytest

from src.constraints.lore import (
    LORE_CONSTRAINTS,
    constraint_violations,
    feasibility_report,
    is_feasible,
    total_violation,
)
from src.simulator.fitness import SMART_START

FEASIBLE_BASE = dict(SMART_START)


def violated(theta):
    return set(feasibility_report(theta)["violated"])


class TestFeasibleBaseIsFullyFeasible:
    def test_smart_start_is_18_of_18_satisfied(self):
        report = feasibility_report(FEASIBLE_BASE)
        assert report == {
            "feasible": True,
            "n_satisfied": 18,
            "violated": [],
            "total_violation": 0.0,
        }


class TestGaBalancedParamsAnchorCase:
    """data/ga_balanced_params.json is 18/18 feasible under the current L4
    formula (it was 17/18, violating only L4, under the original formula --
    see the module docstring's revision history)."""

    THETA = {
        "stw_yudhistira_hp": 130, "stw_yudhistira_dmg": 34, "stw_yudhistira_dr": 20,
        "stw_yudhistira_heal": 15, "stw_yudhistira_cost_satwika": 2, "stw_yudhistira_cost_univ": 1,
        "stw_arjuna_hp": 115, "stw_arjuna_pasupati_dmg": 50, "stw_arjuna_pasupati_cost": 3,
        "rjs_balarama_hp": 70, "rjs_balarama_dmg": 36, "rjs_balarama_cost": 3,
        "rjs_karna_hp": 90, "rjs_karna_dmg": 58, "rjs_karna_recoil": 10, "rjs_karna_cost": 1,
        "tms_sengkuni_hp": 100, "tms_sengkuni_dmg": 35, "tms_sengkuni_mill": 1,
        "tms_sengkuni_cost_tamasika": 1, "tms_sengkuni_cost_univ": 1,
        "tms_duryodana_hp": 123, "tms_duryodana_angkara_dmg": 39,
        "tms_duryodana_scale_value": 5, "tms_duryodana_angkara_cost": 2,
    }

    def test_all_18_satisfied(self):
        report = feasibility_report(self.THETA)
        assert report == {
            "feasible": True,
            "n_satisfied": 18,
            "violated": [],
            "total_violation": 0.0,
        }

    def test_l4_specifically_satisfied_with_slack(self):
        # max(karna=58, balarama=36, sengkuni=35, angkara=39) - pasupati(50) - 15
        # = 58 - 50 - 15 = -7 <= 0.
        assert constraint_violations(self.THETA)["L4"] == pytest.approx(-7.0)


class TestIndividualConstraintViolations:
    def test_L1_yudhistira_hp_must_exceed_arjuna_hp(self):
        theta = dict(FEASIBLE_BASE, stw_yudhistira_hp=100)  # <= arjuna_hp(110), > karna_hp(90)
        assert violated(theta) == {"L1"}

    def test_L2_L17_cascade_via_shared_yudhistira_dmg(self):
        # Raising yudhistira_dmg to 50 (== pasupati_dmg) trips L2 directly,
        # and also L17 (mean Satwika damage must stay below mean Rajasika
        # damage by >=0.5) -- a genuine interaction through one shared field.
        theta = dict(FEASIBLE_BASE, stw_yudhistira_dmg=50)
        assert violated(theta) == {"L2", "L17"}

    def test_L3_yudhistira_dr_must_be_positive(self):
        theta = dict(FEASIBLE_BASE, stw_yudhistira_dr=0)
        assert violated(theta) == {"L3"}

    def test_L4_pasupati_must_be_within_15_of_max_damage(self):
        # max(karna=60, balarama=35, sengkuni=35, angkara=40) - 40 - 15 = 5 > 0.
        theta = dict(FEASIBLE_BASE, stw_arjuna_pasupati_dmg=40)
        assert violated(theta) == {"L4"}
        assert constraint_violations(theta)["L4"] == pytest.approx(5.0)

    def test_L5_L4_cascade_via_shared_pasupati_fields(self):
        theta = dict(FEASIBLE_BASE, stw_arjuna_pasupati_dmg=40, stw_arjuna_pasupati_cost=2)
        assert violated(theta) == {"L4", "L5"}

    def test_L6_karna_dmg_must_exceed_balarama_dmg(self):
        theta = dict(FEASIBLE_BASE, rjs_balarama_dmg=60, rjs_karna_dmg=60)
        assert violated(theta) == {"L6"}

    def test_L7_karna_recoil_must_be_positive(self):
        theta = dict(FEASIBLE_BASE, rjs_karna_recoil=0)
        assert violated(theta) == {"L7"}

    def test_L8_karna_hp_must_be_below_yudhistira_hp(self):
        theta = dict(FEASIBLE_BASE, rjs_karna_hp=130, tms_duryodana_hp=140)
        assert violated(theta) == {"L8"}

    def test_L9_karna_hp_must_be_below_duryodana_hp(self):
        theta = dict(FEASIBLE_BASE, tms_duryodana_hp=115, rjs_karna_hp=115)
        assert violated(theta) == {"L9"}

    def test_L10_L17_cascade_via_shared_rajasika_damage(self):
        theta = dict(FEASIBLE_BASE, rjs_karna_dmg=25, rjs_balarama_dmg=20)
        assert violated(theta) == {"L10", "L17"}

    def test_L11_sengkuni_hp_must_be_below_duryodana_hp(self):
        theta = dict(FEASIBLE_BASE, tms_sengkuni_hp=130)
        assert violated(theta) == {"L11"}

    def test_L12_sengkuni_dmg_must_be_below_angkara_dmg(self):
        theta = dict(FEASIBLE_BASE, tms_sengkuni_dmg=40)
        assert violated(theta) == {"L12"}

    def test_L13_sengkuni_mill_must_be_at_least_one(self):
        theta = dict(FEASIBLE_BASE, tms_sengkuni_mill=0)
        assert violated(theta) == {"L13"}

    def test_L14_duryodana_hp_must_be_at_least_arjuna_hp(self):
        theta = dict(FEASIBLE_BASE, tms_duryodana_hp=109)
        assert violated(theta) == {"L14"}

    def test_L15_duryodana_scale_value_must_be_positive(self):
        theta = dict(FEASIBLE_BASE, tms_duryodana_scale_value=0)
        assert violated(theta) == {"L15"}

    def test_L16_mean_satwika_hp_must_exceed_mean_rajasika_hp(self):
        theta = dict(FEASIBLE_BASE, rjs_balarama_hp=140, rjs_karna_hp=100)
        assert violated(theta) == {"L16"}

    def test_L17_mean_rajasika_dmg_must_exceed_mean_satwika_dmg(self):
        theta = dict(FEASIBLE_BASE, stw_arjuna_pasupati_dmg=65)
        assert violated(theta) == {"L17"}

    def test_L18_karna_cost_must_not_exceed_pasupati_cost(self):
        # Unreachable within BOUNDS (rjs_karna_cost max=2 <= stw_arjuna_pasupati_cost
        # min=2), so this checks the raw g_k formula with an out-of-BOUNDS
        # synthetic value rather than a realistic theta.
        theta = dict(FEASIBLE_BASE, rjs_karna_cost=5, stw_arjuna_pasupati_cost=3)
        violations = constraint_violations(theta)
        assert violations["L18"] == pytest.approx(2.0)  # 5 - 3
        assert violations["L18"] > 0


class TestMeanMarginQuantum:
    """Locks in the 2026-09-17 correction: L16/L17 use margin 0.5 (the
    correct quantum for a difference of two integer-pair means), not the
    integer margin eps=1 that L1-L15/L18 use for direct integer
    comparisons. This must never silently regress back to eps=1 -- verified
    against exact hand-computable cases, not just re-checked against the
    module's own output.
    """

    def test_L17_exactly_at_the_half_integer_quantum_is_satisfied(self):
        # mean_rajasika_dmg = (35+60)/2 = 47.5 (SMART_START defaults).
        # Setting mean_satwika_dmg to exactly 47.0 (0.5 below) must SATISFY
        # L17 (47.5 - 47.0 = 0.5 gap, exactly at the quantum) -- this would
        # be VIOLATED under the old eps=1 rule (needs a full 1.0 gap) but is
        # correctly satisfied under eps=0.5.
        theta = dict(FEASIBLE_BASE, stw_yudhistira_dmg=30, stw_arjuna_pasupati_dmg=64)
        mean_satwika_dmg = (theta["stw_yudhistira_dmg"] + theta["stw_arjuna_pasupati_dmg"]) / 2
        mean_rajasika_dmg = (theta["rjs_balarama_dmg"] + theta["rjs_karna_dmg"]) / 2
        assert mean_rajasika_dmg - mean_satwika_dmg == pytest.approx(0.5)
        assert constraint_violations(theta)["L17"] == pytest.approx(0.0)
        assert "L17" not in violated(theta)

    def test_L17_a_hair_below_the_half_integer_quantum_is_violated(self):
        # Same setup, but mean_satwika_dmg only 0.0 below mean_rajasika_dmg
        # (an exact tie) -- must be VIOLATED (no gap at all).
        theta = dict(FEASIBLE_BASE, stw_yudhistira_dmg=30, stw_arjuna_pasupati_dmg=65)
        mean_satwika_dmg = (theta["stw_yudhistira_dmg"] + theta["stw_arjuna_pasupati_dmg"]) / 2
        mean_rajasika_dmg = (theta["rjs_balarama_dmg"] + theta["rjs_karna_dmg"]) / 2
        assert mean_rajasika_dmg - mean_satwika_dmg == pytest.approx(0.0)
        assert "L17" in violated(theta)

    def test_eps_0_5_and_strict_inequality_agree_on_a_sampled_case(self):
        # For any theta, g17_eps0.5 <= 0 must agree exactly with the plain
        # strict inequality mean_rajasika_dmg > mean_satwika_dmg -- this is
        # the "identical to strict '<'" property the human decision relies
        # on, checked directly rather than assumed.
        for pasupati_dmg in range(40, 66):
            theta = dict(FEASIBLE_BASE, stw_arjuna_pasupati_dmg=pasupati_dmg)
            mean_satwika_dmg = (theta["stw_yudhistira_dmg"] + theta["stw_arjuna_pasupati_dmg"]) / 2
            mean_rajasika_dmg = (theta["rjs_balarama_dmg"] + theta["rjs_karna_dmg"]) / 2
            g17_satisfied = constraint_violations(theta)["L17"] <= 0
            strict_satisfied = mean_rajasika_dmg > mean_satwika_dmg
            assert g17_satisfied == strict_satisfied, f"mismatch at pasupati_dmg={pasupati_dmg}"

    def test_integer_constraints_still_use_full_margin_eps_1(self):
        # Sanity check that the eps=0.5 correction is scoped to L16/L17 only
        # -- a pure-integer constraint like L1 must still require a full
        # 1-point gap, not 0.5.
        # L1: stw_yudhistira_hp > stw_arjuna_hp. Exactly equal (gap=0) must violate.
        theta_tie = dict(FEASIBLE_BASE, stw_yudhistira_hp=FEASIBLE_BASE["stw_arjuna_hp"])
        assert "L1" in violated(theta_tie)
        # A gap of exactly 1 must satisfy it.
        theta_gap1 = dict(FEASIBLE_BASE, stw_yudhistira_hp=FEASIBLE_BASE["stw_arjuna_hp"] + 1)
        assert "L1" not in violated(theta_gap1)


class TestAggregateHelpers:
    def test_total_violation_sums_only_positive_terms(self):
        theta = dict(FEASIBLE_BASE, stw_yudhistira_dr=0, stw_arjuna_pasupati_dmg=40)
        violations = constraint_violations(theta)
        expected = sum(max(0.0, g) for g in violations.values())
        assert total_violation(theta) == pytest.approx(expected)
        assert total_violation(theta) > 0

    def test_is_feasible_matches_zero_total_violation(self):
        assert is_feasible(FEASIBLE_BASE) is True
        assert total_violation(FEASIBLE_BASE) == 0.0

        infeasible = dict(FEASIBLE_BASE, stw_yudhistira_dr=0)
        assert is_feasible(infeasible) is False
        assert total_violation(infeasible) > 0.0

    def test_constraint_violations_covers_all_18_ids(self):
        violations = constraint_violations(FEASIBLE_BASE)
        assert set(violations) == {f"L{i}" for i in range(1, 19)}

    def test_lore_constraints_metadata_has_all_18_in_order(self):
        assert [c.id for c in LORE_CONSTRAINTS] == [f"L{i}" for i in range(1, 19)]
        for c in LORE_CONSTRAINTS:
            assert c.expr and c.rationale and c.source
