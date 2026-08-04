"""Agent-controllable game environment (Aturan Main Fase 4).

Wraps src.domain.models.Player exactly as src.simulator.engine/fitness do
(same setup phase, same attach_prana/attack turn structure, same fixed
first-mover-every-turn rule -- see rules_spec.md sections 1.1-1.2) but lets
an external Agent choose WHICH attack to use (via Player.attack(forced_attack=)
added in this phase) and WHETHER to switch the active character instead of
attacking, rather than always taking Player.attack()'s automatic
best-damage/panic selection.

Deliberately does not reuse src.agents.dqn_agent.QLearningAgent's old
3-macro-action space (Attack/Heal/Switch) -- that space's "Heal" action is
dead code given rules_spec.md section 4.3 (bench characters can never be
damaged) and its "Attack" action was never actually agent-controlled (always
went through Player.attack()'s automatic selection). This environment's
action space makes attack *choice* a real, agent-controlled decision.

Win/loss is tracked by which SIDE's attack() call returned GAME_OVER /
GAME_OVER_SUICIDE, never by comparing name strings -- see rules_spec.md
section 4.5 for why relying on names breaks mirror matches.
"""

from __future__ import annotations

import copy
import random

from src.agents.base import Action, Observation
from src.domain.models import Player
from src.simulator.fitness import load_deck_from_dict


def estimate_damage(actor: Player, opponent: Player, attack: dict) -> float:
    """Mirrors src.domain.models.Player.attack()'s damage formula exactly
    (rules_spec.md section 4.3), without mutating state or paying prana --
    used by GreedyAgent and MCTS to foresee an attack's damage before
    committing to it. Keep in sync with Player.attack() if that formula ever
    changes; there is deliberately only one place (there) that actually
    applies the damage, this is a read-only preview of the same math."""
    base_damage = attack.get("base_damage", 0)
    bonus_damage = 0

    if attack.get("bench_scaling"):
        bonus_damage += min(len(actor.bench) * 5, 15)

    if attack.get("effect") == "scaled_damage_per_discard_tamasika":
        bonus_damage += len(opponent.discard_pile) * attack.get("scale_value", 0)

    total_raw_damage = base_damage + bonus_damage
    reduction = getattr(opponent.active_character, "damage_reduction", 0)
    return max(0, total_raw_damage - reduction)


