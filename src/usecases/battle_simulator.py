import os
import csv
import random
import json
from src.core.models import Player, Card

def export_results(winner_name, turn_count, p1_hp, p2_hp):
    file_exists = os.path.isfile('data/hasil_riset.csv')
    with open('data/hasil_riset.csv', 'a', newline='') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['Winner', 'Total_Turns', 'P1_Final_HP', 'P2_Final_HP'])
        writer.writerow([winner_name, turn_count, p1_hp, p2_hp])

def run_logged_simulation(faksi_1_name, file_json_1, faksi_2_name, file_json_2):
    p1 = Player(faksi_1_name)
    p2 = Player(name=faksi_2_name)
    
    p1.load_deck_from_json(file_json_1)
    p2.load_deck_from_json(file_json_2)
    
    p1.setup_phase()
    p2.setup_phase()
    
    with open(file_json_1, 'r') as f:
        card_a_name_1 = json.load(f)["cards"][0]["name"]
    with open(file_json_2, 'r') as f:
        card_a_name_2 = json.load(f)["cards"][0]["name"]
        
    p1_card_a_count = sum(1 for card in p1.hand if card.name == card_a_name_1)
    p2_card_a_count = sum(1 for card in p2.hand if card.name == card_a_name_2)
    
    p1.play_basic_to_active()
    p2.play_basic_to_active()
    p1.play_basic_to_bench()
    p2.play_basic_to_bench()
    
    players = [p1, p2]
    random.shuffle(players)
    first_player = players[0]
    second_player = players[1]
    
    p1_is_first = 1 if first_player.name == faksi_1_name else 0
    
    turn = 1
    game_active = True
    winner = None
    
    while game_active and turn <= 100:
        first_player.attach_prana()
        res = first_player.attack(opponent=second_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            winner = first_player.name if res == "GAME_OVER" else second_player.name
            break
            
        second_player.attach_prana()
        res = second_player.attack(opponent=first_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            winner = second_player.name if res == "GAME_OVER" else first_player.name
            break
        turn += 1
        
    if not winner:
        hp1 = p1.active_character.current_hp if p1.active_character else 0
        hp2 = p2.active_character.current_hp if p2.active_character else 0
        winner = faksi_1_name if hp1 >= hp2 else faksi_2_name
        
    winner_hp = p1.active_character.current_hp if winner == faksi_1_name else p2.active_character.current_hp
    winner_hp = max(0, winner_hp)
    
    label = 1 if winner == faksi_1_name else 0
    return p1_card_a_count, p2_card_a_count, p1_is_first, turn, winner_hp, label
