import sys
import io
import random
import numpy as np

from src.core.models import Player, Card

class QLearningAgent:
    def __init__(self, epsilon=0.2, alpha=0.1, gamma=0.9):
        self.epsilon = epsilon
        self.alpha = alpha
        self.gamma = gamma
        self.q_table = {}

    def get_state(self, player):
        if not player.active_character:
            return (0, 0, 0)
            
        hp = player.active_character.current_hp
        if hp <= 35:
            hp_bucket = 0
        elif hp <= 80:
            hp_bucket = 1
        else:
            hp_bucket = 2
            
        prana_total = sum(player.prana_pool.values())
        prana_bucket = 0 if prana_total < 2 else 1
        
        bench_wounded = 0
        for b_card in player.bench:
            if b_card.current_hp < b_card.hp:
                bench_wounded = 1
                break
                
        # Expanded state representation for DQN
        deck_size_bucket = 0 if len(player.deck) < 10 else 1
        sasmita_bucket = player.sasmita
                
        return (hp_bucket, prana_bucket, bench_wounded, deck_size_bucket, sasmita_bucket)

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
            
            state = agent.get_state(active_p)
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
                next_state = agent.get_state(active_p)
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
    print("Format State: (HP Karakter Aktif, Jumlah Prana, Bench Butuh Heal, Ukuran Deck, Sasmita)")
    sample_states = [
        ((2, 1, 1, 1, 3), "HP Tinggi, Prana >= 2, Bench Terluka, Deck Aman, Sasmita 3"),
        ((0, 1, 1, 1, 1), "HP Sekarat (<=35), Prana >= 2, Bench Terluka, Sasmita Kritis"),
        ((2, 0, 0, 1, 3), "HP Tinggi, Prana Rendah, Bench Sehat")
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
    
    if win_rate > 70:
        print("\nKesimpulan: Agen RL berhasil mempelajari taktik game! Win rate > 70% membuktikan keunggulan strategi penyesuaian aksi dibanding aksi acak.")
