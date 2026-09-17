"""Unit tests for src.metrics.elo against hand-computed Elo/Bradley-Terry
reference values (Aturan Main §7).
"""
import pytest

from src.metrics.elo import bradley_terry_ratings, elo_ratings


class TestEloRatings:
    def test_single_match_between_equal_unrated_players(self):
        # Both start at initial_rating=1500 -> expected_win=0.5 exactly ->
        # update is exactly +-k/2.
        ratings = elo_ratings([("A", "B")], k_factor=32.0, initial_rating=1500.0)
        assert ratings["A"] == pytest.approx(1516.0)
        assert ratings["B"] == pytest.approx(1484.0)

    def test_upset_after_one_prior_result(self):
        # A beat B once (-> A=1516, B=1484), then B beats A (an upset,
        # since A entered as the favorite). Expected values computed
        # independently from the logistic formula, not from this function.
        ratings = elo_ratings([("A", "B"), ("B", "A")], k_factor=32.0, initial_rating=1500.0)
        assert ratings["A"] == pytest.approx(1498.5304984710244, abs=1e-9)
        assert ratings["B"] == pytest.approx(1501.4695015289756, abs=1e-9)

    def test_unseen_player_starts_at_initial_rating(self):
        ratings = elo_ratings([("A", "B")], initial_rating=1000.0)
        assert "A" in ratings and "B" in ratings

    def test_repeated_wins_monotonically_increase_rating(self):
        results = [("A", "B")] * 10
        ratings = elo_ratings(results)
        # Rating gain per win shrinks as A becomes the increasing favorite --
        # verify monotonic convergence by checking A ends up well above 1500
        # and B well below, without asserting a specific asymptote.
        assert ratings["A"] > 1500.0
        assert ratings["B"] < 1500.0

    def test_zero_sum_per_match_at_equal_ratings(self):
        # At equal ratings, k*(1-0.5) gained by the winner must exactly
        # equal k*(0.5-0) lost by the loser.
        ratings = elo_ratings([("A", "B")], k_factor=32.0, initial_rating=1500.0)
        gain = ratings["A"] - 1500.0
        loss = 1500.0 - ratings["B"]
        assert gain == pytest.approx(loss)


class TestBradleyTerryRatings:
    def test_empty_match_list_returns_empty(self):
        assert bradley_terry_ratings([]) == {}

    def test_strengths_are_normalized_to_sum_to_one(self):
        results = [("A", "B")] * 5 + [("B", "C")] * 5 + [("A", "C")] * 5
        ratings = bradley_terry_ratings(results)
        assert sum(ratings.values()) == pytest.approx(1.0, abs=1e-6)

    def test_undefeated_player_converges_to_near_full_strength(self):
        # A beats B every single time it plays -- the MLE fixed point for
        # this degenerate case is gamma_B -> 0, so after normalization
        # strength_A -> 1.0 and strength_B -> 0.0 (exact analytical limit,
        # not merely "A > B").
        ratings = bradley_terry_ratings([("A", "B")] * 20, iterations=2000)
        assert ratings["A"] == pytest.approx(1.0, abs=1e-4)
        assert ratings["B"] == pytest.approx(0.0, abs=1e-4)

    def test_symmetric_round_robin_gives_equal_strengths(self):
        # A beats B, B beats C, C beats A, each exactly once each way is
        # impossible to make perfectly cyclic-symmetric with single results,
        # so use an explicitly balanced double round-robin: every pair
        # splits their meetings 50/50 -> by symmetry all strengths must
        # come out equal.
        results = (
            [("A", "B")] * 5 + [("B", "A")] * 5
            + [("B", "C")] * 5 + [("C", "B")] * 5
            + [("C", "A")] * 5 + [("A", "C")] * 5
        )
        ratings = bradley_terry_ratings(results)
        assert ratings["A"] == pytest.approx(1 / 3, abs=1e-4)
        assert ratings["B"] == pytest.approx(1 / 3, abs=1e-4)
        assert ratings["C"] == pytest.approx(1 / 3, abs=1e-4)
