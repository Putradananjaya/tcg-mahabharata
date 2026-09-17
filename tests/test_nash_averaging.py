"""Unit tests for src.metrics.nash_averaging against a classic closed-form
reference case (Aturan Main §7): Rock-Paper-Scissors is the textbook example
for maxent Nash averaging (Balduzzi et al. 2018) because its equilibrium is
known analytically -- uniform (1/3, 1/3, 1/3), every strategy in the
support, every strategy exactly indifferent (nash_rating ~ 0), entropy =
ln(3) nats.
"""
import math

import pytest

from src.metrics.nash_averaging import nash_average


RPS_PAYOFF = [
    # rows/cols in order R, P, S; payoff[i][j] = P(i beats j)
    [0.5, 0.0, 1.0],  # Rock: loses to Paper, beats Scissors
    [1.0, 0.5, 0.0],  # Paper: beats Rock, loses to Scissors
    [0.0, 1.0, 0.5],  # Scissors: loses to Rock, beats Paper
]


class TestNashAverageRPS:
    def test_equilibrium_is_uniform(self):
        result = nash_average(RPS_PAYOFF, names=["R", "P", "S"])
        for name in ["R", "P", "S"]:
            assert result["nash_mixture"][name] == pytest.approx(1 / 3, abs=1e-6)

    def test_every_strategy_is_in_the_support(self):
        result = nash_average(RPS_PAYOFF, names=["R", "P", "S"])
        assert set(result["support"]) == {"R", "P", "S"}

    def test_nash_ratings_are_all_zero_by_symmetry(self):
        result = nash_average(RPS_PAYOFF, names=["R", "P", "S"])
        for name in ["R", "P", "S"]:
            assert result["nash_rating"][name] == pytest.approx(0.0, abs=1e-6)

    def test_entropy_equals_ln_3(self):
        result = nash_average(RPS_PAYOFF, names=["R", "P", "S"])
        assert result["entropy"] == pytest.approx(math.log(3), abs=1e-6)


class TestNashAverageDominatedStrategy:
    def test_strictly_dominated_strategy_is_excluded_from_support(self):
        # A "weak scissors" that also loses to Paper (in addition to losing
        # to Rock) is strictly dominated for Scissors's usual role and must
        # receive zero equilibrium mass.
        payoff = [
            [0.5, 0.0, 1.0],
            [1.0, 0.5, 1.0],  # Paper now also beats "Scissors" here
            [0.0, 0.0, 0.5],
        ]
        result = nash_average(payoff, names=["R", "P", "S"])
        assert result["nash_mixture"]["S"] == pytest.approx(0.0, abs=1e-6)
        assert "S" not in result["support"]


class TestNashAverageValidation:
    def test_rejects_non_square_matrix(self):
        with pytest.raises(ValueError):
            nash_average([[0.5, 0.5], [0.5, 0.5], [0.5, 0.5]])

    def test_rejects_mismatched_names_length(self):
        with pytest.raises(ValueError):
            nash_average(RPS_PAYOFF, names=["R", "P"])
