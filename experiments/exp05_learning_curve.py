"""Fase 5: RL agent learning curve, >=10 seeds, variance band.

Trains TabularQLearningAgent (src.agents.dqn_agent -- the canonical RL
agent as of Fase 5, see rules_spec.md section 12) via self-play on the
SATWIKA vs TAMASIKA matchup, exactly as exp04_policy_dependence.py's
train_dqn_checkpoints did, but across NUM_SEEDS independent training runs
instead of one, evaluating win rate vs RandomAgent at each checkpoint of
each run. The headline figure is mean win rate +/- 95% CI *across seeds*
at each checkpoint -- this is the Aturan Main ">=10 seeds" standard for
run-to-run training variance (not the Wilson-CI-over-N_MATCH standard,
which governs win-rate precision *within* one seed's evaluation games; see
CLAIMS_LEDGER.md "Policy population standard" and "Win-rate reporting
standard" for why these are two different uncertainty sources, both
reported here rather than conflated).

This script is also the source of the real, measured numbers (final
Q-table size per seed, total env steps per seed, num_seeds) written into
results/dqn_hparams.json by experiments/exp05_hparams_report.py -- no
number in that hyperparameter table is invented independently of an actual
training run.

Run: venv/bin/python experiments/exp05_learning_curve.py
Artifacts: results/exp05_learning_curve.json, figures/rl_learning_curve.png
"""
from __future__ import annotations

import json
import random as pyrandom
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.agents.dqn_agent import RewardWeights, TabularQLearningAgent, train_tabular_agent
from src.agents.random_agent import RandomAgent
from src.metrics.winrate import wilson_ci
from src.simulator.agent_env import AgentGameEnv
from src.simulator.fitness import build_faction_decks

ROOT = Path(__file__).resolve().parent.parent
NUM_SEEDS = 10
CHECKPOINTS = [0, 500, 1000, 1500, 2000, 2500, 3000]  # cumulative games trained
N_EVAL = 200  # per seed per checkpoint -- curve-tracking precision, not a
              # final win-rate claim (see module docstring); each cell still
              # carries its own Wilson CI in the raw artifact.
MAX_TURNS = 60
BASE_SEED = 20260801
WEIGHTS = RewardWeights()  # Fase 4-equivalent: w1=-0.01, w2=w3=0, w_ko=1.0


def deck_for(faction: str, params: dict) -> dict:
    satwika, rajasika, tamasika = build_faction_decks(params)
    return {"SATWIKA": satwika, "RAJASIKA": rajasika, "TAMASIKA": tamasika}[faction]


def eval_vs_random(agent, deck_a, deck_b, n, seed_offset) -> dict:
    """agent controls side A (SATWIKA), RandomAgent controls side B (TAMASIKA)."""
    random_agent = RandomAgent()
    wins = 0
    for i in range(n):
        env = AgentGameEnv(deck_a, deck_b, "A", "B", max_turns=MAX_TURNS)
        obs = env.reset(seed=BASE_SEED + seed_offset + i)
        while not env.done:
            side = env.current_side
            action = agent.act(obs) if side == "A" else random_agent.act(obs)
            obs, done, winner = env.step(action)
        if env.winner_side == "A":
            wins += 1
    ci = wilson_ci(wins, n)
    return {"wins": wins, "n": n, "win_rate": ci.p_hat, "wilson_ci_95": {"lower": ci.lower, "upper": ci.upper}}


