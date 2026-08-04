import sys
import io
import random
import numpy as np

from src.domain.models import Player, Card

# --- LEGACY, NOT USED FOR ANY PAPER CLAIM (Fase 5 review) -----------------
# QLearningAgent / play_rl_game / run_rl_self_play below is the ORIGINAL
# tabular Q-learning implementation (3 macro-actions: Attack/Heal/Switch).
# As of Fase 5 it is superseded by TabularQLearningAgent + train_tabular_agent
# further down this file, which is the canonical RL agent for this project
# (see rules_spec.md section 12 for the formal spec, Eq. (2), hyperparameters
# in results/dqn_hparams.json). This legacy path is kept only for archival
# reference and has two known defects that disqualify it from paper claims:
#   1. Its "Heal" action (action=1) is dead in expectation: bench characters
#      can never be damaged (rules_spec.md 4.3), so `damaged_bench` is always
#      empty and the +10/-10 heal-shaping term always resolves to -10.
#   2. `run_rl_self_play` used to print an unverified narrative conclusion
#      ("Kesimpulan: ... win rate > 70% membuktikan...") from a single,
#      un-seeded, non-CI'd run -- exactly the kind of claim Aturan Main
#      Fase 2 bans. That print statement has been removed; do not
#      reintroduce a claim like it without a Wilson CI and an artifact.
# Do not cite QLearningAgent, play_rl_game, or run_rl_self_play's printed
# output as a paper result.
class QLearningAgent:
    def __init__(self, epsilon=0.2, alpha=0.1, gamma=0.9):
        self.epsilon = epsilon
        self.alpha = alpha
        self.gamma = gamma
        self.q_table = {}

    # Equation 1 (observation vector, not full state -- see rules_spec.md section 6:
    # the engine is a POMDP because neither agent can see the opponent's hand
    # contents, deck order, or the private RNG draws used to resolve effects like
    # heal_bench_card's target selection). Fields, in order:
    #   0 hp_bucket            own active character's HP bucket (0/1/2)
    #   1 prana_bucket         own total prana, P_faction^(i)   (0/1)
    #   2 opp_prana_bucket     opponent total prana, P_faction^(3-i) (0/1)
    #   3 bench_wounded        own bench has a damaged card (0/1)
    #   4 deck_size_bucket     own remaining deck size (0/1)
    #   5 own_hand_bucket      |Hand^(i)|, capped bucket (0-3)
    #   6 opp_hand_bucket      |Hand^(3-i)|, capped bucket (0-3) -- hand *count* is
    #                          public info in a physical card game even though hand
    #                          *contents* are not, so this does not break the POMDP
    #   7 is_panic             own active character at/below the 40%-HP panic
    #                          threshold that Player.attack() itself branches on --
    #                          the only persistent status-like flag this engine
    #                          currently has (no multi-turn buffs/debuffs exist)
    #   8 sasmita_bucket       own remaining Sasmita (prize count), 0-3
    #   9 turn_parity          1 if this player has initiative this turn (acts
    #                          first), 0 otherwise -- see rules_spec.md section 1.2
    #                          for why first-mover status matters every turn, not
    #                          just turn 1
    def get_state(self, player, opponent=None, is_first_mover=True):
        if not player.active_character:
            # No reachable state under the current 2-unique-card decks (see
            # rules_spec.md section 2 "mulligan"), kept only as a defensive
            # fallback. Same arity as the normal return so q_table keys stay
            # consistent in shape.
            return (0, 0, 0, 0, 0, 0, 0, 0, player.sasmita, int(is_first_mover))

        hp = player.active_character.current_hp
        if hp <= 35:
            hp_bucket = 0
        elif hp <= 80:
            hp_bucket = 1
        else:
            hp_bucket = 2

        prana_total = sum(player.prana_pool.values())
        prana_bucket = 0 if prana_total < 2 else 1

        opp_prana_bucket = 0
        if opponent is not None:
            opp_prana_total = sum(opponent.prana_pool.values())
            opp_prana_bucket = 0 if opp_prana_total < 2 else 1

        bench_wounded = 0
        for b_card in player.bench:
            if b_card.current_hp < b_card.hp:
                bench_wounded = 1
                break

        deck_size_bucket = 0 if len(player.deck) < 10 else 1
        own_hand_bucket = min(len(player.hand), 3)
        opp_hand_bucket = min(len(opponent.hand), 3) if opponent is not None else 0

        is_panic = 1 if player.active_character.current_hp <= (player.active_character.hp * 0.4) else 0
        sasmita_bucket = player.sasmita

        return (
            hp_bucket, prana_bucket, opp_prana_bucket, bench_wounded, deck_size_bucket,
            own_hand_bucket, opp_hand_bucket, is_panic, sasmita_bucket, int(is_first_mover),
        )

    def get_q_values(self, state):
        if state not in self.q_table:
            # We use 3 macro actions: 0: Attack, 1: Heal/Support, 2: Switch
            self.q_table[state] = np.zeros(3)
        return self.q_table[state]

    def choose_action(self, state, train=True):
        q_vals = self.get_q_values(state)
        if train and random.random() < self.epsilon:
            return random.randint(0, 2)
        return np.argmax(q_vals)

    def learn(self, state, action, reward, next_state):
        old_q = self.get_q_values(state)[action]
        next_max = np.max(self.get_q_values(next_state))
        
        new_q = old_q + self.alpha * (reward + self.gamma * next_max - old_q)
        self.q_table[state][action] = new_q

