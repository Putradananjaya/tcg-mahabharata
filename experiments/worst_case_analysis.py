import sys
import io
import os
import copy

from engine import Player, Card
from main import run_single_simulation

# Custom play_basic_to_bench that limits bench size
def make_limited_play_basic_to_bench(limit):
    def play_basic_to_bench(self):
        cards_to_bench = []
        for card in self.hand:
            if card.type == "Tokoh" and card.raw_data.get("stage") == "Basic":
                if len(self.bench) < limit:
                    cards_to_bench.append(card)
                    self.bench.append(card)
        for card in cards_to_bench:
            self.hand.remove(card)
    return play_basic_to_bench

def run_simulation_with_handicap(faksi_1_name, file_json_1, faksi_2_name, file_json_2, handicap_player=1, bench_limit=5):
    p1 = Player(faksi_1_name)
    p2 = Player(faksi_2_name)
    
    p1.load_deck_from_json(file_json_1)
    p2.load_deck_from_json(file_json_2)
    
    p1.setup_phase()
    p2.setup_phase()
    p1.play_basic_to_active()
    p2.play_basic_to_active()
    
    # Apply handicap to the specified player
    if handicap_player == 1:
        # Override the bound method dynamically
        p1.play_basic_to_bench = make_limited_play_basic_to_bench(bench_limit).__get__(p1, Player)
    elif handicap_player == 2:
        p2.play_basic_to_bench = make_limited_play_basic_to_bench(bench_limit).__get__(p2, Player)
        
    p1.play_basic_to_bench()
    p2.play_basic_to_bench()
    
    # Run the game loop
    players = [p1, p2]
    import random
    random.shuffle(players)
    first_player = players[0]
    second_player = players[1]
    
    turn = 1
    while turn <= 100:
        first_player.attach_prana()
        game_result = first_player.attack(opponent=second_player)
        if game_result == "GAME_OVER":
            return first_player.name
        elif game_result == "GAME_OVER_SUICIDE":
            return second_player.name
            
        second_player.attach_prana()
        game_result = second_player.attack(opponent=first_player)
        if game_result == "GAME_OVER":
            return second_player.name
        elif game_result == "GAME_OVER_SUICIDE":
            return first_player.name
            
        turn += 1
        
    hp1 = p1.active_character.current_hp if p1.active_character else 0
    hp2 = p2.active_character.current_hp if p2.active_character else 0
    return faksi_1_name if hp1 >= hp2 else faksi_2_name

def analyze_worst_case(n=1000):
    matchups = [
        ("PANDAWA", "data/satwika.json", "KURAWA", "data/tamasika.json"),
        ("KURAWA", "data/tamasika.json", "RAJASIKA", "data/rajasika.json"),
        ("RAJASIKA", "data/rajasika.json", "PANDAWA", "data/satwika.json")
    ]
    
    original_stdout = sys.stdout
    print("=== MEMULAI ANALISIS SKENARIO TERBURUK (WORST-CASE RNG) ===")
    print(f"Menguji pengaruh batas bench (0 s.d. 5) terhadap win rate ({n} simulasi per titik)...")
    
    results = {}
    
    for name1, json1, name2, json2 in matchups:
        # Test Player 1 handicapped
        results[f"{name1} (Handicapped) vs {name2}"] = {}
        for limit in [0, 1, 2, 3, 4, 5]:
            wins = 0
            for _ in range(n):
                # Mute output
                sys.stdout = io.StringIO()
                try:
                    winner = run_simulation_with_handicap(name1, json1, name2, json2, handicap_player=1, bench_limit=limit)
                    if winner == name1:
                        wins += 1
                finally:
                    sys.stdout = original_stdout
            win_rate = (wins / n) * 100
            results[f"{name1} (Handicapped) vs {name2}"][limit] = win_rate
            print(f"  [{name1} vs {name2}] Limit Bench P1 = {limit}: Win Rate P1 = {win_rate:.1f}%")
            
        # Test Player 2 handicapped
        results[f"{name1} vs {name2} (Handicapped)"] = {}
        for limit in [0, 1, 2, 3, 4, 5]:
            wins = 0
            for _ in range(n):
                sys.stdout = io.StringIO()
                try:
                    winner = run_simulation_with_handicap(name1, json1, name2, json2, handicap_player=2, bench_limit=limit)
                    if winner == name2:
                        wins += 1
                finally:
                    sys.stdout = original_stdout
            win_rate = (wins / n) * 100
            results[f"{name1} vs {name2} (Handicapped)"][limit] = win_rate
            print(f"  [{name1} vs {name2}] Limit Bench P2 = {limit}: Win Rate P2 = {win_rate:.1f}%")
            
    print("\n=== RINGKASAN DEGRADASI WIN RATE (WORST-CASE) ===")
    for key, data in results.items():
        print(f"\n{key}:")
        for limit, wr in data.items():
            diff = wr - data[5]  # Difference from full bench (limit=5)
            print(f"  - Bench Size {limit}: {wr:.2f}% (Perubahan: {diff:+.2f}%)")

if __name__ == "__main__":
    analyze_worst_case(1000)
