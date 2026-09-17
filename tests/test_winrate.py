"""Unit tests for src.metrics.winrate against independently-derived reference
values (Aturan Main §7: statistical functions must be tested against known
reference values, not just round-tripped through themselves).

Wilson CI reference values below were computed from the closed-form formula
independently of this module's implementation (see the derivation script
used to produce them; not re-derived by calling wilson_ci itself).
"""
import math

import pytest

from src.metrics.winrate import paired_comparison, required_n, standard_error, wilson_ci


class TestWilsonCI:
    def test_matches_independently_computed_reference_values(self):
        cases = [
            # (wins, n, expected_lower, expected_upper)
            (1, 1, 0.2065493143772375, 1.0),
            (50, 100, 0.4038315303659957, 0.5961684696340044),
            (0, 10, 0.0, 0.27753279986288903),
            (9, 10, 0.5958499732047616, 0.982123786904927),
            (740, 783, 0.9268442775862556, 0.9589758481664633),
        ]
        for wins, n, lo, hi in cases:
            result = wilson_ci(wins, n)
            assert result.lower == pytest.approx(lo, abs=1e-9)
            assert result.upper == pytest.approx(hi, abs=1e-9)
            assert result.p_hat == pytest.approx(wins / n)

    def test_interval_is_narrower_than_naive_wald_near_extremes(self):
        # Wald (p_hat +/- z*SE) would give a lower bound *below* 0 for wins=0;
        # Wilson must stay within [0, 1] and not report a negative lower bound.
        result = wilson_ci(0, 10)
        assert result.lower == 0.0
        assert 0.0 <= result.upper <= 1.0

    def test_symmetric_around_50pct_at_p_hat_half(self):
        result = wilson_ci(50, 100)
        assert result.p_hat == 0.5
        assert (result.lower + result.upper) / 2 == pytest.approx(0.5, abs=1e-9)

    def test_rejects_invalid_inputs(self):
        with pytest.raises(ValueError):
            wilson_ci(1, 0)
        with pytest.raises(ValueError):
            wilson_ci(-1, 10)
        with pytest.raises(ValueError):
            wilson_ci(11, 10)


class TestStandardError:
    def test_exact_closed_form_values(self):
        # SE = sqrt(p(1-p)/n); worst case p=0.5 -> SE = 0.5/sqrt(n)
        assert standard_error(100) == pytest.approx(0.05)
        assert standard_error(400) == pytest.approx(0.025)
        assert standard_error(25, p=0.2) == pytest.approx(math.sqrt(0.16 / 25))

    def test_rejects_invalid_inputs(self):
        with pytest.raises(ValueError):
            standard_error(0)
        with pytest.raises(ValueError):
            standard_error(10, p=1.5)


class TestRequiredN:
    def test_matches_claims_ledger_documented_value(self):
        # CLAIMS_LEDGER.md "Win-rate reporting standard": this exact call is
        # documented as producing 19620 -- the derivation for N_MATCH=20000.
        assert required_n(delta=0.01, alpha=0.05, power=0.8) == 19620

    def test_larger_delta_needs_fewer_games(self):
        assert required_n(delta=0.05) < required_n(delta=0.01)

    def test_rejects_invalid_inputs(self):
        with pytest.raises(ValueError):
            required_n(delta=0.0)
        with pytest.raises(ValueError):
            required_n(delta=0.01, power=1.0)
        with pytest.raises(ValueError):
            required_n(delta=0.6, p0=0.5)  # p0 + delta must stay in (0, 1)


class TestPairedComparison:
    def test_exact_result_when_conditions_are_deterministic_and_disjoint(self):
        # Condition A always "wins" (1.0), condition B always "loses" (0.0),
        # regardless of seed -- a fully deterministic, hand-verifiable case.
        result = paired_comparison(lambda seed: 1.0, lambda seed: 0.0, n=20, base_seed=0)
        assert result["mean_a"] == 1.0
        assert result["mean_b"] == 0.0
        assert result["mean_diff"] == -1.0
        assert result["se_diff"] == 0.0  # zero variance -> zero standard error
        assert result["ci_diff"] == (-1.0, -1.0)
        # constant series -> zero variance -> correlation defined as 0.0, not NaN
        assert result["paired_correlation"] == 0.0

    def test_identical_conditions_give_zero_diff_and_perfect_correlation(self):
        def run(seed):
            return float(seed % 2)

        result = paired_comparison(run, run, n=10, base_seed=0)
        assert result["mean_diff"] == 0.0
        assert result["paired_correlation"] == pytest.approx(1.0)

    def test_uses_common_random_numbers_same_seed_both_sides(self):
        seen_a, seen_b = [], []

        def run_a(seed):
            seen_a.append(seed)
            return 1.0

        def run_b(seed):
            seen_b.append(seed)
            return 0.0

        paired_comparison(run_a, run_b, n=5, base_seed=100)
        assert seen_a == seen_b == [100, 101, 102, 103, 104]

    def test_rejects_invalid_n(self):
        with pytest.raises(ValueError):
            paired_comparison(lambda s: 1.0, lambda s: 0.0, n=0)
