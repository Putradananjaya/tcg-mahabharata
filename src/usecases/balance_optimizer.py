import sys
import io
import random
import math
from src.core.models import Player, Card

# Baseline card stats bounds for parameter clipping
BOUNDS = {
    "stw_yudhistira_hp": (90, 150),
    "stw_yudhistira_dmg": (20, 45),
    "stw_yudhistira_dr": (10, 30),
    "stw_yudhistira_heal": (15, 35),
    "stw_yudhistira_cost_satwika": (1, 2),
    "stw_yudhistira_cost_univ": (0, 1),
    "stw_arjuna_hp": (80, 125),
    "stw_arjuna_pasupati_dmg": (40, 65),
    "stw_arjuna_pasupati_cost": (2, 3),
    
    "rjs_balarama_hp": (60, 95),
    "rjs_balarama_dmg": (25, 45),
    "rjs_balarama_cost": (1, 2),
    "rjs_karna_hp": (70, 110),
    "rjs_karna_dmg": (45, 65),
    "rjs_karna_recoil": (5, 20),
    "rjs_karna_cost": (1, 2),
    
    "tms_sengkuni_hp": (75, 105),
    "tms_sengkuni_dmg": (20, 40),
    "tms_sengkuni_mill": (1, 3),
    "tms_sengkuni_cost_tamasika": (1, 2),
    "tms_sengkuni_cost_univ": (0, 1),
    "tms_duryodana_hp": (110, 150),
    "tms_duryodana_angkara_dmg": (30, 50),
    "tms_duryodana_scale_value": (3, 8),
    "tms_duryodana_angkara_cost": (2, 3)
}

# Healthy initial starting point (smart seed)
SMART_START = {
    "stw_yudhistira_hp": 130, "stw_yudhistira_dmg": 30, "stw_yudhistira_dr": 20, "stw_yudhistira_heal": 20, "stw_yudhistira_cost_satwika": 1, "stw_yudhistira_cost_univ": 1,
    "stw_arjuna_hp": 110, "stw_arjuna_pasupati_dmg": 50, "stw_arjuna_pasupati_cost": 3,
    "rjs_balarama_hp": 70, "rjs_balarama_dmg": 35, "rjs_balarama_cost": 1,
    "rjs_karna_hp": 90, "rjs_karna_dmg": 60, "rjs_karna_recoil": 10, "rjs_karna_cost": 2,
    "tms_sengkuni_hp": 90, "tms_sengkuni_dmg": 35, "tms_sengkuni_mill": 2, "tms_sengkuni_cost_tamasika": 1, "tms_sengkuni_cost_univ": 1,
    "tms_duryodana_hp": 130, "tms_duryodana_angkara_dmg": 40, "tms_duryodana_scale_value": 5, "tms_duryodana_angkara_cost": 2
}

def load_deck_from_dict(player, data, copies=20):
    player.deck = []
    for _ in range(copies):
        for card_data in data["cards"]:
            player.deck.append(Card(card_data))
    random.shuffle(player.deck)

