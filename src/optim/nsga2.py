import os
import time
import json
import random
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 -- registers the 3d projection
from src.simulator.fitness import BOUNDS, SMART_START, evaluate_chromosome_multi, evaluate_chromosome_power_balance
from src.optim.ga import generate_random_chromosome, crossover, mutate


def dominates(obj_a, obj_b):
    """True if obj_a Pareto-dominates obj_b (all 3 objectives minimized)."""
    not_worse = all(a <= b for a, b in zip(obj_a, obj_b))
    strictly_better = any(a < b for a, b in zip(obj_a, obj_b))
    return not_worse and strictly_better


def fast_non_dominated_sort(objs):
    n = len(objs)
    domination_counts = [0] * n
    dominated_by = [[] for _ in range(n)]
    fronts = [[]]

    for p in range(n):
        for q in range(n):
            if p == q:
                continue
            if dominates(objs[p], objs[q]):
                dominated_by[p].append(q)
            elif dominates(objs[q], objs[p]):
                domination_counts[p] += 1
        if domination_counts[p] == 0:
            fronts[0].append(p)

    i = 0
    while fronts[i]:
        next_front = []
        for p in fronts[i]:
            for q in dominated_by[p]:
                domination_counts[q] -= 1
                if domination_counts[q] == 0:
                    next_front.append(q)
        i += 1
        fronts.append(next_front)

    fronts.pop()  # last front is always empty
    return fronts


def crowding_distance(front_indices, objs):
    distance = {idx: 0.0 for idx in front_indices}
    if len(front_indices) == 0:
        return distance

    num_objectives = len(objs[front_indices[0]])
    for m in range(num_objectives):
        sorted_indices = sorted(front_indices, key=lambda idx: objs[idx][m])
        min_val = objs[sorted_indices[0]][m]
        max_val = objs[sorted_indices[-1]][m]
        distance[sorted_indices[0]] = float('inf')
        distance[sorted_indices[-1]] = float('inf')

        if max_val == min_val:
            continue
        for i in range(1, len(sorted_indices) - 1):
            prev_val = objs[sorted_indices[i - 1]][m]
            next_val = objs[sorted_indices[i + 1]][m]
            distance[sorted_indices[i]] += (next_val - prev_val) / (max_val - min_val)

    return distance


def tournament_select(pop_size, ranks, crowding):
    a, b = random.sample(range(pop_size), 2)
    if ranks[a] != ranks[b]:
        return a if ranks[a] < ranks[b] else b
    return a if crowding[a] > crowding[b] else b


def _evaluate_population(population, num_runs):
    objs, diags = [], []
    for chromo in population:
        obj, diag = evaluate_chromosome_multi(chromo, num_runs=num_runs)
        objs.append(obj)
        diags.append(diag)
    return objs, diags


