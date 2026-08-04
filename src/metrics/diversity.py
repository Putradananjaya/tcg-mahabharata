"""Strategy diversity metrics: Faction Identity Index (Jensen-Shannon
divergence between factions' action-choice distributions) and entropy of
viable strategy archetypes.

Turns the qualitative claim "factions play differently" (previously
supported only by a figure the reader has to eyeball) into a number: the
Jensen-Shannon divergence between two factions' attack-choice frequency
distributions is 0 iff they choose attacks identically, and its maximum
(1 bit, log2-based) iff they never choose the same attack at all.
"""

from __future__ import annotations

import math


def _kl_divergence_bits(p: list, q: list) -> float:
    """KL(P || Q) in bits. Assumes p, q are aligned probability vectors
    (same support order); 0 * log(0/x) is treated as 0 by convention."""
    total = 0.0
    for pi, qi in zip(p, q):
        if pi <= 0:
            continue
        if qi <= 0:
            raise ValueError("q has zero probability where p does not -- KL is undefined")
        total += pi * math.log2(pi / qi)
    return total


def jensen_shannon_divergence(p: dict, q: dict) -> float:
    """Jensen-Shannon divergence, in bits (0 to 1), between two categorical
    distributions given as {category: count_or_probability} dicts.
    Normalizes each input to sum to 1, and unions the two supports (a
    category missing from one dict is treated as probability 0 there) --
    JSD is always well-defined even when supports don't fully overlap,
    unlike plain KL divergence.
    """
    keys = sorted(set(p) | set(q))
    if not keys:
        return 0.0
    p_total = sum(p.values())
    q_total = sum(q.values())
    if p_total <= 0 or q_total <= 0:
        raise ValueError("distributions must have positive total mass")

    p_vec = [p.get(k, 0) / p_total for k in keys]
    q_vec = [q.get(k, 0) / q_total for k in keys]
    m_vec = [(pi + qi) / 2 for pi, qi in zip(p_vec, q_vec)]

    return 0.5 * _kl_divergence_bits(p_vec, m_vec) + 0.5 * _kl_divergence_bits(q_vec, m_vec)


def strategy_entropy(action_counts: dict, total_possible_actions: int = None) -> float:
    """Normalized Shannon entropy (0-1) of an action/attack-choice frequency
    table.

    If `total_possible_actions` is given, normalizes by log2(that count) --
    so a faction that only ever uses 2 of its 5 available attacks scores
    less than 1.0 even if it splits those 2 perfectly evenly, correctly
    penalizing unused options. If omitted, normalizes by the number of
    categories that actually appear with nonzero count (matches
    src/simulator/fitness.py's private `_normalized_entropy` helper used by
    NSGA2's diversity objective -- but that convention can't distinguish
    "2 well-balanced options out of 2" from "2 well-balanced options out of
    20 unused ones," so prefer passing total_possible_actions when you know
    it).
    """
    counts = [c for c in action_counts.values() if c > 0]
    total = sum(counts)
    if total == 0:
        return 0.0

    probs = [c / total for c in counts]
    entropy = -sum(p * math.log2(p) for p in probs)

    denom_count = total_possible_actions if total_possible_actions is not None else len(counts)
    if denom_count <= 1:
        return 0.0
    return entropy / math.log2(denom_count)


def faction_identity_index(action_counts_by_faction: dict) -> dict:
    """Pairwise Jensen-Shannon divergence between every pair of factions'
    action-choice distributions, plus a single summary number.

    action_counts_by_faction: {faction_name: {action_name: count}}, e.g.
    built from src.simulator.fitness.run_simulation_multi's attack_log
    output aggregated across many games.

    Returns dict with "pairwise" ({(a, b): jsd_bits}), "mean_pairwise_jsd"
    (the Faction Identity Index summary number -- 0 = factions play
    identically, up to 1 bit = factions never choose the same attack), and
    "per_faction_entropy" (each faction's own strategy_entropy, for context:
    a faction can be highly distinct from others (~high JSD) while itself
    being low-entropy (always doing the "one weird trick" every game), and
    that's a different finding than being distinct *and* diverse).
    """
    names = list(action_counts_by_faction.keys())
    if len(names) < 2:
        raise ValueError("need at least 2 factions to compute pairwise identity")

    pairwise = {}
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            pairwise[(a, b)] = jensen_shannon_divergence(
                action_counts_by_faction[a], action_counts_by_faction[b]
            )

    mean_jsd = sum(pairwise.values()) / len(pairwise)
    per_faction_entropy = {name: strategy_entropy(action_counts_by_faction[name]) for name in names}

    return {
        "pairwise": pairwise,
        "mean_pairwise_jsd": mean_jsd,
        "max_jsd_bits": 1.0,
        "per_faction_entropy": per_faction_entropy,
    }
