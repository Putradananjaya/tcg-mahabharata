"""Unit tests for src.metrics.hypervolume against reference values verified
two independent ways (Aturan Main §7): the inclusion-exclusion formula
itself, and a fine-grained numerical grid integration (2000x2000 cells)
done separately from this module's implementation. Both agree to the
reported precision -- see the derivation session, not re-derived here by
calling hypervolume() itself.
"""
import pytest

from src.metrics.hypervolume import hypervolume


class TestHypervolume2D:
    def test_matches_grid_integration_reference(self):
        # Classic 3-point non-dominated front example; cross-validated
        # against a 2000x2000 grid numerical integration -> 11.0 exactly
        # (to the grid's resolution).
        points = [(1, 4), (2, 2), (4, 1)]
        reference = (5, 5)
        assert hypervolume(points, reference) == pytest.approx(11.0, abs=1e-9)

    def test_single_point_is_a_simple_rectangle(self):
        assert hypervolume([(2, 3)], (5, 5)) == pytest.approx((5 - 2) * (5 - 3))

    def test_dominated_point_contributes_nothing_beyond_the_dominant_one(self):
        # (3, 3) is dominated by (1, 1) in both objectives -- adding it
        # should not change the hypervolume at all.
        hv_without = hypervolume([(1, 1)], (5, 5))
        hv_with = hypervolume([(1, 1), (3, 3)], (5, 5))
        assert hv_with == pytest.approx(hv_without)

    def test_point_outside_reference_contributes_zero(self):
        # A point worse than the reference in some dimension shouldn't
        # blow up or subtract volume -- it just contributes nothing there.
        assert hypervolume([(6, 1)], (5, 5)) == pytest.approx(0.0)


class TestHypervolume3D:
    def test_two_corner_points_via_inclusion_exclusion(self):
        # Their dominated boxes [1,6]x[5,6]x[5,6] and [5,6]x[1,6]x[5,6] DO
        # overlap in the shared far corner [5,6]x[5,6]x[5,6] (volume 1) --
        # union = vol1 + vol2 - intersection, verified by hand, not assumed
        # disjoint.
        p1, p2 = (1, 5, 5), (5, 1, 5)
        reference = (6, 6, 6)
        vol1 = (6 - 1) * (6 - 5) * (6 - 5)
        vol2 = (6 - 5) * (6 - 1) * (6 - 5)
        intersection = (6 - 5) * (6 - 5) * (6 - 5)
        assert hypervolume([p1, p2], reference) == pytest.approx(vol1 + vol2 - intersection)


class TestHypervolumeEdgeCases:
    def test_empty_front_has_zero_hypervolume(self):
        assert hypervolume([], (5, 5)) == 0.0

    def test_rejects_mismatched_dimensionality(self):
        with pytest.raises(ValueError):
            hypervolume([(1, 2, 3)], (5, 5))
