"""Uniform-random baseline agent. Skeleton pending simulator/agent-interface wiring."""

import random

from src.agents.base import Agent


class RandomAgent(Agent):
    name = "random_agent"

    def choose_action(self, state, legal_actions):
        raise NotImplementedError("Wire up once engine.py exposes a legal_actions() API")
