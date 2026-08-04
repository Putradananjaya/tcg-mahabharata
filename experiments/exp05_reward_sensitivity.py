"""Fase 5: reward-weight sensitivity sweep + baseline-relative evaluation.

Review motivation (Fase 5 tugas): "bobot reward w1,w2,w3,w_KO tidak pernah
disebut" and "tactical accuracy 88.6%" has no ground truth. This script
addresses both:

1. Names the reward weights explicitly (src.agents.dqn_agent.RewardWeights)
   and sweeps two of them one-factor-at-a-time against the Fase 4-equivalent
   baseline (w2=w3=0):
     - w2_hp_potential: POTENTIAL-BASED shaping (Ng, Harada & Russell, ICML
       1999) -- their Theorem 1 says any coefficient on a term of the form
       F=gamma*Phi(s')-Phi(s) leaves the optimal policy unchanged. Swept as
       a *control*: if the balance conclusion (which faction beats which,
       under self-play) moves when w2 moves, something is wrong with either
       the theorem's preconditions here or the implementation.
     - w3_aggression_bias: NOT potential-based (depends on the action taken,
       not a state-potential difference) -- included as the contrasting
       case the same theorem says CAN change the optimal policy. Swept to
       see whether it actually does, empirically, in this game.
2. Replaces "tactical accuracy" with three things that have real ground
   truth: (a) win rate vs. two fixed baseline agents (RandomAgent,
   GreedyAgent) with Wilson 95% CIs, (b) Elo within the resulting agent
   population (src.metrics.elo, star topology through the two baselines --
   see below), (c) an explicit exploitability/best-response-gap note (not
   computed -- see module-level FEASIBILITY note).

FEASIBILITY note on exploitability: an exact best-response / exploitability
computation needs either a full game-tree solver (infeasible here -- the
fine-grained AgentGameEnv action space has a branching factor and horizon
that make exhaustive search intractable, and no LP/CFR solver is available
in this Python 3.9 venv, same scipy-less constraint noted in
nash_averaging.py) or an RL-trained best-responder, which would be
circular (using one RL agent's approximate best response to bound another
RL agent's exploitability is not a real bound). Not attempted; flagged as
future work requiring a deliberately state-abstracted, exactly-solvable
variant of the game.

Run: venv/bin/python experiments/exp05_reward_sensitivity.py
Artifacts: results/exp05_reward_sensitivity.json, figures/reward_sensitivity.png
"""
from __future__ import annotations

import json
import random as pyrandom
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt
import numpy as np

from src.agents.dqn_agent import RewardWeights, TabularQLearningAgent, train_tabular_agent
from src.agents.greedy_agent import GreedyAgent
from src.agents.random_agent import RandomAgent
from src.metrics.elo import elo_ratings
from src.metrics.winrate import required_n, wilson_ci
from src.simulator.agent_env import AgentGameEnv
from src.simulator.fitness import build_faction_decks

ROOT = Path(__file__).resolve().parent.parent
MAX_TURNS = 60
BASE_SEED = 20260801
PAIRS = [("SATWIKA", "TAMASIKA"), ("TAMASIKA", "RAJASIKA"), ("RAJASIKA", "SATWIKA")]
N_FAST = required_n(delta=0.05, alpha=0.05, power=0.8)  # 783, same standard as exp04
TRAIN_SCHEDULE = [750, 750, 1500]  # cumulative games, same total (3000) as exp04's dqn_100pct

SETTINGS = [
    ("baseline_w2_0_w3_0", RewardWeights()),                       # reproduces Fase 4 exactly
    ("w2_0.5", RewardWeights(w2_hp_potential=0.5)),
    ("w2_1.0", RewardWeights(w2_hp_potential=1.0)),
    ("w2_2.0", RewardWeights(w2_hp_potential=2.0)),
    ("w3_0.1", RewardWeights(w3_aggression_bias=0.1)),
    ("w3_0.5", RewardWeights(w3_aggression_bias=0.5)),
]


def deck_for(faction: str, params: dict) -> dict:
    satwika, rajasika, tamasika = build_faction_decks(params)
    return {"SATWIKA": satwika, "RAJASIKA": rajasika, "TAMASIKA": tamasika}[faction]


def train_variant(weights: RewardWeights, params: dict, seed_offset: int) -> TabularQLearningAgent:
    satwika = deck_for("SATWIKA", params)
    tamasika = deck_for("TAMASIKA", params)
    agent = TabularQLearningAgent(epsilon=0.2, alpha=0.1, gamma=0.9, rng=pyrandom.Random(BASE_SEED + seed_offset))
    games_done = 0
    for idx, cum_games in enumerate(TRAIN_SCHEDULE):
        train_tabular_agent(agent, satwika, tamasika, num_games=cum_games, max_turns=MAX_TURNS,
                             base_seed=BASE_SEED + seed_offset * 10**6 + games_done, weights=weights)
        games_done += cum_games
    agent.train_mode = False
    agent.epsilon = 0.0
    return agent


