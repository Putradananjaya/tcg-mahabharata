"""Monte Carlo Tree Search agent. Skeleton pending simulator/agent-interface wiring."""

from src.agents.base import Agent


class MCTSAgent(Agent):
    name = "mcts_agent"

    def __init__(self, num_simulations: int = 100):
        self.num_simulations = num_simulations

    def choose_action(self, state, legal_actions):
        raise NotImplementedError("Requires engine.py to expose a cloneable/steppable game state")
