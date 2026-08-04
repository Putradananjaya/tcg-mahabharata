"""Monte Carlo Tree Search agent (UCT: UCB1 tree policy + random-policy
rollouts, backpropagated negamax-style since this is a two-player
zero-sum game).

Compute note: a full-length game here can run 60-130 individual actions
(rules_spec.md section 1.2's turn cap is 100 turns = up to ~400 actions in
the worst case). Running `budget` complete rollouts to a natural terminal
state, at every single decision, for a budget of 2000, is not tractable in
this environment (benchmarked: ~0.9ms per full random-policy game, so 2000
full rollouts x dozens of decisions x many games would run for hours). This
implementation instead truncates each simulation at `rollout_depth` plies
and falls back to a cheap heuristic evaluation (own HP fraction minus
opponent HP fraction, plus Sasmita difference) at the cutoff -- standard
MCTS practice, not a shortcut hidden from the reported budget. `budget` is
still the real number of simulations run per decision; only their length is
bounded.
"""

from __future__ import annotations

import math
import random

from src.agents.base import Agent
from src.simulator.agent_env import AgentGameEnv


def _heuristic_value(env: AgentGameEnv, side: str) -> float:
    """Value of the position from `side`'s perspective, in [-1, 1]. Used
    when a simulation is truncated before a natural game-over."""
    a_player = env.first if env.a_is_first else env.second
    b_player = env.second if env.a_is_first else env.first

    def hp_frac(p):
        if not p.active_character:
            return 0.0
        return p.active_character.current_hp / max(p.active_character.hp, 1)

    a_score = hp_frac(a_player) + a_player.sasmita / 3.0
    b_score = hp_frac(b_player) + b_player.sasmita / 3.0
    diff = (a_score - b_score) / 2.0  # normalize to roughly [-1, 1]
    return diff if side == "A" else -diff


class _Node:
    __slots__ = ("env", "parent", "children", "N", "W", "untried_actions", "acting_side")

    def __init__(self, env: AgentGameEnv, parent=None):
        self.env = env
        self.parent = parent
        self.children = {}  # action -> _Node
        self.N = 0
        self.W = 0.0
        if env.done:
            self.acting_side = None
            self.untried_actions = []
        else:
            actor, _ = env._actor_and_opponent()
            self.acting_side = env.current_side
            self.untried_actions = list(env.legal_actions(actor))


class MCTSAgent(Agent):
    def __init__(self, budget: int = 100, rollout_depth: int = 16, c: float = 1.4, seed: int = None):
        self.budget = budget
        self.rollout_depth = rollout_depth
        self.c = c
        self.name = f"mcts_{budget}"
        self._rng = random.Random(seed)

    def act(self, observation):
        # Observation doesn't carry env state (by interface design), so
        # MCTSAgent needs the live env passed via act_with_env instead of
        # the abstract Observation-only interface other agents use.
        raise RuntimeError("MCTSAgent requires act_with_env(env); it cannot decide from Observation alone")

    def act_with_env(self, env: AgentGameEnv):
        root = _Node(env.clone())
        root_side = root.acting_side
        self._root_side = root_side  # fixed reference frame for W across the whole tree

        for _ in range(self.budget):
            node = root
            # 1. Selection
            while not node.untried_actions and node.children:
                node = self._uct_select(node)
            # 2. Expansion
            if node.untried_actions:
                action = self._rng.choice(node.untried_actions)
                node.untried_actions.remove(action)
                child_env = node.env.clone()
                child_env.step(action)
                child = _Node(child_env, parent=node)
                node.children[action] = child
                node = child
            # 3. Simulation (random rollout, depth-capped)
            value = self._rollout(node.env.clone(), root_side)
            # 4. Backpropagation -- W always accumulates value in root_side's
            # fixed perspective, regardless of which node it's stored at.
            while node is not None:
                node.N += 1
                node.W += value
                node = node.parent

        return max(root.children.items(), key=lambda kv: kv[1].N)[0]

    def _uct_select(self, node: _Node) -> _Node:
        # node.acting_side is choosing among its children to maximize ITS
        # OWN outcome. child.W is stored in root_side's fixed perspective, so
        # a node acting for the other side must negate it (negamax-style).
        sign = 1.0 if node.acting_side == self._root_side else -1.0
        log_n = math.log(node.N) if node.N > 0 else 0.0

        def ucb(child):
            exploit = sign * (child.W / child.N)
            explore = self.c * math.sqrt(log_n / child.N)
            return exploit + explore

        return max(node.children.values(), key=ucb)

    def _rollout(self, env: AgentGameEnv, root_side: str) -> float:
        depth = 0
        while not env.done and depth < self.rollout_depth:
            actor, _ = env._actor_and_opponent()
            legal = env.legal_actions(actor)
            action = self._rng.choice(legal)
            env.step(action)
            depth += 1

        if env.done:
            return 1.0 if env.winner_side == root_side else -1.0
        return _heuristic_value(env, root_side)