def play_rl_game(agent1, agent2, train=True):
    p1 = Player("PANDAWA")
    p2 = Player("KURAWA")
    
    p1.load_deck_from_json("data/satwika.json")
    p2.load_deck_from_json("data/tamasika.json")
    
    p1.setup_phase()
    p2.setup_phase()
    p1.play_basic_to_active()
    p2.play_basic_to_active()
    p1.play_basic_to_bench()
    p2.play_basic_to_bench()
    
    agents = {p1.name: agent1, p2.name: agent2}
    players = [p1, p2]
    random.shuffle(players)
    first_player = players[0]
    second_player = players[1]
    
    turn = 1
    game_active = True
    winner = None
    history = {p1.name: [], p2.name: []}
    
    while game_active and turn <= 100:
        for active_p, passive_p in [(first_player, second_player), (second_player, first_player)]:
            agent = agents[active_p.name]
            active_p.attach_prana()

            is_first_mover = active_p is first_player
            state = agent.get_state(active_p, passive_p, is_first_mover)
            action = agent.choose_action(state, train)
            
            reward = -1
            acted = False
            
            if action == 0:
                res = active_p.attack(opponent=passive_p)
                acted = True
            elif action == 1:
                if active_p.active_character and active_p.active_character.name == "Yudhistira":
                    damaged_bench = [c for c in active_p.bench if c.current_hp < c.hp]
                    if damaged_bench:
                        target = random.choice(damaged_bench)
                        heal_amount = min(25, target.hp - target.current_hp)
                        target.current_hp += heal_amount
                        reward += 10
                    else:
                        reward -= 10
                res = active_p.attack(opponent=passive_p)
                acted = True
            elif action == 2:
                if len(active_p.bench) > 0 and active_p.active_character:
                    best_bench = max(active_p.bench, key=lambda c: c.current_hp)
                    idx = active_p.bench.index(best_bench)
                    old_active = active_p.active_character
                    active_p.active_character = best_bench
                    active_p.bench[idx] = old_active
                    reward += 5
                    res = active_p.attack(opponent=passive_p)
                    acted = True
                else:
                    reward -= 10
                    res = active_p.attack(opponent=passive_p)
                    acted = True
                    
            if acted:
                next_state = agent.get_state(active_p, passive_p, is_first_mover)
                history[active_p.name].append((state, action, reward, next_state))
                
                if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
                    game_active = False
                    winner = active_p.name if res == "GAME_OVER" else passive_p.name
                    break
                    
        turn += 1
        
    if not winner:
        hp1 = p1.active_character.current_hp if p1.active_character else 0
        hp2 = p2.active_character.current_hp if p2.active_character else 0
        winner = "PANDAWA" if hp1 >= hp2 else "KURAWA"
        
    for p_name in [p1.name, p2.name]:
        agent = agents[p_name]
        is_winner = (p_name == winner)
        final_reward = 100 if is_winner else -100
        
        if history[p_name]:
            last_idx = len(history[p_name]) - 1
            s, a, r, ns = history[p_name][last_idx]
            history[p_name][last_idx] = (s, a, r + final_reward, ns)
            
            if train:
                for s, a, r, ns in history[p_name]:
                    agent.learn(s, a, r, ns)
                    
    return winner

