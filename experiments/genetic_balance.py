import json
import random
import sys
import io

from engine import Player, Card

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
        
    hp1 = p1.active_character.current_hp if p1.active_character else 0
    hp2 = p2.active_character.current_hp if p2.active_character else 0
    return name1 if hp1 >= hp2 else name2

def evaluate_chromosome(params, num_runs=100):
    satwika = {
        "faction": "Satwika",
        "cards": [
            {
                "id": "STW-001",
                "name": "Yudhistira",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": int(params["stw_yudhistira_hp"]),
                "retreat_cost": 1,
                "damage_reduction": int(params["stw_yudhistira_dr"]),
                "attacks": [
                    {
                        "name": "Sabda Rahayu",
                        "prana_cost": {"Satwika": int(params["stw_yudhistira_cost_satwika"]), "Universal": int(params["stw_yudhistira_cost_univ"])},
                        "base_damage": int(params["stw_yudhistira_dmg"]),
                        "effect": "heal_bench_card",
                        "value": int(params["stw_yudhistira_heal"])
                    }
                ]
            },
            {
                "id": "STW-002",
                "name": "Raden Arjuna",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": int(params["stw_arjuna_hp"]),
                "retreat_cost": 2,
                "attacks": [
                    {
                        "name": "Panah Kendali",
                        "prana_cost": {"Satwika": 1},
                        "base_damage": 20
                    },
                    {
                        "name": "Panah Pasupati",
                        "prana_cost": {"Satwika": int(params["stw_arjuna_pasupati_cost"])},
                        "base_damage": int(params["stw_arjuna_pasupati_dmg"]),
                        "bench_scaling": 20
                    }
                ]
            }
        ]
    }
    
    rajasika = {
        "faction": "Rajasika",
        "cards": [
            {
                "id": "RJS-001",
                "name": "Balarama",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": int(params["rjs_balarama_hp"]),
                "retreat_cost": 2,
                "attacks": [
                    {
                        "name": "Hantaman Nanggala",
                        "prana_cost": {"Rajasika": int(params["rjs_balarama_cost"])},
                        "base_damage": int(params["rjs_balarama_dmg"])
                    }
                ]
            },
            {
                "id": "RJS-002",
                "name": "Karna",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": int(params["rjs_karna_hp"]),
                "retreat_cost": 1,
                "attacks": [
                    {
                        "name": "Senjata Konta",
                        "prana_cost": {"Rajasika": int(params["rjs_karna_cost"])},
                        "base_damage": int(params["rjs_karna_dmg"]),
                        "effect": "recoil_damage",
                        "value": int(params["rjs_karna_recoil"])
                    }
                ]
            }
        ]
    }
    
    tamasika = {
        "faction": "Tamasika",
        "cards": [
            {
                "id": "TMS-001",
                "name": "Patih Sengkuni",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": int(params["tms_sengkuni_hp"]),
                "retreat_cost": 1,
                "attacks": [
                    {
                        "name": "Hasutan Amarta",
                        "prana_cost": {"Tamasika": int(params["tms_sengkuni_cost_tamasika"]), "Universal": int(params["tms_sengkuni_cost_univ"])},
                        "base_damage": int(params["tms_sengkuni_dmg"]),
                        "effect": "mill_enemy_deck",
                        "value": int(params["tms_sengkuni_mill"])
                    }
                ]
            },
            {
                "id": "TMS-002",
                "name": "Duryodana",
                "type": "Tokoh",
                "stage": "Basic",
                "hp": int(params["tms_duryodana_hp"]),
                "retreat_cost": 3,
                "attacks": [
                    {
                        "name": "Gada Kelana",
                        "prana_cost": {"Universal": 2},
                        "base_damage": 20
                    },
                    {
                        "name": "Angkara 100 Kurawa",
                        "prana_cost": {"Tamasika": int(params["tms_duryodana_angkara_cost"])},
                        "base_damage": int(params["tms_duryodana_angkara_dmg"]),
                        "effect": "scaled_damage_per_discard_tamasika",
                        "scale_value": int(params["tms_duryodana_scale_value"])
                    }
                ]
            }
        ]
    }
    
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    
    try:
        p_v_k = 0
        for _ in range(num_runs):
            winner = run_simulation(satwika, tamasika, "PANDAWA", "KURAWA")
            if winner == "PANDAWA":
                p_v_k += 1
                
        k_v_r = 0
        for _ in range(num_runs):
            winner = run_simulation(tamasika, rajasika, "KURAWA", "RAJASIKA")
            if winner == "KURAWA":
                k_v_r += 1
                
        r_v_p = 0
        for _ in range(num_runs):
            winner = run_simulation(rajasika, satwika, "RAJASIKA", "PANDAWA")
            if winner == "RAJASIKA":
                r_v_p += 1
    finally:
        sys.stdout = original_stdout
        
    rates = {
        "PANDAWA_vs_KURAWA": (p_v_k / num_runs) * 100,
        "KURAWA_vs_RAJASIKA": (k_v_r / num_runs) * 100,
        "RAJASIKA_vs_PANDAWA": (r_v_p / num_runs) * 100
    }
    
    loss = (
        (rates["PANDAWA_vs_KURAWA"] - 50)**2 +
        (rates["KURAWA_vs_RAJASIKA"] - 50)**2 +
        (rates["RAJASIKA_vs_PANDAWA"] - 50)**2
    )
    
    return loss, rates

