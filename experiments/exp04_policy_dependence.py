"""Fase 4: is balance policy-dependent?

Phase 3 (exp03_balance_matrix.py) measured the payoff matrix under
src.domain.models.Player's automatic attack-selection logic -- one fixed,
implicit "policy" (always the highest-damage affordable attack, panic
fallback otherwise). That is circular: the parameters in
data/ga_balanced_params.json were optimized against exactly that one
policy's outcomes. This experiment asks whether the near-50% parity found
in Phase 3 survives when the actual decision-maker varies, using
src.simulator.agent_env.AgentGameEnv (built this phase specifically to make
attack choice and switching real, externally-controlled decisions -- see
rules_spec.md section 4.1 and src/agents/base.py).

Population of policies X (9 agents):
  RandomAgent, GreedyAgent, ScriptedAggro (AggroAgent), ScriptedControl
  (ControlAgent), MCTSAgent(budget=100), MCTSAgent(budget=2000),
  TabularQLearningAgent checkpointed at 25% / 50% / 100% of a 3000-game
  self-play training run.

For each agent, both sides of every matchup are controlled by THAT SAME
agent (self-play) -- this measures "does parity hold when both players play
according to policy X", directly extending Phase 3's single-policy result.

Compute budget note: MCTS is expensive (UCT with real env clones -- see
mcts_agent.py's compute note). N games/cell is calibrated per agent type,
NOT uniform, and is reported honestly per agent in the artifact -- fast
agents get src.metrics.winrate.required_n(delta=0.05)-grade precision (~800
games/cell); MCTS gets far fewer (still real games, just few of them, with
correspondingly wide Wilson CIs). Never compare a wide-CI MCTS-2000 cell to
a narrow-CI RandomAgent cell as if they were equally precise -- the CIs are
exactly why that's safe to say plainly instead of silently.

Run: venv/bin/python experiments/exp04_policy_dependence.py
Artifacts: results/exp04_policy_dependence.json, figures/policy_dependence_heatmap.png
"""
import io
import json
import random as pyrandom
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.agents.dqn_agent import TabularQLearningAgent, train_tabular_agent
from src.agents.greedy_agent import GreedyAgent
from src.agents.mcts_agent import MCTSAgent
from src.agents.random_agent import RandomAgent
from src.agents.scripted_agents import AggroAgent, ControlAgent
from src.metrics.winrate import required_n, wilson_ci
from src.simulator.agent_env import AgentGameEnv
from src.simulator.fitness import build_faction_decks

ROOT = Path(__file__).resolve().parent.parent
MAX_TURNS = 60
BASE_SEED = 20260801

PAIRS = [("SATWIKA", "TAMASIKA"), ("TAMASIKA", "RAJASIKA"), ("RAJASIKA", "SATWIKA")]

# n games/cell per agent -- see module docstring. Fast agents (dict/rule
# lookups) get required_n(delta=0.05)-grade precision; MCTS gets far fewer,
# calibrated against real per-decision timing (see rules_spec.md section 10
# for the measured costs this was based on: MCTS-100 ~7.9s/game,
# MCTS-2000 ~162s/game).
N_FAST = required_n(delta=0.05, alpha=0.05, power=0.8)  # 783, see exp01_sample_size.json
N_MCTS_100 = 15
N_MCTS_2000 = 3


def deck_for(faction: str, params: dict) -> dict:
    satwika, rajasika, tamasika = build_faction_decks(params)
    return {"SATWIKA": satwika, "RAJASIKA": rajasika, "TAMASIKA": tamasika}[faction]


def play_one(agent, deck_a, deck_b, seed) -> str:
    """Self-play: `agent` controls both sides. Returns winner side 'A'/'B'."""
    env = AgentGameEnv(deck_a, deck_b, "A", "B", max_turns=MAX_TURNS)
    obs = env.reset(seed=seed)
    use_env_api = hasattr(agent, "act_with_env")
    while not env.done:
        action = agent.act_with_env(env) if use_env_api else agent.act(obs)
        obs, done, winner = env.step(action)
    return env.winner_side


def train_dqn_checkpoints(params: dict) -> dict:
    """Train one TabularQLearningAgent via self-play (SATWIKA vs TAMASIKA
    decks, arbitrary choice of training matchup -- the agent generalizes via
    its abstracted feature vector, not faction-specific memorization) and
    snapshot it at 25/50/100% of training."""
    satwika = deck_for("SATWIKA", params)
    tamasika = deck_for("TAMASIKA", params)
    agent = TabularQLearningAgent(epsilon=0.2, alpha=0.1, gamma=0.9, rng=pyrandom.Random(BASE_SEED))

    checkpoints = {}
    schedule = [(0.25, 750), (0.5, 750), (1.0, 1500)]  # cumulative fractions, games since last checkpoint
    for idx, (frac, n_games) in enumerate(schedule):
        train_tabular_agent(agent, satwika, tamasika, num_games=n_games, max_turns=MAX_TURNS, base_seed=BASE_SEED + idx * 10**5)
        checkpoints[frac] = agent.snapshot(name=f"dqn_{int(frac * 100)}pct")
    return checkpoints


