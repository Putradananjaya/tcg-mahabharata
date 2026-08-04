"""Greedy (highest-immediate-value) baseline agent. Skeleton pending simulator/agent-interface wiring."""

from src.agents.base import Agent


class GreedyAgent(Agent):
    name = "greedy_agent"

    def choose_action(self, state, legal_actions):
        raise NotImplementedError("Wire up once engine.py exposes a legal_actions() API")
