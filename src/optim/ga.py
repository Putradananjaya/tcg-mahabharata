import time
import random
import copy
from src.simulator.fitness import BOUNDS, SMART_START, evaluate_chromosome

def generate_random_chromosome():
    chromo = {}
    for key, (low, high) in BOUNDS.items():
        chromo[key] = random.randint(low, high)
    return chromo

def crossover(parent1, parent2):
    child1 = {}
    child2 = {}
    for k in BOUNDS.keys():
        if random.random() < 0.5:
            child1[k] = parent1[k]
            child2[k] = parent2[k]
        else:
            child1[k] = parent2[k]
            child2[k] = parent1[k]
    return child1, child2

def mutate(chromo, mutation_rate=0.15):
    mutated = copy.deepcopy(chromo)
    for k, (low, high) in BOUNDS.items():
        if random.random() < mutation_rate:
            step = int(random.gauss(0, (high - low) * 0.1))
            mutated[k] = max(low, min(high, mutated[k] + step))
    return mutated

def run_ga_balancing(pop_size=6, generations=10, num_runs=150):
    print("=== MEMULAI OPTIMASI GENETIC ALGORITHM (GA) ===")
    
    # Init population
    population = [generate_random_chromosome() for _ in range(pop_size)]
    population[0] = SMART_START.copy()
    
    start_time = time.time()
    
    best_chromo = None
    best_loss = float('inf')
    best_rates = None
    
    for gen in range(generations):
        # Evaluate fitness
        fitness_scores = []
        for chromo in population:
            loss, rates = evaluate_chromosome(chromo, num_runs=num_runs)
            fitness_scores.append((loss, rates, chromo))
            if loss < best_loss:
                best_loss = loss
                best_rates = rates
                best_chromo = copy.deepcopy(chromo)
                
        print(f"  Generasi {gen:<2} | Loss Terbaik Global: {best_loss:.2f} | Rates: {best_rates}")
        
        # Sort by loss (ascending)
        fitness_scores.sort(key=lambda x: x[0])
        
        # Selection & Reproduction
        new_pop = []
        # Elitism
        new_pop.append(copy.deepcopy(fitness_scores[0][2]))
        new_pop.append(copy.deepcopy(fitness_scores[1][2]))
        
        # Fill rest of population
        while len(new_pop) < pop_size:
            # Tournament selection
            candidates = random.sample(fitness_scores, 3)
            candidates.sort(key=lambda x: x[0])
            p1 = candidates[0][2]
            
            candidates2 = random.sample(fitness_scores, 3)
            candidates2.sort(key=lambda x: x[0])
            p2 = candidates2[0][2]
            
            c1, c2 = crossover(p1, p2)
            new_pop.append(mutate(c1))
            if len(new_pop) < pop_size:
                new_pop.append(mutate(c2))
                
        population = new_pop
        
    elapsed_time = time.time() - start_time
    print("\n=== HASIL AKHIR OPTIMASI GA ===")
    print(f"Waktu Komputasi GA : {elapsed_time:.2f} detik")
    print(f"Loss Akhir Terbaik  : {best_loss:.2f}")
    print(f"Rasio Kemenangan Seimbang (150 Run):")
    for matchup, wr in best_rates.items():
        print(f"  - {matchup}: {wr:.2f}%")
        
    return best_chromo
