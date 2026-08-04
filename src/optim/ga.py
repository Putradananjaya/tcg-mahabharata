import time
import random
import copy
from src.simulator.fitness import BOUNDS, SMART_START, evaluate_chromosome
from src.optim.objective import scalarized_objective

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


# --- Fase 7 ablation entrypoint ------------------------------------------
# Uniform interface shared by every optimizer compared in
# experiments/exp07_optimizer_ablation.py: run_X_ablation(budget, num_runs,
# seed) -> {"best_theta", "best_value", "history": [(evals_used,
# best_value_so_far), ...]}, minimizing src.optim.objective.scalarized_objective
# (Pers. 4, BalanceDeviation + lambda*PowerCreepPenalty). `budget` = total
# number of scalarized_objective calls (the fair, method-agnostic unit --
# NOT wall-clock time, NOT "generations", since those mean different things
# per algorithm). See rules_spec.md section 14.4.

GA_ABLATION_POP_SIZE = 10


def run_ga_ablation(budget: int, num_runs: int, seed: int):
    rng = random.Random(seed)
    pop_size = GA_ABLATION_POP_SIZE
    generations = max(1, budget // pop_size)

    def rand_chromo():
        return {k: rng.randint(low, high) for k, (low, high) in BOUNDS.items()}

    def xover(p1, p2):
        c1, c2 = {}, {}
        for k in BOUNDS.keys():
            if rng.random() < 0.5:
                c1[k], c2[k] = p1[k], p2[k]
            else:
                c1[k], c2[k] = p2[k], p1[k]
        return c1, c2

    def mut(chromo, rate=0.15):
        m = copy.deepcopy(chromo)
        for k, (low, high) in BOUNDS.items():
            if rng.random() < rate:
                step = int(rng.gauss(0, (high - low) * 0.1))
                m[k] = max(low, min(high, m[k] + step))
        return m

    population = [rand_chromo() for _ in range(pop_size)]
    population[0] = SMART_START.copy()

    history = []
    evals_used = 0
    best_theta, best_value = None, float("inf")

    for _gen in range(generations):
        scored = []
        for chromo in population:
            total, _bal, _pc, _rates = scalarized_objective(chromo, num_runs=num_runs)
            scored.append((total, chromo))
            evals_used += 1
            if total < best_value:
                best_value = total
                best_theta = copy.deepcopy(chromo)
            history.append((evals_used, best_value))

        scored.sort(key=lambda x: x[0])
        new_pop = [copy.deepcopy(scored[0][1]), copy.deepcopy(scored[1][1])]
        while len(new_pop) < pop_size:
            c1 = rng.sample(scored[:4], 1)[0][1]
            c2 = rng.sample(scored[:4], 1)[0][1]
            child1, child2 = xover(c1, c2)
            new_pop.append(mut(child1))
            if len(new_pop) < pop_size:
                new_pop.append(mut(child2))
        population = new_pop

    return {"best_theta": best_theta, "best_value": best_value, "history": history,
            "evals_used": evals_used, "method": "ga_only"}
