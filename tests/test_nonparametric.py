"""Unit tests for src.metrics.nonparametric.wilcoxon_signed_rank against
hand-derived reference cases (Aturan Main §7). Both cases below are
constructed to be exactly solvable by hand, not approximated:

Case 1 (all same-direction, same-magnitude diffs): every pair has y > x by
the same margin, so all ranks go to W-, W+ = 0, AND all |diff| are equal to
each other -- which ties every rank into a single group at the average rank
(n+1)/2 and triggers the tie-correction term
tie_correction = sum(t**3 - t)/48 = (5**3 - 5)/48 = 2.5. The reference
z/p values below are hand-derived including that correction:
mean_w = n(n+1)/4 = 7.5; var_w = n(n+1)(2n+1)/24 - tie_correction
= 13.75 - 2.5 = 11.25; z = (0 - mean_w - (-0.5)) / sqrt(11.25).

Case 2 (perfectly symmetric, tied |diff|): two pairs favor x, two favor y,
by the same absolute margin -- W+ == W- exactly, so z=0, p=1.0,
rank_biserial_r=0.0 exactly, with no floating-point approximation needed.
"""
import pytest

from src.metrics.nonparametric import wilcoxon_signed_rank


class TestWilcoxonSignedRank:
    def test_all_differences_same_direction_and_magnitude(self):
        x = [1, 2, 3, 4, 5]
        y = [2, 3, 4, 5, 6]  # y - x = +1 for every pair -> all ranks to W-
        result = wilcoxon_signed_rank(x, y)

        assert result.n_pairs == 5
        assert result.n_ties_dropped == 0
        assert result.w_statistic == 0.0  # W+ = 0 exactly
        assert result.z == pytest.approx(-2.0869967789998034, abs=1e-9)
        assert result.p_value == pytest.approx(0.036888425707049866, abs=1e-9)
        assert result.rank_biserial_r == pytest.approx(-1.0)

    def test_perfectly_symmetric_case_gives_exact_null_result(self):
        x = [1, 2, 3, 4]
        y = [2, 1, 4, 3]  # diffs = [-1, +1, -1, +1], all |diff| tied at 1
        result = wilcoxon_signed_rank(x, y)

        assert result.n_pairs == 4
        assert result.w_statistic == pytest.approx(5.0)  # W+ == W- == 5 exactly
        assert result.z == pytest.approx(0.0, abs=1e-12)
        assert result.p_value == pytest.approx(1.0)
        assert result.rank_biserial_r == pytest.approx(0.0, abs=1e-12)

    def test_zero_differences_are_dropped_as_ties(self):
        x = [1, 2, 3, 4]
        y = [1, 2, 5, 6]  # first two pairs tie exactly (diff=0)
        result = wilcoxon_signed_rank(x, y)
        assert result.n_ties_dropped == 2
        assert result.n_pairs == 2

    def test_all_ties_returns_null_result_without_dividing_by_zero(self):
        result = wilcoxon_signed_rank([1, 1, 1], [1, 1, 1])
        assert result.n_pairs == 0
        assert result.p_value == 1.0
        assert result.rank_biserial_r == 0.0

    def test_rejects_mismatched_lengths(self):
        with pytest.raises(ValueError):
            wilcoxon_signed_rank([1, 2], [1, 2, 3])
