"""Unit tests for src.metrics.payoff_matrix against deterministic,
hand-verifiable play functions (Aturan Main §7).
"""
import pytest

from src.metrics.payoff_matrix import build_payoff_matrix


class TestBuildPayoffMatrix:
    def test_counts_wins_correctly_for_a_deterministic_outcome_table(self):
        outcomes = {
            ("A", "A"): 1,  # mirror match, A always "wins" by this fixture's rule
            ("A", "B"): 1,  # A always beats B
            ("B", "A"): 0,
            ("B", "B"): 1,  # mirror match, B always "wins" by this fixture's rule
        }

        def play(row, col, seed):
            return outcomes[(row, col)]

        matrix = build_payoff_matrix(["A", "B"], play, n=5)

        assert matrix.cell("A", "A").wins == 5
        assert matrix.cell("A", "B").wins == 5
        assert matrix.cell("B", "A").wins == 0
        assert matrix.cell("B", "B").wins == 5

        assert matrix.win_rate("A", "B") == 1.0
        assert matrix.win_rate("B", "A") == 0.0

    def test_mirror_deviation_flags_a_non_50pct_mirror_match(self):
        def play(row, col, seed):
            return 1  # everyone "wins" every game, including mirrors

        matrix = build_payoff_matrix(["A", "B"], play, n=10)
        # Both mirror cells are 100%, i.e. |1.0 - 0.5| = 0.5 deviation --
        # exactly the kind of engine-bug signal this method exists to catch
        # (see rules_spec.md 1.2 / 4.5).
        assert matrix.max_mirror_deviation() == pytest.approx(0.5)

    def test_each_cell_uses_a_disjoint_seed_range(self):
        seen = []

        def play(row, col, seed):
            seen.append(seed)
            return 0

        names = ["A", "B", "C"]
        n = 4
        build_payoff_matrix(names, play, n=n, base_seed=0)
        # 3x3 = 9 cells x 4 games = 36 calls, and the seed-stride design
        # means no two cells should ever reuse the same seed.
        assert len(seen) == 9 * n
        assert len(set(seen)) == len(seen)

    def test_seeds_are_reproducible_given_the_same_base_seed(self):
        captured_runs = []

        def play(row, col, seed):
            captured_runs.append(seed)
            return seed % 2

        build_payoff_matrix(["A", "B"], play, n=3, base_seed=42)
        first_run = list(captured_runs)
        captured_runs.clear()
        build_payoff_matrix(["A", "B"], play, n=3, base_seed=42)
        assert captured_runs == first_run

    def test_rejects_duplicate_names(self):
        with pytest.raises(ValueError):
            build_payoff_matrix(["A", "A"], lambda r, c, s: 0, n=5)

    def test_rejects_non_positive_n(self):
        with pytest.raises(ValueError):
            build_payoff_matrix(["A", "B"], lambda r, c, s: 0, n=0)