def generate_random_chromosome():
    return {
        "stw_yudhistira_hp": random.randint(110, 150),
        "stw_yudhistira_dmg": random.randint(25, 45),
        "stw_yudhistira_dr": random.choice([10, 15, 20, 25]),
        "stw_yudhistira_heal": random.randint(10, 30),
        "stw_yudhistira_cost_satwika": random.choice([1, 2]),
        "stw_yudhistira_cost_univ": random.choice([0, 1]),
        
        "stw_arjuna_hp": random.randint(95, 125),
        "stw_arjuna_pasupati_dmg": random.randint(40, 65),
        "stw_arjuna_pasupati_cost": random.choice([2, 3]),
        
        "rjs_balarama_hp": random.randint(70, 95),
        "rjs_balarama_dmg": random.randint(30, 45),
        "rjs_balarama_cost": random.choice([1, 2]),
        
        "rjs_karna_hp": random.randint(80, 110),
        "rjs_karna_dmg": random.randint(45, 65),
        "rjs_karna_recoil": random.randint(5, 20),
        "rjs_karna_cost": random.choice([1, 2]),
        
        "tms_sengkuni_hp": random.randint(80, 105),
        "tms_sengkuni_dmg": random.randint(25, 40),
        "tms_sengkuni_mill": random.randint(1, 4),
        "tms_sengkuni_cost_tamasika": random.choice([1, 2]),
        "tms_sengkuni_cost_univ": random.choice([0, 1]),
        
        "tms_duryodana_hp": random.randint(115, 145),
        "tms_duryodana_angkara_dmg": random.randint(35, 50),
        "tms_duryodana_scale_value": random.randint(4, 10),
        "tms_duryodana_angkara_cost": random.choice([2, 3])
    }

def crossover(parent1, parent2):
    child1 = {}
    child2 = {}
    for key in parent1.keys():
        if random.random() < 0.5:
            child1[key] = parent1[key]
            child2[key] = parent2[key]
        else:
            child1[key] = parent2[key]
            child2[key] = parent1[key]
    return child1, child2

def mutate(chromosome, rate=0.2):
    mutated = copy.deepcopy(chromosome)
    for key in mutated.keys():
        if random.random() < rate:
            if "cost" in key or "univ" in key:
                # Toggle values
                if "cost_satwika" in key or "cost_tamasika" in key or "pasupati_cost" in key or "karna_cost" in key or "balarama_cost" in key or "angkara_cost" in key:
                    mutated[key] = random.choice([1, 2, 3])
                else:
                    mutated[key] = random.choice([0, 1])
            elif "hp" in key:
                mutated[key] = max(70, min(160, int(mutated[key] + random.choice([-10, -5, 5, 10]))))
            elif "dmg" in key:
                mutated[key] = max(15, min(80, int(mutated[key] + random.choice([-4, -2, 2, 4]))))
            elif "dr" in key or "heal" in key:
                mutated[key] = max(10, min(30, int(mutated[key] + random.choice([-5, 5]))))
            elif "recoil" in key:
                mutated[key] = max(5, min(25, int(mutated[key] + random.choice([-2, 2]))))
            elif "mill" in key:
                mutated[key] = max(1, min(4, int(mutated[key] + random.choice([-1, 1]))))
            elif "scale_value" in key:
                mutated[key] = max(3, min(10, int(mutated[key] + random.choice([-1, 1]))))
    return mutated