def _plot_pareto_front(pareto_front):
    f1_vals = [p["f1_fairness"] for p in pareto_front]
    f2_vals = [p["f2_length"] for p in pareto_front]
    f3_vals = [p["f3_diversity"] for p in pareto_front]

    fig = plt.figure(figsize=(9, 7))
    ax = fig.add_subplot(111, projection='3d')
    scatter = ax.scatter(f1_vals, f2_vals, f3_vals, c=f1_vals, cmap='viridis', s=70, edgecolor='k')
    ax.set_xlabel('F1: Fairness Loss', fontsize=10)
    ax.set_ylabel('F2: Game-Length Penalty', fontsize=10)
    ax.set_zlabel('F3: Dominant-Strategy Score', fontsize=10)
    ax.set_title('NSGA-II Pareto Front: TCG Balance Trade-offs\n(semua sumbu: lebih rendah = lebih baik)', fontsize=12, fontweight='bold')
    fig.colorbar(scatter, ax=ax, label='F1 Fairness Loss', shrink=0.6)

    os.makedirs("figures", exist_ok=True)
    plt.savefig('figures/nsga2_pareto_front.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Grafik 'figures/nsga2_pareto_front.png' berhasil disimpan.")


def run_nsga2_balancing(pop_size=10, generations=10, num_runs=80):
    print("=== MEMULAI OPTIMASI MULTI-OBJECTIVE (NSGA-II) ===")
    print(f"Objectives: F1=Fairness, F2=Game-Length Health, F3=Strategic Diversity (semua minimize)\n")

    population = [generate_random_chromosome() for _ in range(pop_size)]
    population[0] = SMART_START.copy()

    objs, _ = _evaluate_population(population, num_runs)

    start_time = time.time()

    for gen in range(generations):
        fronts = fast_non_dominated_sort(objs)
        ranks, crowding = {}, {}
        for rank_idx, front in enumerate(fronts):
            cd = crowding_distance(front, objs)
            for idx in front:
                ranks[idx] = rank_idx
                crowding[idx] = cd[idx]

        # Offspring via binary tournament + crossover + mutation (reused from GA)
        offspring = []
        while len(offspring) < pop_size:
            i1 = tournament_select(len(population), ranks, crowding)
            i2 = tournament_select(len(population), ranks, crowding)
            c1, c2 = crossover(population[i1], population[i2])
            offspring.append(mutate(c1))
            if len(offspring) < pop_size:
                offspring.append(mutate(c2))

        offspring_objs, _ = _evaluate_population(offspring, num_runs)

        combined_pop = population + offspring
        combined_objs = objs + offspring_objs
        combined_fronts = fast_non_dominated_sort(combined_objs)

        new_population, new_objs = [], []
        for front in combined_fronts:
            if len(new_population) + len(front) <= pop_size:
                for idx in front:
                    new_population.append(combined_pop[idx])
                    new_objs.append(combined_objs[idx])
            else:
                remaining = pop_size - len(new_population)
                cd = crowding_distance(front, combined_objs)
                sorted_front = sorted(front, key=lambda idx: cd[idx], reverse=True)
                for idx in sorted_front[:remaining]:
                    new_population.append(combined_pop[idx])
                    new_objs.append(combined_objs[idx])
                break

        population, objs = new_population, new_objs

        front0 = fast_non_dominated_sort(objs)[0]
        best_f1 = min(objs[i][0] for i in front0)
        best_f2 = min(objs[i][1] for i in front0)
        best_f3 = min(objs[i][2] for i in front0)
        print(f"  Generasi {gen:<2} | Ukuran Front-0: {len(front0):<3} | Best F1: {best_f1:.2f} | Best F2: {best_f2:.2f} | Best F3: {best_f3:.3f}")

    elapsed = time.time() - start_time
    final_front0 = fast_non_dominated_sort(objs)[0]

    print("\n=== HASIL AKHIR OPTIMASI NSGA-II ===")
    print(f"Waktu Komputasi NSGA-II : {elapsed:.2f} detik")
    print(f"Jumlah Solusi Pareto-Optimal (Front-0): {len(final_front0)}")

    print("\n=== VALIDASI ULANG FRONT-0 (N = 500 per matchup) ===")
    pareto_front = []
    for idx in final_front0:
        chromo = population[idx]
        val_obj, val_diag = evaluate_chromosome_multi(chromo, num_runs=500)
        pareto_front.append({
            "params": chromo,
            "f1_fairness": val_obj[0],
            "f2_length": val_obj[1],
            "f3_diversity": val_obj[2],
            "rates": val_diag["rates"],
            "avg_turns": val_diag["avg_turns"],
        })
        print(f"  F1={val_obj[0]:.2f} | F2={val_obj[1]:.2f} | F3={val_obj[2]:.3f} | Rates={val_diag['rates']}")

    # Re-validated objectives can shift under fresh randomness (num_runs=80 during
    # search vs 500 here), so a member selected as non-dominated at search-time may
    # no longer be one at high-fidelity. Re-filter so the saved front is a genuine
    # Pareto front w.r.t. the validated (N=500) objectives.
    validated_objs = [(p["f1_fairness"], p["f2_length"], p["f3_diversity"]) for p in pareto_front]
    validated_front0 = fast_non_dominated_sort(validated_objs)[0]
    dropped = len(pareto_front) - len(validated_front0)
    pareto_front = [pareto_front[i] for i in validated_front0]
    if dropped > 0:
        print(f"\n{dropped} solusi dibuang (didominasi setelah validasi N=500) -> front final: {len(pareto_front)} solusi.")

    os.makedirs("data", exist_ok=True)
    with open("data/nsga2_pareto_front.json", "w") as f:
        json.dump(pareto_front, f, indent=2)
    print("\nHasil Pareto front disimpan ke 'data/nsga2_pareto_front.json'.")

    _plot_pareto_front(pareto_front)

    return pareto_front


# --- Fase 7: the objectives the paper's Pers. (4) review actually asked
# for -- f1 = pairwise balance deviation, f2 = power creep penalty
# (src.metrics.power_creep), f3 = -Faction Identity Index
# (src.metrics.diversity.faction_identity_index). Separate from
# run_nsga2_balancing above (which predates this phase and uses a
# different f2/f3 -- game-length health and within-faction dominant-attack
# score -- kept untouched rather than silently repurposed). Reuses the
# same generic dominates/fast_non_dominated_sort/crowding_distance/
# tournament_select machinery, which is objective-count-agnostic.

def _evaluate_population_power_balance(population, num_runs):
    objs, diags = [], []
    for chromo in population:
        obj, diag = evaluate_chromosome_power_balance(chromo, num_runs=num_runs)
        objs.append(obj)
        diags.append(diag)
    return objs, diags


def _plot_pareto_front_power_balance(pareto_front, out_path="figures/nsga2_power_balance_pareto_front.png"):
    f1_vals = [p["f1_balance"] for p in pareto_front]
    f2_vals = [p["f2_power_creep"] for p in pareto_front]
    f3_vals = [p["f3_neg_identity"] for p in pareto_front]

    fig = plt.figure(figsize=(9, 7))
    ax = fig.add_subplot(111, projection='3d')
    scatter = ax.scatter(f1_vals, f2_vals, f3_vals, c=f1_vals, cmap='viridis', s=70, edgecolor='k')
    ax.set_xlabel('F1: Pairwise Balance Deviation', fontsize=10)
    ax.set_ylabel('F2: Power Creep Penalty', fontsize=10)
    ax.set_zlabel('F3: -Faction Identity Index', fontsize=10)
    ax.set_title('NSGA-II Pareto Front: Balance vs. Power Creep vs. Identity\n(all axes: lower = better)',
                  fontsize=12, fontweight='bold')
    fig.colorbar(scatter, ax=ax, label='F1 Balance Deviation', shrink=0.6)

    os.makedirs("figures", exist_ok=True)
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Grafik '{out_path}' berhasil disimpan.")


def run_nsga2_power_balance(pop_size=24, generations=30, num_runs=80, validation_num_runs=500, seed=None):
    """f1=pairwise balance deviation, f2=power creep, f3=-faction identity
    index -- see module comment above and rules_spec.md section 14.2."""
    if seed is not None:
        random.seed(seed)

    print("=== Fase 7: NSGA-II (balance vs. power creep vs. identity) ===")

    population = [generate_random_chromosome() for _ in range(pop_size)]
    population[0] = SMART_START.copy()

    objs, _ = _evaluate_population_power_balance(population, num_runs)

    start_time = time.time()
    history = []

    for gen in range(generations):
        fronts = fast_non_dominated_sort(objs)
        ranks, crowding = {}, {}
        for rank_idx, front in enumerate(fronts):
            cd = crowding_distance(front, objs)
            for idx in front:
                ranks[idx] = rank_idx
                crowding[idx] = cd[idx]

        offspring = []
        while len(offspring) < pop_size:
            i1 = tournament_select(len(population), ranks, crowding)
            i2 = tournament_select(len(population), ranks, crowding)
            c1, c2 = crossover(population[i1], population[i2])
            offspring.append(mutate(c1))
            if len(offspring) < pop_size:
                offspring.append(mutate(c2))

        offspring_objs, _ = _evaluate_population_power_balance(offspring, num_runs)

        combined_pop = population + offspring
        combined_objs = objs + offspring_objs
        combined_fronts = fast_non_dominated_sort(combined_objs)

        new_population, new_objs = [], []
        for front in combined_fronts:
            if len(new_population) + len(front) <= pop_size:
                for idx in front:
                    new_population.append(combined_pop[idx])
                    new_objs.append(combined_objs[idx])
            else:
                remaining = pop_size - len(new_population)
                cd = crowding_distance(front, combined_objs)
                sorted_front = sorted(front, key=lambda idx: cd[idx], reverse=True)
                for idx in sorted_front[:remaining]:
                    new_population.append(combined_pop[idx])
                    new_objs.append(combined_objs[idx])
                break

        population, objs = new_population, new_objs

        front0 = fast_non_dominated_sort(objs)[0]
        best_f1 = min(objs[i][0] for i in front0)
        best_f2 = min(objs[i][1] for i in front0)
        best_f3 = min(objs[i][2] for i in front0)
        history.append({"gen": gen, "front0_size": len(front0), "best_f1": best_f1, "best_f2": best_f2, "best_f3": best_f3})
        print(f"  Gen {gen:<3} | Front-0: {len(front0):<3} | best F1={best_f1:8.2f} | best F2={best_f2:.4f} | best F3={best_f3:.3f}")

    elapsed = time.time() - start_time
    final_front0 = fast_non_dominated_sort(objs)[0]

    print(f"\nNSGA-II selesai in {elapsed:.1f}s. Front-0 size: {len(final_front0)}. "
          f"Re-validating at num_runs={validation_num_runs}...")

    pareto_front = []
    for idx in final_front0:
        chromo = population[idx]
        val_obj, val_diag = evaluate_chromosome_power_balance(chromo, num_runs=validation_num_runs)
        pareto_front.append({
            "params": chromo,
            "f1_balance": val_obj[0], "f2_power_creep": val_obj[1], "f3_neg_identity": val_obj[2],
            "rates": val_diag["rates"], "mean_pairwise_jsd": val_diag["mean_pairwise_jsd"],
        })

    validated_objs = [(p["f1_balance"], p["f2_power_creep"], p["f3_neg_identity"]) for p in pareto_front]
    validated_front0 = fast_non_dominated_sort(validated_objs)[0]
    dropped = len(pareto_front) - len(validated_front0)
    pareto_front = [pareto_front[i] for i in validated_front0]
    if dropped > 0:
        print(f"{dropped} solusi dibuang (didominasi setelah validasi n={validation_num_runs}) "
              f"-> front final: {len(pareto_front)} solusi.")

    return {"pareto_front": pareto_front, "history": history, "elapsed_seconds": elapsed,
            "pop_size": pop_size, "generations": generations, "num_runs": num_runs,
            "validation_num_runs": validation_num_runs}
