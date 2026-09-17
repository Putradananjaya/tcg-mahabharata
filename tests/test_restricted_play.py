"""Unit tests for src.metrics.restricted_play against an exact,
hand-verifiable deterministic case (Aturan Main §7).
"""
import pytest

from src.metrics.restricted_play import restricted_play_depth


class TestRestrictedPlayDepth:
    def test_exact_depth_for_deterministic_all_or_nothing_outcomes(self):
        # Baseline always wins (1.0), restricted always loses (0.0),
        # regardless of seed -- depth must be exactly 1.0 with zero
        # variance (both series are constant).
        result = restricted_play_depth(
            baseline_run_fn=lambda seed: 1.0,
            restricted_run_fn=lambda seed: 0.0,
            n=15,
        )
        assert result["baseline_win_rate"] == 1.0
        assert result["restricted_win_rate"] == 0.0
        assert result["depth"] == pytest.approx(1.0)
        assert result["depth_ci_95"] == pytest.approx((1.0, 1.0))

    def test_decorative_mechanic_has_zero_depth(self):
        # Banning the mechanic changes nothing -- both functions return the
        # identical deterministic outcome for every seed (mirrors the real
        # heal_bench_card no-op finding in rules_spec.md 4.3).
        def run(seed):
            return float(seed % 2)

        result = restricted_play_depth(run, run, n=20)
        assert result["depth"] == 0.0
        assert result["paired_correlation"] == pytest.approx(1.0)

    def test_depth_sign_convention_positive_means_mechanic_helps(self):
        # baseline (mechanic available) wins more than restricted -> positive depth.
        result = restricted_play_depth(
            baseline_run_fn=lambda seed: 0.7,
            restricted_run_fn=lambda seed: 0.3,
            n=10,
        )
        assert result["depth"] == pytest.approx(0.4)
