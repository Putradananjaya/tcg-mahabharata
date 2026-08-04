"""Greedy (maximize-immediate-damage) baseline agent."""

from src.agents.base import Agent


class GreedyAgent(Agent):
    """Picks the ATTACK action with the highest src.simulator.agent_env's
    estimate_damage preview. Only considers SWITCH when no ATTACK is legal
    (a pure damage-maximizer has no reason to pass up damage), in which case
    it switches to the bench character with the highest current HP -- same
    tie-break src.agents.dqn_agent's old switch logic used."""

    name = "greedy_agent"

    def act(self, observation):
        attack_actions = [a for a in observation.legal_actions if a.kind == "ATTACK"]
        if attack_actions:
            return max(attack_actions, key=lambda a: observation.action_preview[a])

        switch_actions = [a for a in observation.legal_actions if a.kind == "SWITCH"]
        return max(switch_actions, key=lambda a: observation.action_preview[a])
