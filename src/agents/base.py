"""Common interface for all agents used in experiments (Aturan Main Fase 4).

Wired up by src.simulator.agent_env.AgentGameEnv, which is the first thing in
this repo that actually exposes a legal_actions() API to an external
decision-maker -- src.domain.models.Player.attack() always picked its own
attack automatically before this phase (see rules_spec.md section 4.1);
AgentGameEnv uses Player.attack(forced_attack=...) to let an Agent choose
instead, without changing that automatic behavior for any existing caller.

Action space (see agent_env.py for the authoritative definition):
  Action("ATTACK", i)  -- use attacks[i] of the active character (must be
                          affordable; legal_actions() only offers affordable ones)
  Action("SWITCH", j)  -- retreat the active character and send in bench[j]
                          instead, ending the turn without attacking (no
                          retreat_cost charged -- see rules_spec.md section 2,
                          retreat_cost is defined on every card but unused by
                          the core engine; this repo doesn't invent a cost
                          that doesn't exist in the canonical rules)
Existing agents (dqn_agent.QLearningAgent predates this interface and uses
its own macro-action space over Player.attack()'s automatic selection --
see rules_spec.md section 4.1 note on why Fase 4 uses a different, finer
action space: attack *choice* is a real decision here, whereas the old
macro-action space's "Heal" branch is dead code (bench characters can never
be damaged, rules_spec.md section 4.3) and its attack selection was never
actually agent-controlled.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import NamedTuple


class Action(NamedTuple):
    kind: str  # "ATTACK" or "SWITCH"
    index: int  # index into attacks[] or bench[]


@dataclass(frozen=True)
class Observation:
    """What an Agent sees before choosing an action. `features` is the same
    kind of fixed-size numeric tuple as src.agents.dqn_agent's state vector
    (own/opponent HP & prana buckets, sasmita, turn parity, ...) -- see
    agent_env.py's observation() for the exact fields. `legal_actions`
    is always non-empty when act() is called (AgentGameEnv auto-passes the
    turn without calling the agent if there's nothing legal to do).

    `action_preview` gives agents that want it a scalar per legal action
    without exposing raw mutable Player/Card objects through the interface:
    for an ATTACK action, the damage src.simulator.agent_env.estimate_damage
    predicts it would deal right now; for a SWITCH action, the bench
    character's current HP (a simple survivability signal). Agents that only
    need `features` (e.g. a tabular Q-learner) can ignore this entirely.
    """

    features: tuple
    legal_actions: tuple  # tuple[Action, ...]
    action_preview: dict = None  # {Action: float}


class Agent(ABC):
    """An agent that chooses an action given an observation."""

    name: str = "unnamed_agent"

    @abstractmethod
    def act(self, observation: Observation) -> Action:
        """Return the chosen action. Must be one of observation.legal_actions."""
        raise NotImplementedError
