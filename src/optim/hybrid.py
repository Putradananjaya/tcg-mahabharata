"""Hybrid GA+PSO optimizer: GA for global exploration (crossover/mutate
over the whole population), PSO for local refinement of the elite subset
each generation. Each generation: (1) evaluate the population (GA phase),
produce the next generation via elitism+tournament+crossover+mutation
(src.optim.ga's operators, reused not duplicated); (2) take the top-K
elites from the JUST-evaluated population and run one PSO velocity-update
step treating them as a small swarm pulled toward their own local best,
using src.optim.pso's round-then-clip integer repair (see that module's
Fase 7 constraint-handling note -- identical repair used here); (3) splice
the K refined elites into the next generation, replacing its K weakest
freshly-bred offspring slots.

If this does not beat GA-only by a significant margin in
experiments/exp07_optimizer_ablation.py, the "hybrid" framing must be
dropped from the paper's claims per this phase's own acceptance criteria
-- this module does not assume the hybrid wins, it just needs to be a
real, honestly-implemented hybrid so that comparison is meaningful.
"""
from __future__ import annotations

import copy
import random

from src.optim.ga import crossover, mutate
from src.optim.objective import scalarized_objective
from src.optim.pso import _round_clip
from src.simulator.fitness import BOUNDS, SMART_START

HYBRID_POP_SIZE = 10
HYBRID_ELITE_K = 3


def run_hybrid_ablation(budget: int, num_runs: int, seed: int):
    rng = random.Random(seed)
    pop_size = HYBRID_POP_SIZE
    k = HYBRID_ELITE_K
    evals_per_round = pop_size + k
    rounds = max(1, budget // evals_per_round)

    population = [{key: rng.randint(low, high) for key, (low, high) in BOUNDS.items()} for _ in range(pop_size)]
    population[0] = SMART_START.copy()

    # PSO state for the elite swarm persists across rounds (personal bests,
    # velocities), even though WHICH individuals occupy the elite slots can
    # change generation to generation -- velocities are re-keyed by rank
    # (elite index 0..k-1), not by identity, since GA offspring replace
    # individuals wholesale each generation.
    elite_v = [{k_: 0.0 for k_ in BOUNDS.keys()} for _ in range(k)]
    elite_p_best_x = [None] * k
    elite_p_best_loss = [float("inf")] * k

    history = []
    evals_used = 0
    best_theta, best_value = None, float("inf")

    for _round in range(rounds):
        scored = []
        for chromo in population:
            total, _bal, _pc, _rates = scalarized_objective(chromo, num_runs=num_runs)
            evals_used += 1
            scored.append((total, chromo))
            if total < best_value:
                best_value = total
                best_theta = copy.deepcopy(chromo)
            history.append((evals_used, best_value))

        scored.sort(key=lambda x: x[0])

        # --- GA phase: breed the next generation from the whole scored population ---
        new_pop = [copy.deepcopy(scored[0][1]), copy.deepcopy(scored[1][1])]
        while len(new_pop) < pop_size:
            c1_parent = rng.sample(scored[:4], 1)[0][1]
            c2_parent = rng.sample(scored[:4], 1)[0][1]
            child1, child2 = crossover(c1_parent, c2_parent)
            new_pop.append(mutate(child1))
            if len(new_pop) < pop_size:
                new_pop.append(mutate(child2))

        # --- PSO phase: refine the top-k elites of THIS generation ---
        elites = [copy.deepcopy(scored[i][1]) for i in range(k)]
        elite_g_best_x = copy.deepcopy(scored[0][1])
        elite_g_best_loss = scored[0][0]

        for i in range(k):
            if scored[i][0] < elite_p_best_loss[i]:
                elite_p_best_loss[i] = scored[i][0]
                elite_p_best_x[i] = copy.deepcopy(elites[i])

        refined = []
        for i in range(k):
            pbest = elite_p_best_x[i] or elites[i]
            new_pos = {}
            for key in BOUNDS.keys():
                r1, r2 = rng.random(), rng.random()
                cognitive = 1.5 * r1 * (pbest[key] - elites[i][key])
                social = 1.5 * r2 * (elite_g_best_x[key] - elites[i][key])
                elite_v[i][key] = 0.5 * elite_v[i][key] + cognitive + social
                new_pos[key] = elites[i][key] + elite_v[i][key]
            refined.append(_round_clip(new_pos))

        refined_scored = []
        for chromo in refined:
            total, _bal, _pc, _rates = scalarized_objective(chromo, num_runs=num_runs)
            evals_used += 1
            refined_scored.append((total, chromo))
            if total < best_value:
                best_value = total
                best_theta = copy.deepcopy(chromo)
            history.append((evals_used, best_value))

        # Splice the k refined elites into the next generation, replacing
        # its k weakest (last-bred) slots.
        for i in range(k):
            new_pop[-(i + 1)] = refined_scored[i][1]

        population = new_pop

    return {"best_theta": best_theta, "best_value": best_value, "history": history,
            "evals_used": evals_used, "method": "hybrid_ga_pso"}


def run_hybrid_balancing(pop_size: int, generations: int, num_runs: int):
    """Legacy-shaped entrypoint (pop_size x generations, like run_ga_balancing
    / run_pso_balancing) for interactive/manual use outside the ablation
    harness. Delegates to run_hybrid_ablation with an equivalent budget."""
    budget = pop_size * generations
    result = run_hybrid_ablation(budget=budget, num_runs=num_runs, seed=random.randint(0, 2**31 - 1))
    return result["best_theta"]
