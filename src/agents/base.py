"""Common interface for all agents used in experiments.

Existing agents (dqn_agent.QLearningAgent, agents_llm.card_designer) predate
this interface and do not implement it yet. New agents (random_agent,
greedy_agent, scripted_agents, mcts_agent) should subclass Agent so that
experiment runners can treat all agents uniformly.
"""

from abc import ABC, abstractmethod
from typing import Any


class Agent(ABC):
    """An agent that chooses an action given a game state."""

    name: str = "unnamed_agent"

    @abstractmethod
    def choose_action(self, state: Any, legal_actions: list[Any]) -> Any:
        """Return the chosen action given the current state and legal actions."""
        raise NotImplementedError