def self_play_cell(agent, deck_a, deck_b, n, seed_offset) -> dict:
    wins = 0
    for i in range(n):
        env = AgentGameEnv(deck_a, deck_b, "A", "B", max_turns=MAX_TURNS)
        obs = env.reset(seed=BASE_SEED + seed_offset + i)
        while not env.done:
            action = agent.act(obs)
            obs, done, winner = env.step(action)
        if env.winner_side == "A":
            wins += 1
    ci = wilson_ci(wins, n)
    return {"wins": wins, "n": n, "win_rate": ci.p_hat, "wilson_ci_95": {"lower": ci.lower, "upper": ci.upper}}


def vs_baseline_cell(agent, baseline_agent, deck_a, deck_b, n, seed_offset) -> dict:
    """agent controls side A (SATWIKA), baseline_agent controls side B (TAMASIKA).
    Returns per-cell result plus the raw (winner_is_agent: bool) list for Elo."""
    wins = 0
    outcomes = []
    for i in range(n):
        env = AgentGameEnv(deck_a, deck_b, "A", "B", max_turns=MAX_TURNS)
        obs = env.reset(seed=BASE_SEED + seed_offset + i)
        while not env.done:
            side = env.current_side
            action = agent.act(obs) if side == "A" else baseline_agent.act(obs)
            obs, done, winner = env.step(action)
        agent_won = env.winner_side == "A"
        wins += int(agent_won)
        outcomes.append(agent_won)
    ci = wilson_ci(wins, n)
    return {
        "wins": wins, "n": n, "win_rate": ci.p_hat,
        "wilson_ci_95": {"lower": ci.lower, "upper": ci.upper},
        "outcomes": outcomes,
    }


