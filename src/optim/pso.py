import time
import random
import copy
from src.simulator.fitness import BOUNDS, SMART_START, evaluate_chromosome
from src.optim.objective import scalarized_objective

def generate_random_position():
    pos = {}
    for key, (low, high) in BOUNDS.items():
        pos[key] = random.randint(low, high)
    return pos

def run_pso_balancing(pop_size=6, iterations=10, num_runs=150):
    print("=== MEMULAI OPTIMASI PARTICLE SWARM OPTIMIZATION (PSO) ===")
    
    # PSO parameters
    w = 0.5   # Inertia weight
    c1 = 1.5  # Cognitive coefficient
    c2 = 1.5  # Social coefficient
    
    # Init particles
    particles_x = [generate_random_position() for _ in range(pop_size)]
    # Seed the first particle with a healthy state
    particles_x[0] = SMART_START.copy()
    
    # Initialize velocities to 0
    particles_v = []
    for _ in range(pop_size):
        v = {k: 0.0 for k in BOUNDS.keys()}
        particles_v.append(v)
        
    # Track personal bests
    p_best_x = copy.deepcopy(particles_x)
    p_best_loss = [float('inf')] * pop_size
    
    # Track global best
    g_best_x = None
    g_best_loss = float('inf')
    g_best_rates = None
    
    start_time = time.time()
    
    for it in range(iterations):
        for idx in range(pop_size):
            loss, rates = evaluate_chromosome(particles_x[idx], num_runs=num_runs)
            
            # Update personal best
            if loss < p_best_loss[idx]:
                p_best_loss[idx] = loss
                p_best_x[idx] = copy.deepcopy(particles_x[idx])
                
            # Update global best
            if loss < g_best_loss:
                g_best_loss = loss
                g_best_rates = rates
                g_best_x = copy.deepcopy(particles_x[idx])
                
        print(f"  Iterasi {it:<2} | Loss Terbaik Global: {g_best_loss:.2f} | Rates: {g_best_rates}")
        
        # Update velocities and positions
        for idx in range(pop_size):
            for k in BOUNDS.keys():
                r1, r2 = random.random(), random.random()
                
                # Update velocity
                cognitive = c1 * r1 * (p_best_x[idx][k] - particles_x[idx][k])
                social = c2 * r2 * (g_best_x[k] - particles_x[idx][k])
                particles_v[idx][k] = w * particles_v[idx][k] + cognitive + social
                
                # Update position
                particles_x[idx][k] = int(round(particles_x[idx][k] + particles_v[idx][k]))
                    
                # Clipping within boundaries
                low, high = BOUNDS[k]
                particles_x[idx][k] = max(low, min(high, particles_x[idx][k]))
                
    elapsed_time = time.time() - start_time
    
    print("\n=== HASIL AKHIR OPTIMASI PSO ===")
    print(f"Waktu Komputasi PSO : {elapsed_time:.2f} detik")
    print(f"Loss Akhir Terbaik  : {g_best_loss:.2f}")
    print(f"Rasio Kemenangan Seimbang (150 Run):")
    for matchup, wr in g_best_rates.items():
        print(f"  - {matchup}: {wr:.2f}%")
        
    print("\n=== VALIDASI AKHIR RUN (N = 1000) ===")
    final_loss, final_rates = evaluate_chromosome(g_best_x, num_runs=1000)
    print(f"Hasil Validasi Win Rates (1000 Pertandingan):")
    for matchup, wr in final_rates.items():
        print(f"  - {matchup}: {wr:.2f}% (Selisih dari 50%: {abs(wr-50):.2f}%)")

    return g_best_x


# --- Fase 7 ablation entrypoint (see src.optim.ga.run_ga_ablation for the
# shared interface contract) -------------------------------------------
#
# CONSTRAINT HANDLING (Fase 7 review: "HP dan Prana_Cost adalah integer.
# Bagaimana PSO menanganinya?"): every src.simulator.fitness.BOUNDS
# dimension is integer-valued, but PSO's velocity update is inherently
# continuous. This implementation (both the legacy run_pso_balancing above
# and this ablation entrypoint) uses ROUND-THEN-CLIP: after applying the
# continuous velocity update, each dimension is rounded to the nearest
# integer (`int(round(...))`) and then clipped into [low, high] (repairing
# any out-of-bounds excursion the velocity step caused). This is NOT a
# more sophisticated repair operator (e.g. reflecting off the boundary, or
# resampling) -- round-then-clip is the simplest constraint-handling
# strategy and is stated here explicitly rather than left implicit, per
# rules_spec.md section 14.3, which also discusses the one concrete
# failure mode this causes: repeated rounding can make a particle's
# effective step size collapse to 0 once its continuous position sits
# within 0.5 of an integer on every dimension it keeps oscillating on,
# functionally freezing that particle early. CMA-ES and Bayesian
# Optimization below reuse the identical round-then-clip repair for the
# same reason and the same caveat applies to both.

PSO_ABLATION_POP_SIZE = 10


def _round_clip(position: dict) -> dict:
    repaired = {}
    for k, (low, high) in BOUNDS.items():
        repaired[k] = max(low, min(high, int(round(position[k]))))
    return repaired


def run_pso_ablation(budget: int, num_runs: int, seed: int):
    rng = random.Random(seed)
    pop_size = PSO_ABLATION_POP_SIZE
    iterations = max(1, budget // pop_size)
    w, c1, c2 = 0.5, 1.5, 1.5

    particles_x = [{k: rng.randint(low, high) for k, (low, high) in BOUNDS.items()} for _ in range(pop_size)]
    particles_x[0] = SMART_START.copy()
    particles_v = [{k: 0.0 for k in BOUNDS.keys()} for _ in range(pop_size)]

    p_best_x = copy.deepcopy(particles_x)
    p_best_loss = [float("inf")] * pop_size
    g_best_x, g_best_loss = None, float("inf")

    history = []
    evals_used = 0

    for _it in range(iterations):
        for idx in range(pop_size):
            total, _bal, _pc, _rates = scalarized_objective(particles_x[idx], num_runs=num_runs)
            evals_used += 1
            if total < p_best_loss[idx]:
                p_best_loss[idx] = total
                p_best_x[idx] = copy.deepcopy(particles_x[idx])
            if total < g_best_loss:
                g_best_loss = total
                g_best_x = copy.deepcopy(particles_x[idx])
            history.append((evals_used, g_best_loss))

        for idx in range(pop_size):
            for k in BOUNDS.keys():
                r1, r2 = rng.random(), rng.random()
                cognitive = c1 * r1 * (p_best_x[idx][k] - particles_x[idx][k])
                social = c2 * r2 * (g_best_x[k] - particles_x[idx][k])
                particles_v[idx][k] = w * particles_v[idx][k] + cognitive + social
                particles_x[idx][k] = particles_x[idx][k] + particles_v[idx][k]
            particles_x[idx] = _round_clip(particles_x[idx])

    return {"best_theta": g_best_x, "best_value": g_best_loss, "history": history,
            "evals_used": evals_used, "method": "pso_only"}
