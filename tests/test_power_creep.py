"""Unit tests for src.metrics.power_creep against its own documented formula
(Aturan Main §7): raw_power_delta_i = POWER_SIGN[i] * (theta_i - SMART_START_i)
/ span_i, aggregated as a mean, penalized as max(0, .)**2. The reference
values below are computed by an independent re-implementation of that same
documented formula inside this test file (test_reference_aggregate_power_delta),
not by calling the module's own function -- so this checks the
implementation against its own spec, not against itself.
"""
import pytest

from src.metrics.power_creep import BOUNDS, POWER_SIGN, SMART_START, aggregate_power_delta, power_creep_penalty


def reference_aggregate_power_delta(theta: dict) -> float:
    """Independent re-implementation of the module docstring's formula."""
    deltas = []
    for key, sign in POWER_SIGN.items():
        low, high = BOUNDS[key]
        span = high - low
        deltas.append(sign * (theta[key] - SMART_START[key]) / span)
    return sum(deltas) / len(deltas)


class TestAggregatePowerDelta:
    def test_zero_at_smart_start_itself(self):
        # theta == SMART_START -> every term is sign * 0 / span = 0.
        assert aggregate_power_delta(dict(SMART_START)) == 0.0

    def test_matches_independent_reference_implementation(self):
        # Perturb every dimension partway toward its BOUNDS high (or low,
        # alternating) and check against the independently-coded formula.
        theta = {}
        for i, key in enumerate(SMART_START):
            low, high = BOUNDS[key]
            theta[key] = low + (high - low) * (0.25 if i % 2 == 0 else 0.75)
        assert aggregate_power_delta(theta) == pytest.approx(reference_aggregate_power_delta(theta))

    def test_single_dimension_raised_to_its_bound_high(self):
        theta = dict(SMART_START)
        key = "stw_yudhistira_hp"
        low, high = BOUNDS[key]
        theta[key] = high
        expected = (1.0 * (high - SMART_START[key]) / (high - low)) / len(POWER_SIGN)
        assert aggregate_power_delta(theta) == pytest.approx(expected)

    def test_range_is_bounded_within_plus_minus_one(self):
        # Each raw_power_delta_i term is a signed fraction of its own BOUNDS
        # span, so it's confined to [-1, 1] for any theta within BOUNDS --
        # and so is their mean. (Reaching exactly +-1 on every term
        # simultaneously would additionally require SMART_START to sit at
        # the opposite BOUNDS extreme on every dimension, which it does not
        # -- so this checks the true invariant, not a specific SMART_START
        # coincidence.)
        theta_max = {}
        theta_min = {}
        for key, sign in POWER_SIGN.items():
            low, high = BOUNDS[key]
            theta_max[key] = high if sign == 1 else low
            theta_min[key] = low if sign == 1 else high
        assert -1.0 <= aggregate_power_delta(theta_max) <= 1.0
        assert -1.0 <= aggregate_power_delta(theta_min) <= 1.0
        # The all-powerful-extreme theta must score higher than the
        # all-weak-extreme theta.
        assert aggregate_power_delta(theta_max) > aggregate_power_delta(theta_min)


class TestPowerCreepPenalty:
    def test_zero_at_smart_start(self):
        assert power_creep_penalty(dict(SMART_START)) == 0.0

    def test_net_weaker_than_smart_start_is_not_penalized(self):
        # One-sided by construction: only net power INCREASE is penalized.
        theta = dict(SMART_START)
        key = "stw_yudhistira_hp"
        low, _ = BOUNDS[key]
        theta[key] = low  # weaker than SMART_START on a +1-power-sign field
        assert power_creep_penalty(theta) == 0.0

    def test_net_stronger_than_smart_start_is_penalized_quadratically(self):
        theta = {}
        for key, sign in POWER_SIGN.items():
            low, high = BOUNDS[key]
            theta[key] = high if sign == 1 else low
        expected = max(0.0, reference_aggregate_power_delta(theta)) ** 2
        assert power_creep_penalty(theta) == pytest.approx(expected)
        assert power_creep_penalty(theta) > 0.0

    def test_power_sign_classifies_every_bounds_dimension_exactly_once(self):
        assert set(POWER_SIGN) == set(BOUNDS)