def main():
    ga_balanced_params = json.loads((ROOT / "data" / "ga_balanced_params.json").read_text())
    satwika = deck_for("SATWIKA", ga_balanced_params)
    tamasika = deck_for("TAMASIKA", ga_balanced_params)

    per_seed = []  # list of {seed, checkpoints: [{games, eval, table_size, total_steps_so_far}]}

    for seed in range(NUM_SEEDS):
        print(f"=== Seed {seed} ===")
        agent = TabularQLearningAgent(epsilon=0.2, alpha=0.1, gamma=0.9, rng=pyrandom.Random(BASE_SEED + seed))
        cp_records = []
        total_steps_so_far = 0
        games_done = 0

        for cp in CHECKPOINTS:
            games_needed = cp - games_done
            if games_needed > 0:
                train_seed = BASE_SEED + seed * 10**6 + games_done
                steps = train_tabular_agent(
                    agent, satwika, tamasika, num_games=games_needed, max_turns=MAX_TURNS,
                    base_seed=train_seed, weights=WEIGHTS,
                )
                total_steps_so_far += steps
                games_done = cp

            snapshot = agent.snapshot(name=f"seed{seed}_games{cp}")
            eval_seed_offset = 5 * 10**6 + seed * 10**5 + cp
            result = eval_vs_random(snapshot, satwika, tamasika, N_EVAL, eval_seed_offset)
            cp_records.append({
                "games_trained": cp, "total_steps_so_far": total_steps_so_far,
                "table_size": len(agent.q), "eval_vs_random": result,
            })
            print(f"    games={cp:5d}  win_rate_vs_random={result['win_rate']*100:5.1f}%  "
                  f"table_size={len(agent.q)}")

        per_seed.append({"seed": seed, "checkpoints": cp_records})

    # --- cross-seed mean +/- 95% CI band at each checkpoint ---
    band = []
    for idx, cp in enumerate(CHECKPOINTS):
        rates = np.array([per_seed[s]["checkpoints"][idx]["eval_vs_random"]["win_rate"] for s in range(NUM_SEEDS)])
        mean = float(rates.mean())
        sem = float(rates.std(ddof=1) / np.sqrt(NUM_SEEDS))
        ci95 = 1.96 * sem
        band.append({
            "games_trained": cp, "mean_win_rate": mean,
            "ci95_lower": max(0.0, mean - ci95), "ci95_upper": min(1.0, mean + ci95),
            "per_seed_win_rates": rates.tolist(),
        })
        print(f"checkpoint={cp:5d}  mean={mean*100:5.1f}%  95% CI (across {NUM_SEEDS} seeds) "
              f"[{max(0.0,mean-ci95)*100:5.1f}%, {min(1.0,mean+ci95)*100:5.1f}%]")

    final_table_sizes = [per_seed[s]["checkpoints"][-1]["table_size"] for s in range(NUM_SEEDS)]
    final_total_steps = [per_seed[s]["checkpoints"][-1]["total_steps_so_far"] for s in range(NUM_SEEDS)]

    artifact = {
        "agent": "TabularQLearningAgent",
        "num_seeds": NUM_SEEDS,
        "checkpoints_games": CHECKPOINTS,
        "n_eval_per_checkpoint": N_EVAL,
        "train_matchup": ["SATWIKA", "TAMASIKA"],
        "eval_opponent": "RandomAgent",
        "params": "data/ga_balanced_params.json",
        "reward_weights": {
            "w1_step_cost": WEIGHTS.w1_step_cost, "w2_hp_potential": WEIGHTS.w2_hp_potential,
            "w3_aggression_bias": WEIGHTS.w3_aggression_bias, "w_ko": WEIGHTS.w_ko,
        },
        "hyperparameters": {"epsilon": 0.2, "epsilon_schedule": "constant (no decay)", "alpha": 0.1, "gamma": 0.9},
        "per_seed": per_seed,
        "band_across_seeds": band,
        "final_table_size": {"min": min(final_table_sizes), "max": max(final_table_sizes),
                              "mean": sum(final_table_sizes) / len(final_table_sizes), "per_seed": final_table_sizes},
        "final_total_env_steps": {"min": min(final_total_steps), "max": max(final_total_steps),
                                   "mean": sum(final_total_steps) / len(final_total_steps), "per_seed": final_total_steps},
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp05_learning_curve.json").write_text(json.dumps(artifact, indent=2))

    # --- figure ---
    games = [b["games_trained"] for b in band]
    means = [b["mean_win_rate"] * 100 for b in band]
    lowers = [b["ci95_lower"] * 100 for b in band]
    uppers = [b["ci95_upper"] * 100 for b in band]

    fig, ax = plt.subplots(figsize=(7, 5))
    ax.fill_between(games, lowers, uppers, color="#4C72B0", alpha=0.25, label=f"95% CI across {NUM_SEEDS} seeds")
    ax.plot(games, means, color="#4C72B0", marker="o", linewidth=2, label="Mean win rate")
    ax.axhline(50.0, color="gray", linestyle="--", linewidth=1, label="50% (RandomAgent parity)")
    ax.set_xlabel("Self-play training games (SATWIKA vs TAMASIKA)")
    ax.set_ylabel("Win rate vs RandomAgent (%)")
    ax.set_title(f"TabularQLearningAgent learning curve (n={NUM_SEEDS} seeds, {N_EVAL} eval games/checkpoint/seed)")
    ax.legend(loc="lower right", fontsize=8)
    ax.set_ylim(0, 100)
    fig.text(0.5, -0.02,
              f"Band = mean +/- 1.96*SEM across {NUM_SEEDS} independent training seeds (Aturan Main >=10-seed "
              f"standard); each point's own within-seed Wilson 95% CI (n={N_EVAL}) is in "
              f"results/exp05_learning_curve.json, not shown here to avoid conflating the two uncertainty sources.",
              ha="center", fontsize=7.5, wrap=True)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "rl_learning_curve.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp05_learning_curve.json")
    print("Figure:   figures/rl_learning_curve.png")


if __name__ == "__main__":
    main()