def run_rl_self_play(num_train_games=2500, num_eval_games=500):
    print(f"=== TAHAP 1: MEMULAI PELATIHAN RL SELF-PLAY (N = {num_train_games}) ===")
    
    agent_p = QLearningAgent(epsilon=0.2, alpha=0.1, gamma=0.9)
    agent_k = QLearningAgent(epsilon=0.2, alpha=0.1, gamma=0.9)
    
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        for i in range(num_train_games):
            play_rl_game(agent_p, agent_k, train=True)
            if i % 500 == 0:
                agent_p.epsilon = max(0.05, agent_p.epsilon * 0.9)
                agent_k.epsilon = max(0.05, agent_k.epsilon * 0.9)
    finally:
        sys.stdout = original_stdout
        
    print("Pelatihan RL Selesai!")
    
    print("\nVisualisasi Q-Table Yudhistira (Pandawa) untuk Beberapa Keadaan:")
    print("Format State: (HP Aktif, Prana Sendiri, Prana Lawan, Bench Terluka, Ukuran Deck, "
          "Hand Sendiri, Hand Lawan, Panic, Sasmita, Giliran Pertama)")
    sample_states = [
        ((2, 1, 1, 1, 1, 2, 2, 0, 3, 1), "HP Tinggi, Prana Cukup Kedua Sisi, Bench Terluka, Sasmita 3, Gerak Pertama"),
        ((0, 1, 0, 1, 1, 1, 3, 1, 1, 0), "HP Sekarat & Panic, Prana Lawan Rendah, Sasmita Kritis, Gerak Kedua"),
        ((2, 0, 1, 0, 1, 3, 1, 0, 3, 1), "HP Tinggi, Prana Sendiri Rendah, Bench Sehat"),
    ]
    for state, desc in sample_states:
        q_vals = agent_p.get_q_values(state)
        print(f"  State: {state} ({desc})")
        print(f"    - Serang Lawan   : {q_vals[0]:+.2f}")
        print(f"    - Sembuhkan Bench: {q_vals[1]:+.2f}")
        print(f"    - Retreat        : {q_vals[2]:+.2f}")
        
    print(f"\n=== TAHAP 2: EVALUASI RL AGENT VS. RANDOM BOT (N = {num_eval_games}) ===")
    
    random_agent = QLearningAgent(epsilon=1.0)
    
    sys.stdout = io.StringIO()
    rl_wins = 0
    try:
        for _ in range(num_eval_games):
            winner = play_rl_game(agent_p, random_agent, train=False)
            if winner == "PANDAWA":
                rl_wins += 1
    finally:
        sys.stdout = original_stdout
        
    win_rate = (rl_wins / num_eval_games) * 100
    print(f"Hasil Turnamen Validasi:")
    print(f"  - Kemenangan Agen RL   : {rl_wins} / {num_eval_games} pertandingan")
    print(f"  - Win Rate Agen RL     : {win_rate:.2f}%")
    print(f"  - Win Rate Agen Random : {100 - win_rate:.2f}%")
    print("  (single un-seeded run, no Wilson CI -- diagnostic only, not a paper claim;"
          " see experiments/exp05_reward_sensitivity.py for the citable equivalent)")


# --- Fase 4: tabular Q-learning over src.simulator.agent_env's action space
# (attack CHOICE + switch, see src/agents/base.py) -- separate from
# QLearningAgent above, which uses the older 3-macro-action space where
# attack choice was never actually agent-controlled and "Heal" is dead code
# (rules_spec.md section 4.3). Implements the src.agents.base.Agent
# interface so it plays in exp04_policy_dependence.py alongside every other
# agent type.

from src.agents.base import Agent


class TabularQLearningAgent(Agent):
    def __init__(self, epsilon=0.2, alpha=0.1, gamma=0.9, name="dqn", rng=None):
        self.epsilon = epsilon
        self.alpha = alpha
        self.gamma = gamma
        self.q = {}  # {(features, action): value}
        self.name = name
        self.train_mode = True
        self._rng = rng or random.Random()

    def _q(self, features, action):
        return self.q.get((features, action), 0.0)

    def act(self, observation):
        legal = observation.legal_actions
        if self.train_mode and self._rng.random() < self.epsilon:
            return self._rng.choice(legal)
        best = max(legal, key=lambda a: self._q(observation.features, a))
        return best

    def learn_from_episode(self, history):
        """history: list of (features, legal_actions, action, reward) for
        ONE side's consecutive decisions across one game, in order."""
        for t in range(len(history)):
            features, _legal, action, reward = history[t]
            if t + 1 < len(history):
                next_features, next_legal, _, _ = history[t + 1]
                next_max = max((self._q(next_features, a) for a in next_legal), default=0.0)
            else:
                next_max = 0.0  # terminal
            old = self._q(features, action)
            self.q[(features, action)] = old + self.alpha * (reward + self.gamma * next_max - old)

    def snapshot(self, name=None):
        """Frozen, greedy (epsilon=0) copy for evaluation/checkpointing --
        training continues on `self`, unaffected by later use of the snapshot."""
        clone = TabularQLearningAgent(epsilon=0.0, alpha=self.alpha, gamma=self.gamma, name=name or self.name)
        clone.q = dict(self.q)
        clone.train_mode = False
        return clone


