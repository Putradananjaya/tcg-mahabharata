"""Hand-authored archetype agents (aggro / control / midrange) used as fixed
opponents for evaluating card/parameter changes. Skeleton pending
simulator/agent-interface wiring.
"""

from src.agents.base import Agent


class AggroAgent(Agent):
    name = "aggro_agent"

    def choose_action(self, state, legal_actions):
        raise NotImplementedError


class ControlAgent(Agent):
    name = "control_agent"

    def choose_action(self, state, legal_actions):
        raise NotImplementedError


class MidrangeAgent(Agent):
    name = "midrange_agent"

    def choose_action(self, state, legal_actions):
        raise NotImplementedError