def main():
    ga_balanced_params = json.loads((ROOT / "data" / "ga_balanced_params.json").read_text())
    satwika = deck_for("SATWIKA", ga_balanced_params)
    tamasika = deck_for("TAMASIKA", ga_balanced_params)

    results = {}
    match_log = []  # (winner_name, loser_name) for elo_ratings

    for idx, (label, weights) in enumerate(SETTINGS):
        print(f"\n=== Setting: {label} (w1={weights.w1_step_cost}, w2={weights.w2_hp_potential}, "
              f"w3={weights.w3_aggression_bias}, w_ko={weights.w_ko}) ===")
        agent = train_variant(weights, ga_balanced_params, seed_offset=idx)
        agent.name = label

        self_play = {}
        for a_name, b_name in PAIRS:
            deck_a, deck_b = deck_for(a_name, ga_balanced_params), deck_for(b_name, ga_balanced_params)
            cell = self_play_cell(agent, deck_a, deck_b, N_FAST, seed_offset=idx * 10**6 + 1)
            self_play[f"{a_name}_vs_{b_name}"] = cell
            print(f"    [self-play] {a_name} vs {b_name}: {cell['win_rate']*100:.2f}% "
                  f"(n={N_FAST}, CI [{cell['wilson_ci_95']['lower']*100:.2f}%, {cell['wilson_ci_95']['upper']*100:.2f}%])")

        vs_random = vs_baseline_cell(agent, RandomAgent(), satwika, tamasika, N_FAST, seed_offset=idx * 10**6 + 2)
        print(f"    [vs RandomAgent] {vs_random['win_rate']*100:.2f}% (n={N_FAST}, CI "
              f"[{vs_random['wilson_ci_95']['lower']*100:.2f}%, {vs_random['wilson_ci_95']['upper']*100:.2f}%])")
        for won in vs_random["outcomes"]:
            match_log.append((label, "RandomAgent") if won else ("RandomAgent", label))

        vs_greedy = vs_baseline_cell(agent, GreedyAgent(), satwika, tamasika, N_FAST, seed_offset=idx * 10**6 + 3)
        print(f"    [vs GreedyAgent] {vs_greedy['win_rate']*100:.2f}% (n={N_FAST}, CI "
              f"[{vs_greedy['wilson_ci_95']['lower']*100:.2f}%, {vs_greedy['wilson_ci_95']['upper']*100:.2f}%])")
        for won in vs_greedy["outcomes"]:
            match_log.append((label, "GreedyAgent") if won else ("GreedyAgent", label))

        vs_random.pop("outcomes")
        vs_greedy.pop("outcomes")

        results[label] = {
            "weights": {"w1_step_cost": weights.w1_step_cost, "w2_hp_potential": weights.w2_hp_potential,
                        "w3_aggression_bias": weights.w3_aggression_bias, "w_ko": weights.w_ko},
            "n_per_cell": N_FAST,
            "self_play": self_play,
            "vs_random_agent": vs_random,
            "vs_greedy_agent": vs_greedy,
            "final_table_size": len(agent.q),
        }

    # Elo needs baselines to have played each other too, or they stay
    # anchored only through the DQN variants -- add a direct RandomAgent vs
    # GreedyAgent match set so the comparison graph isn't purely bipartite.
    random_agent, greedy_agent = RandomAgent(), GreedyAgent()
    rg_result = vs_baseline_cell(greedy_agent, random_agent, satwika, tamasika, N_FAST, seed_offset=99 * 10**6)
    for won in rg_result["outcomes"]:
        match_log.append(("GreedyAgent", "RandomAgent") if won else ("RandomAgent", "GreedyAgent"))

    ratings = elo_ratings(match_log)
    print("\n=== Elo ratings (population: 6 reward-weight variants + RandomAgent + GreedyAgent) ===")
    for name, rating in sorted(ratings.items(), key=lambda kv: -kv[1]):
        print(f"  {name:24} {rating:7.1f}")

    # --- does the balance conclusion (favored side of RAJASIKA_vs_SATWIKA) change? ---
    baseline_rs = results["baseline_w2_0_w3_0"]["self_play"]["RAJASIKA_vs_SATWIKA"]["win_rate"]
    baseline_favors_satwika = baseline_rs < 0.5
    direction_flips = {}
    for label, r in results.items():
        wr = r["self_play"]["RAJASIKA_vs_SATWIKA"]["win_rate"]
        favors_satwika = wr < 0.5
        direction_flips[label] = favors_satwika != baseline_favors_satwika
    print("\nRAJASIKA_vs_SATWIKA direction flip vs. baseline:")
    for label, flipped in direction_flips.items():
        wr = results[label]["self_play"]["RAJASIKA_vs_SATWIKA"]["win_rate"]
        print(f"  {label:24} win_rate={wr*100:5.1f}%  flipped={flipped}")

    artifact = {
        "params": "data/ga_balanced_params.json",
        "base_seed": BASE_SEED,
        "n_per_cell": N_FAST,
        "train_schedule_games": TRAIN_SCHEDULE,
        "pairs": [f"{a}_vs_{b}" for a, b in PAIRS],
        "settings": results,
        "elo_ratings": ratings,
        "elo_comparison_graph": "star topology: every variant played RandomAgent and GreedyAgent; "
                                 "RandomAgent and GreedyAgent also played each other directly. "
                                 "No full round-robin between variants (compute cost) -- see module docstring.",
        "rajasika_vs_satwika_direction_flip_vs_baseline": direction_flips,
    }
    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp05_reward_sensitivity.json").write_text(json.dumps(artifact, indent=2))

    # --- figure: RAJASIKA_vs_SATWIKA win rate per setting, w2 sweep vs w3 sweep ---
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.5), sharey=True)
    baseline_wr = results["baseline_w2_0_w3_0"]["self_play"]["RAJASIKA_vs_SATWIKA"]["win_rate"] * 100

    w2_labels = ["baseline_w2_0_w3_0", "w2_0.5", "w2_1.0", "w2_2.0"]
    w2_x = [0.0, 0.5, 1.0, 2.0]
    w2_y = [results[l]["self_play"]["RAJASIKA_vs_SATWIKA"]["win_rate"] * 100 for l in w2_labels]
    axes[0].plot(w2_x, w2_y, marker="o", color="#4C72B0")
    axes[0].axhline(50.0, color="gray", linestyle="--", linewidth=1)
    axes[0].set_title("w2 sweep (potential-based)\nshould NOT change optimal policy")
    axes[0].set_xlabel("w2_hp_potential")
    axes[0].set_ylabel("RAJASIKA_vs_SATWIKA win rate (%)")

    w3_labels = ["baseline_w2_0_w3_0", "w3_0.1", "w3_0.5"]
    w3_x = [0.0, 0.1, 0.5]
    w3_y = [results[l]["self_play"]["RAJASIKA_vs_SATWIKA"]["win_rate"] * 100 for l in w3_labels]
    axes[1].plot(w3_x, w3_y, marker="o", color="#C44E52")
    axes[1].axhline(50.0, color="gray", linestyle="--", linewidth=1)
    axes[1].set_title("w3 sweep (non-potential-based)\nmay change optimal policy")
    axes[1].set_xlabel("w3_aggression_bias")

    fig.suptitle("Does reward shaping change the balance conclusion? (RAJASIKA vs SATWIKA, self-play)")
    fig.text(0.5, -0.03,
              f"Each point: n={N_FAST} self-play games, params=ga_balanced_params.json, "
              f"{sum(TRAIN_SCHEDULE)}-game training per point. Baseline (w2=w3=0) reproduces "
              f"exp04's dqn_100pct config exactly.",
              ha="center", fontsize=7.5)
    fig.tight_layout()
    figures_dir = ROOT / "figures"
    figures_dir.mkdir(exist_ok=True)
    fig.savefig(figures_dir / "reward_sensitivity.png", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print("\nArtifact: results/exp05_reward_sensitivity.json")
    print("Figure:   figures/reward_sensitivity.png")


if __name__ == "__main__":
    main()
