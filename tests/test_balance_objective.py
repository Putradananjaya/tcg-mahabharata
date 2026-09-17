"""Unit tests for src.metrics.balance_objective against exact, hand-derived
cases (Aturan Main §7) -- in particular, the rock-paper-scissors-degenerate
scenario the module's own docstring names as its motivating example: perfect
marginal parity can coexist with badly lopsided pairwise matchups, and
balance_objective must be able to tell the two apart.
"""
import pytest

from src.metrics.balance_objective import balance_objective, marginal_win_rates
from src.metrics.payoff_matrix import PayoffCell, PayoffMatrix
from src.metrics.winrate import wilson_ci

NAMES = ["A", "B", "C"]
IDENTITY_OK = {"mean_pairwise_jsd": 0.5}  # well above the default 0.3 target


def make_matrix(win_rates: dict) -> PayoffMatrix:
    """win_rates: {(row, col): win_rate_as_fraction_of_100} for every
    ordered pair including mirrors; builds exact Wilson CIs via n=100 so
    win_rate() reproduces the fraction exactly (wins/100)."""
    cells = {}
    for (row, col), wr in win_rates.items():
        wins = round(wr * 100)
        cells[(row, col)] = PayoffCell(row=row, col=col, wins=wins, n=100, ci=wilson_ci(wins, 100))
    return PayoffMatrix(names=NAMES, cells=cells)


class TestMarginalWinRates:
    def test_perfect_balance_gives_exact_fifty_percent_for_everyone(self):
        matrix = make_matrix({(a, b): 0.5 for a in NAMES for b in NAMES})
        result = marginal_win_rates(matrix)
        assert result == {name: pytest.approx(0.5) for name in NAMES}

    def test_excludes_the_mirror_cell_from_the_average(self):
        # Mirror cells (A vs A) are deliberately excluded; if they were
        # included by mistake, a wildly off mirror win rate would drag the
        # marginal average away from 0.5 even though both real matchups are
        # perfectly balanced.
        win_rates = {(a, b): 0.5 for a in NAMES for b in NAMES}
        win_rates[("A", "A")] = 0.99  # buggy mirror match, should be ignored
        matrix = make_matrix(win_rates)
        assert marginal_win_rates(matrix)["A"] == pytest.approx(0.5)


class TestBalanceObjectiveRPSDegenerate:
    """A beats B 70%, B beats C 70%, C beats A 70% -- every faction's
    marginal win rate averages to exactly 50% (0.7 vs one opponent, 0.3 vs
    the other), while every individual matchup is a lopsided 70/30. This is
    the exact scenario balance_objective's docstring says it exists to
    catch that a single marginal-win-rate number cannot."""

    @pytest.fixture
    def rps_matrix(self):
        win_rates = {(name, name): 0.5 for name in NAMES}
        win_rates[("A", "B")] = 0.7
        win_rates[("B", "A")] = 0.3
        win_rates[("B", "C")] = 0.7
        win_rates[("C", "B")] = 0.3
        win_rates[("C", "A")] = 0.7
        win_rates[("A", "C")] = 0.3
        return make_matrix(win_rates)

    def test_marginal_parity_is_perfect(self, rps_matrix):
        result = balance_objective(rps_matrix, IDENTITY_OK)
        assert result.marginal_parity_deviation == pytest.approx(0.0, abs=1e-9)

    def test_pairwise_deviation_is_not_zero(self, rps_matrix):
        result = balance_objective(rps_matrix, IDENTITY_OK)
        # 6 ordered off-diagonal pairs, each |0.7-0.5| or |0.3-0.5| = 0.2 ->
        # (0.2)^2 * 6 = 0.24 exactly.
        assert result.pairwise_deviation == pytest.approx(0.24, abs=1e-9)

    def test_total_is_dominated_by_pairwise_term_despite_perfect_marginals(self, rps_matrix):
        result = balance_objective(rps_matrix, IDENTITY_OK)
        assert result.total == pytest.approx(0.24, abs=1e-9)
        assert result.total > 0  # would be 0 if marginal parity alone were used


class TestBalanceObjectivePerfectBalance:
    def test_all_terms_zero_when_everything_is_exactly_fifty_fifty(self):
        matrix = make_matrix({(a, b): 0.5 for a in NAMES for b in NAMES})
        result = balance_objective(matrix, IDENTITY_OK)
        assert result.total == pytest.approx(0.0, abs=1e-9)
        assert result.marginal_parity_deviation == pytest.approx(0.0, abs=1e-9)
        assert result.pairwise_deviation == pytest.approx(0.0, abs=1e-9)
        assert result.identity_penalty == 0.0

    def test_identity_penalty_kicks_in_below_target(self):
        matrix = make_matrix({(a, b): 0.5 for a in NAMES for b in NAMES})
        low_identity = {"mean_pairwise_jsd": 0.1}  # below default target of 0.3
        result = balance_objective(matrix, low_identity, identity_target=0.3)
        assert result.identity_penalty == pytest.approx((0.3 - 0.1) ** 2)

    def test_identity_above_target_is_not_rewarded_or_penalized(self):
        matrix = make_matrix({(a, b): 0.5 for a in NAMES for b in NAMES})
        high_identity = {"mean_pairwise_jsd": 0.9}
        result = balance_objective(matrix, high_identity, identity_target=0.3)
        assert result.identity_penalty == 0.0
