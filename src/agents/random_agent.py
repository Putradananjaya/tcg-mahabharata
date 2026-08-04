"""Uniform-random baseline agent."""

import random

from src.agents.base import Agent


class RandomAgent(Agent):
    name = "random_agent"

    def act(self, observation):
        return random.choice(observation.legal_actions)