def evaluate_agent(agent, params: dict, n: int, seed_offset: int) -> dict:
    cells = {}
    for a_name, b_name in PAIRS:
        deck_a, deck_b = deck_for(a_name, params), deck_for(b_name, params)
        wins = 0
        for i in range(n):
            winner = play_one(agent, deck_a, deck_b, seed=BASE_SEED + seed_offset + i)
            if winner == "A":
                wins += 1
        ci = wilson_ci(wins, n)
        cells[f"{a_name}_vs_{b_name}"] = {
            "wins": wins, "n": n, "win_rate": ci.p_hat,
            "wilson_ci_95": {"lower": ci.lower, "upper": ci.upper},
        }
        print(f"    {a_name} vs {b_name}: {ci}")
    return cells


def main():
    ga_balanced_params = json.loads((ROOT / "data" / "ga_balanced_params.json").read_text())

    print("=== Training TabularQLearningAgent, checkpointing at 25/50/100% ===")
    dqn_checkpoints = train_dqn_checkpoints(ga_balanced_params)

    agents = [
        ("random", RandomAgent(), N_FAST),
        ("greedy", GreedyAgent(), N_FAST),
        ("scripted_aggro", AggroAgent(), N_FAST),
        ("scripted_control", ControlAgent(), N_FAST),
        ("dqn_25pct", dqn_checkpoints[0.25], N_FAST),
        ("dqn_50pct", dqn_checkpoints[0.5], N_FAST),
        ("dqn_100pct", dqn_checkpoints[1.0], N_FAST),
        ("mcts_budget100", MCTSAgent(budget=100, rollout_depth=10, seed=1), N_MCTS_100),
        ("mcts_budget2000", MCTSAgent(budget=2000, rollout_depth=10, seed=1), N_MCTS_2000),
    ]

    results = {}
    for idx, (label, agent, n) in enumerate(agents):
        print(f"\n=== Agent: {label} (n={n} games/cell) ===")
        cells = evaluate_agent(agent, ga_balanced_params, n, seed_offset=idx * 10**6)
        results[label] = {"n": n, "cells": cells}

    # --- Parity range across the population ---
    deviations = []
    for label, r in results.items():
        for cell in r["cells"].values():
            deviations.append(abs(cell["win_rate"] - 0.5))
    parity_range = {"min_abs_deviation_pp": min(deviations) * 100, "max_abs_deviation_pp": max(deviations) * 100}
    print(f"\nParity deviation from 50% across all agents x cells: "
          f"min={parity_range['min_abs_deviation_pp']:.2f}pp, max={parity_range['max_abs_deviation_pp']:.2f}pp")

    per_agent_max_dev = {
        label: max(abs(c["win_rate"] - 0.5) for c in r["cells"].values()) * 100
        for label, r in results.items()
    }
    print("Per-agent max |deviation from 50%|:")
    for label, dev in sorted(per_agent_max_dev.items(), key=lambda kv: -kv[1]):
        print(f"  {label:20} {dev:5.2f}pp")

    artifact = {
        "params": "data/ga_balanced_params.json",
        "base_seed": BASE_SEED,
        "max_turns": MAX_TURNS,
        "pairs": [f"{a}_vs_{b}" for a, b in PAIRS],
        "agents": results,
        "parity_range_pp": parity_range,
        "per_agent_max_deviation_pp": per_agent_max_dev,
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp04_policy_dependence.json").write_text(json.dumps(artifact, indent=2))

    # --- Heatmap: rows=agents, columns=faction pairs ---
    agent_labels = [a[0] for a in agents]
    pair_labels = [f"{a}\nvs {b}" for a, b in PAIRS]
    grid = np.array([
        [results[label]["cells"][f"{a}_vs_{b}"]["win_rate"] for a, b in PAIRS]
        for label in agent_labels
    ])

    fig, ax = plt.subplots(figsize=(7, 8))
    im = ax.imshow(grid, cmap="RdBu_r", vmin=0.0, vmax=1.0, aspect="auto")
    ax.set_xticks(range(len(pair_labels)))
    ax.set_xticklabels(pair_labels, fontsize=9)
    ax.set_yticks(range(len(agent_labels)))
    ax.set_yticklabels([f"{label} (n={n})" for label, _, n in agents], fontsize=9)
    ax.set_xlabel("Faction pair (row-listed faction's win rate)")

    max_range = parity_range["max_abs_deviation_pp"]
    title = "Balance is policy-dependent" if max_range >= 10.0 else "Balance holds across a population of policies"
    ax.set_title(f"{title}\nWin rate by agent x faction pair, params=ga_balanced_params.json")

    for i in range(len(agent_labels)):
        for j in range(len(pair_labels)):
            wr = grid[i, j]
            text_color = "white" if abs(wr - 0.5) > 0.25 else "black"
            ax.text(j, i, f"{wr*100:.1f}%", ha="center", va="center", color=text_color, fontsize=9)

    cbar = fig.colorbar(im, ax=ax, shrink=0.85)
    cbar.set_label("Row-faction win rate")
    caption = (
        f"Self-play per agent (both sides = same policy), params=ga_balanced_params.json. "
        f"n/cell varies by agent (shown per row) -- see results/exp04_policy_dependence.json for exact Wilson 95% CIs. "
        f"Deviation from 50% across the whole population: {parity_range['min_abs_deviation_pp']:.1f}-{parity_range['max_abs_deviation_pp']:.1f}pp."
    )
    fig.text(0.5, -0.03, caption, ha="center", fontsize=7.5, wrap=True)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "policy_dependence_heatmap.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp04_policy_dependence.json")
    print("Figure:   figures/policy_dependence_heatmap.png")


if __name__ == "__main__":
    main()
