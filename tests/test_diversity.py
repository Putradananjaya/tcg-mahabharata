"""Unit tests for src.metrics.diversity against exact closed-form reference
values (Aturan Main §7).
"""
import math

import pytest

from src.metrics.diversity import (
    faction_identity_index,
    jensen_shannon_divergence,
    strategy_entropy,
)


class TestJensenShannonDivergence:
    def test_identical_distributions_have_zero_divergence(self):
        p = {"attack_a": 3, "attack_b": 7}
        assert jensen_shannon_divergence(p, dict(p)) == pytest.approx(0.0, abs=1e-12)

    def test_disjoint_supports_hit_the_maximum_one_bit(self):
        # p and q never choose the same action at all -> JSD = 1 bit exactly.
        # M = {a: 0.5, b: 0.5}; KL(p||M) = 1*log2(1/0.5) = 1 bit, symmetric
        # for q -> JSD = 0.5*1 + 0.5*1 = 1.0.
        p = {"a": 1.0}
        q = {"b": 1.0}
        assert jensen_shannon_divergence(p, q) == pytest.approx(1.0, abs=1e-12)

    def test_normalizes_unnormalized_count_dicts(self):
        # Raw counts, not probabilities -- should normalize internally and
        # give the same result as the already-normalized version.
        raw = {"a": 30, "b": 70}
        normalized = {"a": 0.3, "b": 0.7}
        assert jensen_shannon_divergence(raw, raw) == pytest.approx(
            jensen_shannon_divergence(normalized, normalized), abs=1e-12
        )

    def test_missing_category_in_one_distribution_is_treated_as_zero(self):
        p = {"a": 1.0, "b": 1.0}
        q = {"a": 1.0}
        # Should not raise despite "b" being absent from q.
        result = jensen_shannon_divergence(p, q)
        assert 0.0 < result <= 1.0

    def test_rejects_zero_total_mass(self):
        with pytest.raises(ValueError):
            jensen_shannon_divergence({"a": 0}, {"a": 1})


class TestStrategyEntropy:
    def test_uniform_distribution_over_all_declared_actions_is_maximal(self):
        counts = {"a": 25, "b": 25, "c": 25, "d": 25}
        assert strategy_entropy(counts, total_possible_actions=4) == pytest.approx(1.0)

    def test_uniform_over_used_subset_still_scores_below_one_if_more_exist(self):
        # Only 2 of 5 possible actions ever get used, but evenly -- entropy
        # over the used subset is maximal (1 bit) but normalized against 5
        # possible actions it's log2(2)/log2(5).
        counts = {"a": 10, "b": 10}
        result = strategy_entropy(counts, total_possible_actions=5)
        assert result == pytest.approx(math.log2(2) / math.log2(5))

    def test_single_category_has_zero_entropy(self):
        assert strategy_entropy({"a": 100}) == 0.0

    def test_no_actions_taken_returns_zero(self):
        assert strategy_entropy({}) == 0.0
        assert strategy_entropy({"a": 0, "b": 0}) == 0.0


class TestFactionIdentityIndex:
    def test_identical_factions_have_zero_mean_jsd(self):
        counts = {"a": 5, "b": 5}
        result = faction_identity_index({"SATWIKA": dict(counts), "TAMASIKA": dict(counts)})
        assert result["mean_pairwise_jsd"] == pytest.approx(0.0, abs=1e-12)

    def test_maximally_distinct_factions_hit_one_bit(self):
        result = faction_identity_index({"SATWIKA": {"a": 1.0}, "TAMASIKA": {"b": 1.0}})
        assert result["mean_pairwise_jsd"] == pytest.approx(1.0, abs=1e-12)

    def test_mean_is_averaged_over_all_pairs_for_three_factions(self):
        data = {
            "SATWIKA": {"a": 1.0},
            "TAMASIKA": {"b": 1.0},
            "RAJASIKA": {"a": 1.0},  # identical to SATWIKA
        }
        result = faction_identity_index(data)
        # pairwise: (SATWIKA,TAMASIKA)=1.0, (SATWIKA,RAJASIKA)=0.0, (TAMASIKA,RAJASIKA)=1.0
        assert result["mean_pairwise_jsd"] == pytest.approx(2.0 / 3.0, abs=1e-9)

    def test_requires_at_least_two_factions(self):
        with pytest.raises(ValueError):
            faction_identity_index({"SATWIKA": {"a": 1}})