class AgentGameEnv:
    def __init__(self, deck_a: dict, deck_b: dict, name_a: str, name_b: str, max_turns: int = 100):
        self.deck_a = deck_a
        self.deck_b = deck_b
        self.name_a = name_a
        self.name_b = name_b
        self.max_turns = max_turns

        self.first: Player = None
        self.second: Player = None
        self.a_is_first: bool = None  # whether `first` corresponds to side A
        self.turn = 1
        self._pending = "first"  # which side acts next within the current turn
        self.done = False
        self.winner_side = None  # "A" or "B"

    def reset(self, seed: int = None) -> Observation:
        if seed is not None:
            random.seed(seed)

        p1 = Player(self.name_a)
        p2 = Player(self.name_b)
        load_deck_from_dict(p1, self.deck_a)
        load_deck_from_dict(p2, self.deck_b)
        p1.setup_phase()
        p2.setup_phase()
        p1.play_basic_to_active()
        p2.play_basic_to_active()
        p1.play_basic_to_bench()
        p2.play_basic_to_bench()

        players = [("A", p1), ("B", p2)]
        random.shuffle(players)
        (first_side, self.first), (second_side, self.second) = players
        self.a_is_first = first_side == "A"

        self.turn = 1
        self._pending = "first"
        self.done = False
        self.winner_side = None

        return self.observation()

    def clone(self) -> "AgentGameEnv":
        """Deep copy for MCTS rollouts -- includes full Player state (deck,
        hand, bench, discard_pile), since mill effects can change deck/discard
        size mid-rollout."""
        new_env = AgentGameEnv(self.deck_a, self.deck_b, self.name_a, self.name_b, self.max_turns)
        new_env.first = copy.deepcopy(self.first)
        new_env.second = copy.deepcopy(self.second)
        new_env.a_is_first = self.a_is_first
        new_env.turn = self.turn
        new_env._pending = self._pending
        new_env.done = self.done
        new_env.winner_side = self.winner_side
        return new_env

    @property
    def current_side(self) -> str:
        is_first = self._pending == "first"
        if is_first:
            return "A" if self.a_is_first else "B"
        return "B" if self.a_is_first else "A"

    def player_for_side(self, side: str) -> Player:
        if side == "A":
            return self.first if self.a_is_first else self.second
        return self.second if self.a_is_first else self.first

    def hp_fraction(self, side: str) -> float:
        """current_hp / hp of `side`'s active character, 0.0 if fainted/absent.
        Used by src.agents.dqn_agent's potential-based reward shaping
        (Ng, Harada & Russell, ICML 1999) -- see rules_spec.md section 12."""
        player = self.player_for_side(side)
        if not player.active_character:
            return 0.0
        return player.active_character.current_hp / player.active_character.hp

    def _actor_and_opponent(self):
        if self._pending == "first":
            return self.first, self.second
        return self.second, self.first

    def legal_actions(self, player: Player) -> list:
        if not player.active_character:
            return []
        actions = []
        attacks = player.active_character.raw_data.get("attacks", [])
        for i, atk in enumerate(attacks):
            if player.can_afford(atk.get("prana_cost", {})):
                actions.append(Action("ATTACK", i))
        for j in range(len(player.bench)):
            actions.append(Action("SWITCH", j))
        return actions

    def observation(self) -> Observation:
        """Observation for whichever side is currently up to act."""
        player, opponent = self._actor_and_opponent()
        is_first_mover = self._pending == "first"
        legal = self.legal_actions(player)

        if not player.active_character:
            features = (0, 0, 0, 0, 0, 0, 0, 0, 0, int(is_first_mover))
            return Observation(features=features, legal_actions=tuple(legal))

        hp = player.active_character.current_hp
        max_hp = player.active_character.hp
        hp_bucket = 0 if hp <= 35 else (1 if hp <= 80 else 2)

        prana_total = sum(player.prana_pool.values())
        prana_bucket = 0 if prana_total < 2 else 1
        opp_prana_total = sum(opponent.prana_pool.values())
        opp_prana_bucket = 0 if opp_prana_total < 2 else 1

        deck_size_bucket = 0 if len(player.deck) < 10 else 1
        own_hand_bucket = min(len(player.hand), 3)
        opp_hand_bucket = min(len(opponent.hand), 3)
        is_panic = 1 if hp <= max_hp * 0.4 else 0
        sasmita_bucket = player.sasmita
        num_attacks_affordable = sum(1 for a in legal if a.kind == "ATTACK")

        features = (
            hp_bucket, prana_bucket, opp_prana_bucket, deck_size_bucket,
            own_hand_bucket, opp_hand_bucket, is_panic, sasmita_bucket,
            num_attacks_affordable, int(is_first_mover),
        )

        attacks = player.active_character.raw_data.get("attacks", [])
        action_preview = {}
        for a in legal:
            if a.kind == "ATTACK":
                action_preview[a] = estimate_damage(player, opponent, attacks[a.index])
            elif a.kind == "SWITCH":
                action_preview[a] = float(player.bench[a.index].current_hp)

        return Observation(features=features, legal_actions=tuple(legal), action_preview=action_preview)

    def step(self, action: Action):
        """Apply `action` for the side currently up. Returns (observation
        for whoever acts next, done, winner_side_or_None). Mutates in place."""
        if self.done:
            raise RuntimeError("step() called after the game already ended")

        actor, opponent = self._actor_and_opponent()
        acting_side = self.current_side

        actor.attach_prana()

        if action.kind == "ATTACK":
            attacks = actor.active_character.raw_data.get("attacks", [])
            chosen = attacks[action.index]
            res = actor.attack(opponent, forced_attack=chosen)
            if res == "GAME_OVER":
                self.done = True
                self.winner_side = acting_side
            elif res == "GAME_OVER_SUICIDE":
                self.done = True
                self.winner_side = "A" if acting_side == "B" else "B"
        elif action.kind == "SWITCH":
            incoming = actor.bench.pop(action.index)
            actor.bench.append(actor.active_character)
            actor.active_character = incoming
        else:
            raise ValueError(f"unknown action kind: {action.kind}")

        if not self.done:
            if self._pending == "first":
                self._pending = "second"
            else:
                self._pending = "first"
                self.turn += 1
            if self.turn > self.max_turns:
                self.done = True
                self.winner_side = self._tie_break_winner()

        return (None if self.done else self.observation()), self.done, self.winner_side

    def _tie_break_winner(self) -> str:
        """Same rule as engine.py/fitness.py: compare active-character HP,
        default to side A on an exact tie."""
        a_player = self.first if self.a_is_first else self.second
        b_player = self.second if self.a_is_first else self.first
        hp_a = a_player.active_character.current_hp if a_player.active_character else 0
        hp_b = b_player.active_character.current_hp if b_player.active_character else 0
        return "A" if hp_a >= hp_b else "B"
