import random
from engine import Player
import csv
import os

def export_tournament_results(matchup_name, winner_name, turn_count, p1_hp, p2_hp):
    file_exists = os.path.isfile('hasil_turnamen.csv')
    with open('hasil_turnamen.csv', 'a', newline='') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['Matchup', 'Winner', 'Total_Turns', 'P1_Final_HP', 'P2_Final_HP'])
        writer.writerow([matchup_name, winner_name, turn_count, p1_hp, p2_hp])

def run_single_simulation(faksi_1_name, file_json_1, faksi_2_name, file_json_2):
    p1 = Player(faksi_1_name)
    p2 = Player(faksi_2_name)

    # Memuat deck
    p1.load_deck_from_json(file_json_1)
    p2.load_deck_from_json(file_json_2)

    # Fase Setup
    p1.setup_phase()
    p2.setup_phase()
    p1.play_basic_to_active()
    p2.play_basic_to_active()
    p1.play_basic_to_bench()
    p2.play_basic_to_bench()

    # --- LOGIKA COIN TOSS (PENGACAKAN GILIRAN) ---
    players = [p1, p2]
    random.shuffle(players)
    first_player = players[0]
    second_player = players[1]

    turn = 1
    game_active = True
    winner = None

    while game_active and turn <= 100:
        # Giliran Pemain 1 (Hasil acak)
        first_player.attach_prana()
        game_result = first_player.attack(opponent=second_player)
        if game_result == "GAME_OVER":
            winner = first_player.name
            break
        elif game_result == "GAME_OVER_SUICIDE":
            winner = second_player.name
            break
        
        # Giliran Pemain 2 (Hasil acak)
        second_player.attach_prana()
        game_result = second_player.attack(opponent=first_player)
        if game_result == "GAME_OVER":
            winner = second_player.name
            break
        elif game_result == "GAME_OVER_SUICIDE":
            winner = first_player.name
            break
            
        turn += 1

    # Mencatat sisa HP (mengembalikan ke p1 dan p2 untuk pencatatan CSV yang konsisten)
    hp1 = p1.active_character.current_hp if p1.active_character else 0
    hp2 = p2.active_character.current_hp if p2.active_character else 0
    
    matchup = f"{faksi_1_name} vs {faksi_2_name}"
    export_tournament_results(matchup, winner, turn, hp1, hp2)
    return winner

if __name__ == "__main__":
    if os.path.exists('hasil_turnamen.csv'):
        os.remove('hasil_turnamen.csv')
        
    print("=== MEMULAI TURNAMEN 3 FAKSI (DENGAN COIN TOSS) ===")
    
    print("\n[Pertandingan 1/3: PANDAWA vs KURAWA] Memproses 100 Simulasi...")
    for i in range(100):
        run_single_simulation("PANDAWA", "data/satwika.json", "KURAWA", "data/tamasika.json")
        
    print("\n[Pertandingan 2/3: KURAWA vs RAJASIKA] Memproses 100 Simulasi...")
    for i in range(100):
        run_single_simulation("KURAWA", "data/tamasika.json", "RAJASIKA", "data/rajasika.json")

    print("\n[Pertandingan 3/3: RAJASIKA vs PANDAWA] Memproses 100 Simulasi...")
    for i in range(100):
        run_single_simulation("RAJASIKA", "data/rajasika.json", "PANDAWA", "data/satwika.json")

    print("\n🏆 Turnamen selesai! Data telah disimpan di 'hasil_turnamen.csv' 🏆")