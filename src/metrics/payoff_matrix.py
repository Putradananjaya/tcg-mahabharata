"""Pairwise payoff (win-rate) matrix construction across factions/agents.

Deliberately simulator-agnostic: takes an injected `play_match_fn` rather
than importing src.simulator directly, so this module stays testable and
reusable if agent-vs-agent play (src/agents/) replaces auto-battler
faction-vs-faction play later. See experiments/exp03_balance_matrix.py for
the actual wiring against src.simulator.fitness.
"""

from dataclasses import dataclass, field

from src.metrics.winrate import WilsonInterval, wilson_ci


@dataclass(frozen=True)
class PayoffCell:
    row: str
    col: str
    wins: int
    n: int
    ci: WilsonInterval


@dataclass(frozen=True)
class PayoffMatrix:
    names: list
    cells: dict = field(repr=False)  # {(row, col): PayoffCell}

    def cell(self, row: str, col: str) -> PayoffCell:
        return self.cells[(row, col)]

    def win_rate(self, row: str, col: str) -> float:
        return self.cells[(row, col)].ci.p_hat

    def to_rows(self):
        """Row-major list of PayoffCell, in `names` order -- convenient for
        printing/plotting an n x n grid."""
        return [[self.cells[(r, c)] for c in self.names] for r in self.names]

    def mirror_cells(self):
        """The diagonal (self-play) cells -- sanity check: should be ~50%."""
        return [self.cells[(name, name)] for name in self.names]

    def max_mirror_deviation(self) -> float:
        """Largest |p_hat - 0.5| among mirror cells -- a single number to
        flag if the sanity check fails (e.g. a first-mover-advantage bug,
        see rules_spec.md section 1.2, would show up here as a mirror match
        that isn't ~50%)."""
        return max(abs(c.ci.p_hat - 0.5) for c in self.mirror_cells())


def build_payoff_matrix(names: list, play_match_fn, n: int, base_seed: int = 0, alpha: float = 0.05) -> PayoffMatrix:
    """Run every ordered pair (row, col) in `names` x `names` -- including
    mirror matches (row == col) -- for `n` games each, and return the full
    matrix with a Wilson CI per cell.

    play_match_fn(row_name, col_name, seed) -> 1 if `row_name` won, else 0.
    Called once per game with seed = base_seed + game_index, so results are
    reproducible; each cell uses an independent seed range
    (offset by a large stride) so cells don't share randomness with each
    other -- only src.metrics.winrate.paired_comparison deliberately shares
    seeds across two conditions, and only when that's the explicit intent.
    """
    if n <= 0:
        raise ValueError("n must be positive")
    if len(set(names)) != len(names):
        raise ValueError("names must be unique")

    seed_stride = n + 1  # gap between cells' seed ranges, avoids overlap
    cells = {}
    for row_idx, row in enumerate(names):
        for col_idx, col in enumerate(names):
            cell_base_seed = base_seed + (row_idx * len(names) + col_idx) * seed_stride
            wins = 0
            for i in range(n):
                wins += play_match_fn(row, col, cell_base_seed + i)
            ci = wilson_ci(wins, n, alpha=alpha)
            cells[(row, col)] = PayoffCell(row=row, col=col, wins=wins, n=n, ci=ci)

    return PayoffMatrix(names=list(names), cells=cells)
