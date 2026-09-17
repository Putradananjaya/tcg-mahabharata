"""Fase E9 diagnostic (not a paper claim -- see CLAIMS_LEDGER.md
"Diagnostics"): measures how often Duryodana's "Angkara 100 Kurawa" attack's
discard-pile-scaling bonus (`scaled_damage_per_discard_tamasika`,
`src/domain/models.py` line ~214-216) is actually active, and what fraction
of that attack's total dealt damage it contributes -- the empirical basis
for excluding this term from L4's static feasibility check
(`src/constraints/lore.py`): it depends on `opponent.discard_pile`, a
simulation-time quantity, not theta alone.

Method: monkeypatch `Player.attack` to record base/bonus damage split every
time "Angkara 100 Kurawa" is the chosen attack, across both matchups where
Tamasika (Duryodana's faction) actually plays (SATWIKA_vs_TAMASIKA,
TAMASIKA_vs_RAJASIKA), using `data/ga_balanced_params.json` (this repo's
reference balanced parameter set) at N_MATCH=20000/matchup, seed=20260801.

Run: venv/bin/python experiments/exp09_angkara_scaling_diagnostic.py
Artifact: results/exp09_angkara_scaling_diagnostic.json
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.domain.models import Player
from src.simulator.determinism import seed_everything
from src.simulator.fitness import build_faction_decks, run_simulation_multi

ROOT = Path(__file__).resolve().parent.parent
N_MATCH = 20000
BASE_SEED = 20260801
TARGET_ATTACK = "Angkara 100 Kurawa"

_stats = {"n_uses": 0, "n_uses_bonus_active": 0, "total_base_damage": 0, "total_bonus_damage": 0}

_original_attack = Player.attack


def _instrumented_attack(self, opponent):
    # Does NOT re-derive which attack Player.attack() will choose (that
    # selection logic lives in models.py and shouldn't be duplicated here,
    # error-pronely, in a diagnostic script) -- instead records
    # opponent.discard_pile's length right before delegating to the real
    # attack() (nothing else can change it in between), then checks
    # self.attack_log afterward to see what was actually chosen.
    discard_before = len(opponent.discard_pile)
    log_len_before = len(self.attack_log)

    result = _original_attack(self, opponent)

    if len(self.attack_log) > log_len_before and self.attack_log[-1] == TARGET_ATTACK:
        attacks = self.active_character.raw_data.get("attacks", []) if self.active_character else []
        # active_character may already be a fresh bench promotion after a
        # KO on this same call in a real game, but TARGET_ATTACK only ever
        # belongs to Duryodana, and a KO'd Duryodana can't have just
        # attacked -- so raw_data here is always still Duryodana's.
        attack_def = next((a for a in attacks if a.get("name") == TARGET_ATTACK), None)
        if attack_def is not None:
            base_damage = attack_def.get("base_damage", 0)
            scale_value = attack_def.get("scale_value", 0)
            bonus_damage = discard_before * scale_value
            _stats["n_uses"] += 1
            _stats["total_base_damage"] += base_damage
            _stats["total_bonus_damage"] += bonus_damage
            if bonus_damage > 0:
                _stats["n_uses_bonus_active"] += 1

    return result


def main():
    ga_balanced = json.loads((ROOT / "data" / "ga_balanced_params.json").read_text())
    satwika, rajasika, tamasika = build_faction_decks(ga_balanced)

    matchups = [
        ("SATWIKA_vs_TAMASIKA", satwika, tamasika, "SATWIKA", "TAMASIKA"),
        ("TAMASIKA_vs_RAJASIKA", tamasika, rajasika, "TAMASIKA", "RAJASIKA"),
    ]

    Player.attack = _instrumented_attack
    try:
        original_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            for label, deck1, deck2, name1, name2 in matchups:
                for i in range(N_MATCH):
                    seed_everything(BASE_SEED + i)
                    run_simulation_multi(deck1, deck2, name1, name2)
        finally:
            sys.stdout = original_stdout
    finally:
        Player.attack = _original_attack

    n_uses = _stats["n_uses"]
    pct_bonus_active = (_stats["n_uses_bonus_active"] / n_uses * 100) if n_uses else 0.0
    total_damage = _stats["total_base_damage"] + _stats["total_bonus_damage"]
    pct_damage_from_bonus = (_stats["total_bonus_damage"] / total_damage * 100) if total_damage else 0.0

    artifact = {
        "params": "data/ga_balanced_params.json",
        "matchups": [m[0] for m in matchups],
        "n_match_per_matchup": N_MATCH,
        "base_seed": BASE_SEED,
        "target_attack": TARGET_ATTACK,
        "n_uses_total": n_uses,
        "n_uses_with_bonus_active": _stats["n_uses_bonus_active"],
        "pct_uses_with_bonus_active": pct_bonus_active,
        "total_base_damage": _stats["total_base_damage"],
        "total_bonus_damage": _stats["total_bonus_damage"],
        "pct_total_damage_from_discard_scaling_bonus": pct_damage_from_bonus,
    }

    results_dir = ROOT / "results"
    results_dir.mkdir(exist_ok=True)
    (results_dir / "exp09_angkara_scaling_diagnostic.json").write_text(json.dumps(artifact, indent=2))

    print(f"'{TARGET_ATTACK}' used {n_uses} times across {len(matchups)} matchups x {N_MATCH} games.")
    print(f"Discard-scaling bonus active (>0) in {_stats['n_uses_bonus_active']}/{n_uses} uses "
          f"({pct_bonus_active:.2f}%).")
    print(f"Bonus damage is {pct_damage_from_bonus:.2f}% of this attack's total dealt damage "
          f"({_stats['total_bonus_damage']} of {total_damage}).")
    print("\nArtifact: results/exp09_angkara_scaling_diagnostic.json")


if __name__ == "__main__":
    main()
