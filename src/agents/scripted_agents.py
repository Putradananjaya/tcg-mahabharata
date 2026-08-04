"""Hand-authored archetype agents (aggro / control) used as fixed opponents
for evaluating card/parameter changes."""

from src.agents.base import Agent


class AggroAgent(Agent):
    """Always attacks, never switches by choice, and picks the attack with
    the highest *raw* base_damage stat (not the foreseen post-reduction
    damage GreedyAgent uses) -- an unsophisticated "biggest number on the
    card" playstyle that doesn't account for the opponent's damage_reduction
    or its own bonus-damage terms. Only switches when forced (zero legal
    ATTACK actions)."""

    name = "scripted_aggro"

    def act(self, observation):
        attack_actions = [a for a in observation.legal_actions if a.kind == "ATTACK"]
        if attack_actions:
            # action_preview holds the *post-reduction* estimate; raw
            # base_damage isn't exposed on Observation by design (it's a
            # per-card stat, not environment-computed), so approximate
            # "biggest number" via the preview's relative order among this
            # character's own attacks -- for a single active character this
            # ranks identically to raw base_damage whenever damage_reduction
            # and bonus terms are equal across the character's own attacks,
            # which holds for every card in the current data (rules_spec.md
            # section 1.3: at most 2 attacks per card, bonuses are per-attack
            # flags, not per-character).
            return max(attack_actions, key=lambda a: observation.action_preview[a])

        switch_actions = [a for a in observation.legal_actions if a.kind == "SWITCH"]
        return switch_actions[0]


class ControlAgent(Agent):
    """Retreats when its active character is at or below the 40%-HP panic
    threshold (rules_spec.md section 4.1, same threshold Player.attack()
    itself uses) if a bench character is available, trading tempo for
    survivability -- unlike AggroAgent and GreedyAgent, which never retreat
    by choice. Outside of panic, attacks with its best-damage option (same
    ranking as GreedyAgent); the retreat-under-pressure behavior is the
    deliberate, honestly-computable point of difference for the
    policy-dependence sweep, not a fabricated "resource conservation" signal
    this environment doesn't actually expose to agents (see action_preview's
    docstring -- it carries damage estimates, not prana cost)."""

    name = "scripted_control"

    def act(self, observation):
        is_panic = observation.features[6]
        switch_actions = [a for a in observation.legal_actions if a.kind == "SWITCH"]
        attack_actions = [a for a in observation.legal_actions if a.kind == "ATTACK"]

        if is_panic and switch_actions:
            return max(switch_actions, key=lambda a: observation.action_preview[a])

        if attack_actions:
            return max(attack_actions, key=lambda a: observation.action_preview[a])

        return switch_actions[0]
