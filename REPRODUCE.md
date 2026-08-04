# Reproducing this research suite

Status: scaffold stage. There is currently no single reproduction command
because no experiment runner under `experiments/` exists yet — only configs
and stub modules (see CLAIMS_LEDGER.md, all rows empty). This file describes
the intended workflow and will gain a real top-level command once the first
runner (`experiments/exp01_sample_size.py`) lands.

## Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt   # TODO: does not exist yet, dependencies are currently unpinned
```

Known runtime dependencies observed in the existing code: `fastapi`, `numpy`,
`matplotlib`. This list is not yet verified complete or pinned — do not treat
it as authoritative until `requirements.txt` exists.

## Intended reproduction command (once runners exist)

```bash
python -m experiments.run_all --config configs/base.yaml
```

This should, for every experiment listed in `CLAIMS_LEDGER.md`:
1. Load its config from `configs/`.
2. Run it across `determinism.num_seeds` seeds (>=10, see `src/simulator/determinism.py`).
3. Write a single JSON/CSV artifact to `results/`.
4. Regenerate any figure in `figures/` that depends on that artifact.

## Pre-existing legacy scripts

`scripts/run_balancing.py`, `scripts/run_nsga2_balancing.py`,
`scripts/run_rl_self_play.py`, `scripts/run_ml_experiments.py`, and
`scripts/run_academic_plots.py` predate this reorg. They still work
(imports were updated to the new `src/` layout) but are not yet wired to
`configs/`, do not write to `results/`, and are not cited in
CLAIMS_LEDGER.md — treat their output as exploratory, not paper evidence.