def run_simulation(data1, data2, name1, name2):
    p1 = Player(name1)
    p2 = Player(name2)
    load_deck_from_dict(p1, data1)
    load_deck_from_dict(p2, data2)
    
    p1.setup_phase()
    p2.setup_phase()
    p1.play_basic_to_active()
    p2.play_basic_to_active()
    p1.play_basic_to_bench()
    p2.play_basic_to_bench()
    
    players = [p1, p2]
    random.shuffle(players)
    first_player = players[0]
    second_player = players[1]
    
    turn = 1
    while turn <= 100:
        first_player.attach_prana()
        res = first_player.attack(opponent=second_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            return first_player.name if res == "GAME_OVER" else second_player.name
            
        second_player.attach_prana()
        res = second_player.attack(opponent=first_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            return second_player.name if res == "GAME_OVER" else first_player.name
            
        turn += 1
    return name1

def build_faction_decks(params):
    satwika = {
        "faction": "Satwika",
        "cards": [
            {
                "id": "STW-001", "name": "Yudhistira", "type": "Tokoh", "stage": "Basic",
                "hp": int(params["stw_yudhistira_hp"]), "retreat_cost": 1, "damage_reduction": int(params["stw_yudhistira_dr"]),
                "attacks": [
                    {
                        "name": "Sabda Rahayu",
                        "prana_cost": {"Satwika": int(params["stw_yudhistira_cost_satwika"]), "Universal": int(params["stw_yudhistira_cost_univ"])},
                        "base_damage": int(params["stw_yudhistira_dmg"]), "effect": "heal_bench_card", "value": int(params["stw_yudhistira_heal"])
                    }
                ]
            },
            {
                "id": "STW-002", "name": "Raden Arjuna", "type": "Tokoh", "stage": "Basic",
                "hp": int(params["stw_arjuna_hp"]), "retreat_cost": 2,
                "attacks": [
                    {"name": "Panah Kendali", "prana_cost": {"Satwika": 1}, "base_damage": 20},
                    {
                        "name": "Panah Pasupati", "prana_cost": {"Satwika": int(params["stw_arjuna_pasupati_cost"])},
                        "base_damage": int(params["stw_arjuna_pasupati_dmg"]), "bench_scaling": 20
                    }
                ]
            }
        ]
    }
    
    rajasika = {
        "faction": "Rajasika",
        "cards": [
            {
                "id": "RJS-001", "name": "Balarama", "type": "Tokoh", "stage": "Basic",
                "hp": int(params["rjs_balarama_hp"]), "retreat_cost": 2,
                "attacks": [{"name": "Hantaman Nanggala", "prana_cost": {"Rajasika": int(params["rjs_balarama_cost"])}, "base_damage": int(params["rjs_balarama_dmg"])}]
            },
            {
                "id": "RJS-002", "name": "Karna", "type": "Tokoh", "stage": "Basic",
                "hp": int(params["rjs_karna_hp"]), "retreat_cost": 1,
                "attacks": [
                    {
                        "name": "Senjata Konta", "prana_cost": {"Rajasika": int(params["rjs_karna_cost"])},
                        "base_damage": int(params["rjs_karna_dmg"]), "effect": "recoil_damage", "value": int(params["rjs_karna_recoil"])
                    }
                ]
            }
        ]
    }
    
    tamasika = {
        "faction": "Tamasika",
        "cards": [
            {
                "id": "TMS-001", "name": "Patih Sengkuni", "type": "Tokoh", "stage": "Basic",
                "hp": int(params["tms_sengkuni_hp"]), "retreat_cost": 1,
                "attacks": [
                    {
                        "name": "Hasutan Amarta", "prana_cost": {"Tamasika": int(params["tms_sengkuni_cost_tamasika"]), "Universal": int(params["tms_sengkuni_cost_univ"])},
                        "base_damage": int(params["tms_sengkuni_dmg"]), "effect": "mill_enemy_deck", "value": int(params["tms_sengkuni_mill"])
                    }
                ]
            },
            {
                "id": "TMS-002", "name": "Duryodana", "type": "Tokoh", "stage": "Basic",
                "hp": int(params["tms_duryodana_hp"]), "retreat_cost": 3,
                "attacks": [
                    {"name": "Gada Kelana", "prana_cost": {"Universal": 2}, "base_damage": 20},
                    {
                        "name": "Angkara 100 Kurawa", "prana_cost": {"Tamasika": int(params["tms_duryodana_angkara_cost"])},
                        "base_damage": int(params["tms_duryodana_angkara_dmg"]), "effect": "scaled_damage_per_discard_tamasika", "scale_value": int(params["tms_duryodana_scale_value"])
                    }
                ]
            }
        ]
    }

    return satwika, rajasika, tamasika

def evaluate_chromosome(params, num_runs=150):
    satwika, rajasika, tamasika = build_faction_decks(params)

    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        p_v_k = sum(1 for _ in range(num_runs) if run_simulation(satwika, tamasika, "PANDAWA", "KURAWA") == "PANDAWA")
        k_v_r = sum(1 for _ in range(num_runs) if run_simulation(tamasika, rajasika, "KURAWA", "RAJASIKA") == "KURAWA")
        r_v_p = sum(1 for _ in range(num_runs) if run_simulation(rajasika, satwika, "RAJASIKA", "PANDAWA") == "RAJASIKA")
    finally:
        sys.stdout = original_stdout

    rates = {"PANDAWA_vs_KURAWA": (p_v_k / num_runs)*100, "KURAWA_vs_RAJASIKA": (k_v_r / num_runs)*100, "RAJASIKA_vs_PANDAWA": (r_v_p / num_runs)*100}
    loss = (rates["PANDAWA_vs_KURAWA"] - 50)**2 + (rates["KURAWA_vs_RAJASIKA"] - 50)**2 + (rates["RAJASIKA_vs_PANDAWA"] - 50)**2
    return loss, rates


# --- Multi-objective evaluation (NSGA-II) ---
# Healthy game-length band: long enough for real decisions, short enough to
# not stall to the 100-turn simulator cap.
MIN_HEALTHY_TURNS = 10
MAX_HEALTHY_TURNS = 30

def run_simulation_multi(data1, data2, name1, name2):
    p1 = Player(name1)
    p2 = Player(name2)
    load_deck_from_dict(p1, data1)
    load_deck_from_dict(p2, data2)

    p1.setup_phase()
    p2.setup_phase()
    p1.play_basic_to_active()
    p2.play_basic_to_active()
    p1.play_basic_to_bench()
    p2.play_basic_to_bench()

    players = [p1, p2]
    random.shuffle(players)
    first_player = players[0]
    second_player = players[1]

    turn = 1
    while turn <= 100:
        first_player.attach_prana()
        res = first_player.attack(opponent=second_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            winner = first_player.name if res == "GAME_OVER" else second_player.name
            return winner, turn, p1.attack_log, p2.attack_log

        second_player.attach_prana()
        res = second_player.attack(opponent=first_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            winner = second_player.name if res == "GAME_OVER" else first_player.name
            return winner, turn, p1.attack_log, p2.attack_log

        turn += 1
    return name1, turn, p1.attack_log, p2.attack_log

def _normalized_entropy(counts):
    counts = [c for c in counts if c > 0]
    total = sum(counts)
    if len(counts) <= 1 or total == 0:
        return 0.0
    probs = [c / total for c in counts]
    entropy = -sum(p * math.log(p) for p in probs)
    return entropy / math.log(len(counts))

def _length_penalty(avg_turns):
    if avg_turns < MIN_HEALTHY_TURNS:
        return (MIN_HEALTHY_TURNS - avg_turns) ** 2
    if avg_turns > MAX_HEALTHY_TURNS:
        return (avg_turns - MAX_HEALTHY_TURNS) ** 2
    return 0.0

def evaluate_chromosome_multi(params, num_runs=80):
    satwika, rajasika, tamasika = build_faction_decks(params)
    matchups = [
        ("PANDAWA_vs_KURAWA", satwika, tamasika, "PANDAWA", "KURAWA"),
        ("KURAWA_vs_RAJASIKA", tamasika, rajasika, "KURAWA", "RAJASIKA"),
        ("RAJASIKA_vs_PANDAWA", rajasika, satwika, "RAJASIKA", "PANDAWA"),
    ]
    # Multi-attack cards worth tracking for strategic diversity
    diversity_cards = ["Panah Kendali", "Panah Pasupati", "Gada Kelana", "Angkara 100 Kurawa"]
    diversity_pairs = [("Panah Kendali", "Panah Pasupati"), ("Gada Kelana", "Angkara 100 Kurawa")]

    rates = {}
    avg_turns = {}
    attack_counts = {name: 0 for name in diversity_cards}

    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        for label, deck1, deck2, name1, name2 in matchups:
            wins = 0
            turns_sum = 0
            for _ in range(num_runs):
                winner, turns, log1, log2 = run_simulation_multi(deck1, deck2, name1, name2)
                if winner == name1:
                    wins += 1
                turns_sum += turns
                for attack_name in log1 + log2:
                    if attack_name in attack_counts:
                        attack_counts[attack_name] += 1
            rates[label] = (wins / num_runs) * 100
            avg_turns[label] = turns_sum / num_runs
    finally:
        sys.stdout = original_stdout

    f1_fairness = sum((wr - 50) ** 2 for wr in rates.values())
    f2_length = sum(_length_penalty(t) for t in avg_turns.values()) / len(avg_turns)

    diversity_per_card = {
        f"{a}/{b}": _normalized_entropy([attack_counts[a], attack_counts[b]])
        for a, b in diversity_pairs
    }
    f3_diversity = 1.0 - (sum(diversity_per_card.values()) / len(diversity_per_card))

    objectives = (f1_fairness, f2_length, f3_diversity)
    diagnostics = {"rates": rates, "avg_turns": avg_turns, "diversity_per_card": diversity_per_card}
    return objectives, diagnostics