from dataclasses import dataclass


@dataclass(frozen=True)
class RewardWeights:
    """Named reward-shaping weights for train_tabular_agent (Fase 5 review:
    "bobot reward w1,w2,w3,w_KO tidak pernah disebut"). See rules_spec.md
    section 12.4 for the full derivation. Defaults reproduce Fase 4's
    original (unnamed) reward exactly: w1=-0.01 per step, w2=w3=0 (no
    shaping beyond step cost), w_KO=+-1.0 terminal -- so every Fase 4
    artifact (results/exp04_policy_dependence.json) remains reproducible
    under RewardWeights() with no argument changes.

    w1_step_cost      : flat reward applied every action, regardless of
                         state or action taken. NOT potential-based shaping
                         in the Ng/Harada/Russell (ICML 1999) sense -- it is
                         a constant, not a function of a state potential --
                         but a UNIFORM per-step constant is a standard,
                         policy-preserving time cost as long as it does not
                         interact with action choice (see rules_spec.md
                         12.4 for why w3 below is different).
    w2_hp_potential   : coefficient on the POTENTIAL-BASED shaping term
                         F(s,a,s') = gamma*Phi(s') - Phi(s), with
                         Phi(s) = own_active_hp_fraction(s) - opp_active_hp_fraction(s)
                         (AgentGameEnv.hp_fraction), Phi(terminal) := 0 by
                         convention. Per Ng, Harada & Russell (1999,
                         Theorem 1), ANY value of this coefficient leaves the
                         optimal policy unchanged -- only learning speed is
                         affected. This is the term the sensitivity sweep in
                         experiments/exp05_reward_sensitivity.py uses as the
                         "should not move the balance conclusion" control.
    w3_aggression_bias: flat bonus added when the chosen action is ATTACK
                         (0 for SWITCH), independent of the resulting state.
                         Deliberately NOT of the F=gamma*Phi(s')-Phi(s) form
                         (it depends on the ACTION, not a state-potential
                         difference) -- included specifically as the
                         textbook non-potential-based case Ng et al. 1999
                         warn can change the optimal policy. The sweep
                         empirically checks whether it does, here.
    w_ko              : magnitude of the terminal win(+w_ko)/lose(-w_ko)
                         reward appended to the acting side's final
                         transition of the episode.
    """

    w1_step_cost: float = -0.01
    w2_hp_potential: float = 0.0
    w3_aggression_bias: float = 0.0
    w_ko: float = 1.0


def train_tabular_agent(agent, deck_a, deck_b, num_games, max_turns=60, base_seed=0,
                         weights: "RewardWeights" = None):
    """Self-play training: `agent` (in train_mode) controls both sides,
    sharing one Q-table. Reward = w1_step_cost (every action)
    + w2_hp_potential * (gamma*Phi(s') - Phi(s)) (potential-based HP-diff
    shaping, gamma taken from `agent.gamma` so the shaping telescopes
    correctly against the same discount the Q-update uses)
    + w3_aggression_bias (if the action was ATTACK)
    on every step, plus +-w_ko on the final transition of each side's
    episode. See RewardWeights' docstring and rules_spec.md section 12.4."""
    from src.simulator.agent_env import AgentGameEnv

    weights = weights or RewardWeights()
    total_steps = 0

    for i in range(num_games):
        env = AgentGameEnv(deck_a, deck_b, "A", "B", max_turns=max_turns)
        obs = env.reset(seed=base_seed + i)
        history = {"A": [], "B": []}

        while not env.done:
            side = env.current_side
            opp_side = "B" if side == "A" else "A"
            phi_before = env.hp_fraction(side) - env.hp_fraction(opp_side)

            action = agent.act(obs)
            features, legal = obs.features, obs.legal_actions
            is_attack = action.kind == "ATTACK"

            obs, done, winner = env.step(action)

            phi_after = 0.0 if env.done else (env.hp_fraction(side) - env.hp_fraction(opp_side))
            shaping = weights.w2_hp_potential * (agent.gamma * phi_after - phi_before)
            reward = weights.w1_step_cost + shaping + (weights.w3_aggression_bias if is_attack else 0.0)

            history[side].append([features, legal, action, reward])
            total_steps += 1

        for side in ("A", "B"):
            if history[side]:
                history[side][-1][3] += weights.w_ko if env.winner_side == side else -weights.w_ko
            agent.learn_from_episode([tuple(h) for h in history[side]])

    return total_steps