import copy

def run_genetic_algorithm(pop_size=10, generations=15, evaluations_per_fit=120):
    print("=== MENGINISIALISASI ALGORITMA GENETIKA (GA) BALANCER ===")
    print(f"Populasi: {pop_size} individu, Generasi: {generations}")
    
    # 1. Initialize population
    population = [generate_random_chromosome() for _ in range(pop_size)]
    
    # Add our current balanced stats as the first individual to speed up convergence
    current_balanced = {
        "stw_yudhistira_hp": 130, "stw_yudhistira_dmg": 32, "stw_yudhistira_dr": 20, "stw_yudhistira_heal": 25, "stw_yudhistira_cost_satwika": 1, "stw_yudhistira_cost_univ": 1,
        "stw_arjuna_hp": 110, "stw_arjuna_pasupati_dmg": 50, "stw_arjuna_pasupati_cost": 3,
        "rjs_balarama_hp": 70, "rjs_balarama_dmg": 38, "rjs_balarama_cost": 1,
        "rjs_karna_hp": 90, "rjs_karna_dmg": 60, "rjs_karna_recoil": 10, "rjs_karna_cost": 2,
        "tms_sengkuni_hp": 95, "tms_sengkuni_dmg": 35, "tms_sengkuni_mill": 2, "tms_sengkuni_cost_tamasika": 1, "tms_sengkuni_cost_univ": 1,
        "tms_duryodana_hp": 135, "tms_duryodana_angkara_dmg": 42, "tms_duryodana_scale_value": 5, "tms_duryodana_angkara_cost": 2
    }
    population[0] = current_balanced
    
    best_chrom = None
    best_loss = float('inf')
    best_rates = None
    
    for gen in range(generations):
        # 2. Evaluate fitness (loss)
        scored_pop = []
        for idx, chrom in enumerate(population):
            loss, rates = evaluate_chromosome(chrom, num_runs=evaluations_per_fit)
            scored_pop.append((loss, rates, chrom))
            
        # Sort by loss (lower is better)
        scored_pop.sort(key=lambda x: x[0])
        
        gen_best_loss, gen_best_rates, gen_best_chrom = scored_pop[0]
        print(f"Generasi {gen}: Loss Terbaik = {gen_best_loss:.2f} | Rates: {gen_best_rates}")
        
        if gen_best_loss < best_loss:
            best_loss = gen_best_loss
            best_rates = gen_best_rates
            best_chrom = gen_best_chrom
            
        # 3. Selection: Keep the top 4 individuals
        survivors = [x[2] for x in scored_pop[:4]]
        
        # 4. Reproduction: Generate new children using crossover and mutation
        new_population = []
        # Keep the elite best individual unchanged
        new_population.append(survivors[0])
        new_population.append(survivors[1])
        
        # Generate children from survivors
        while len(new_population) < pop_size:
            p1, p2 = random.sample(survivors, 2)
            c1, c2 = crossover(p1, p2)
            new_population.append(mutate(c1))
            if len(new_population) < pop_size:
                new_population.append(mutate(c2))
                
        population = new_population
        
    print("\n=== EKSPERIMEN GENETIC ALGORITHM SELESAI ===")
    print(f"Loss Terbaik Akhir: {best_loss:.2f}")
    print(f"Win Rates Seimbang Terbaik: {best_rates}")
    print("Konfigurasi Kromosom Terbaik:")
    print(json.dumps(best_chrom, indent=4))
    
    # Save the GA balanced params to a json file
    with open("ga_balanced_params.json", "w") as f:
        json.dump(best_chrom, f, indent=4)

if __name__ == "__main__":
    run_genetic_algorithm(pop_size=8, generations=12, evaluations_per_fit=150)
