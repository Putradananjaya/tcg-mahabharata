# STATUS REPORT (read-only audit)

Dibuat: 2026-08-12. Laporan ini murni observasional — tidak ada file yang diubah, dibuat, atau dihapus selain file ini sendiri (`docs/STATUS_REPORT.md`, termasuk direktori `docs/` yang harus dibuat karena belum ada).

## 0. Prasyarat yang diminta: CLAUDE.md dan docs/IMPLEMENTATION_PLAN.md

**TIDAK DITEMUKAN.** Baik `CLAUDE.md` maupun `docs/IMPLEMENTATION_PLAN.md` tidak ada di mana pun dalam repo ini — sudah dicari di direktori root, di seluruh tree (`Glob **/CLAUDE.md`, `Glob **/IMPLEMENTATION_PLAN.md`), dan direktori `docs/` itu sendiri tidak ada sebelum laporan ini dibuat. Catatan tambahan: working directory yang diberikan (`c:\Users\adisu\Documents\programs\tcg-mahabharata`) hanya berisi satu subfolder `tcg-mahabharata\` yang merupakan root repo git yang sebenarnya (berisi `.git/`, `src/`, dll) — laporan ini mengacu ke root tersebut.

Konsekuensi: Bagian 1 di bawah **tidak dapat** menandai "disebut di IMPLEMENTATION_PLAN tapi belum ada" karena tidak ada file rujukan untuk dibandingkan. Bagian 1 hanya melaporkan realitas repo apa adanya.

---

## 1. Realitas repo

Pohon `src/`, `experiments/`, `results/`, `configs/`, `data/`, `tests/` (kedalaman 2, dengan ukuran file dalam bytes). Semua item di bawah ADA (diverifikasi langsung via listing filesystem).

```
src/
├── agents/                              (dir)
│   ├── base.py                          3355
│   ├── dqn_agent.py                     19492
│   ├── greedy_agent.py                  929
│   ├── mcts_agent.py                    5555
│   ├── random_agent.py                  242
│   ├── scripted_agents.py               3031
│   └── __init__.py                      0
├── agents_llm/                          (dir)
│   ├── card_designer.py                 2830
│   └── __init__.py                      0
├── api/                                 (dir)
│   └── server.py                        2807
├── domain/                              (dir)
│   ├── card_repository.py               3247
│   ├── models.py                        9008
│   └── __init__.py                      0
├── infrastructure/                      (dir)
│   ├── analysis/                        (dir, 1 file: academic_tests.py, 7262)
│   └── ml/                              (dir, 1 file: decision_tree_classifier.py, 3638)
├── meta_balancer/                       (dir)
│   ├── anomaly.py                       2225
│   └── __init__.py                      0
├── metrics/                             (dir)
│   ├── balance_objective.py             4686
│   ├── diversity.py                     5022
│   ├── elo.py                           3926
│   ├── nash_averaging.py                6198
│   ├── nonparametric.py                 3789
│   ├── payoff_matrix.py                 3278
│   ├── power_creep.py                   3889
│   ├── restricted_play.py               2360
│   ├── winrate.py                       6984
│   └── __init__.py                      0
├── optim/                               (dir)
│   ├── baselines.py                     9821
│   ├── ga.py                            5977
│   ├── hybrid.py                        5666
│   ├── nsga2.py                         14724
│   ├── objective.py                     3087
│   ├── pso.py                           6947
│   └── __init__.py                      0
├── sensitivity/                         (dir)
│   ├── morris.py                        4281
│   ├── sobol.py                         4569
│   └── __init__.py                      0
├── simulator/                           (dir)
│   ├── agent_env.py                     10134
│   ├── determinism.py                   1092
│   ├── engine.py                        2661
│   ├── fitness.py                       15640
│   ├── rules_spec.md                    92133
│   └── __init__.py                      0
└── surrogate/                           (dir)
    ├── baselines.py                     7462
    ├── ensemble.py                      3071
    ├── mlp.py                           6883
    ├── model_management.py              12799
    └── __init__.py                      0

experiments/
├── advanced_ml_ensemble.py              10034
├── advanced_visualize.py                7893
├── exp00_threshold_nonlinearity.py      5567
├── exp01_sample_size.py                 8073
├── exp03_balance_matrix.py              12577
├── exp04_policy_dependence.py           10199
├── exp05_learning_curve.py              9005
├── exp05_reward_sensitivity.py          13232
├── exp06_surrogate_assisted_ea.py       7468
├── exp06_surrogate_validation.py        21538
├── exp07_nsga2_power_balance.py         3457
├── exp07_optimizer_ablation.py          9524
├── exp08_cost_accounting.py             14219
├── exp08_dimension_scaling.py           9940
├── exp09_equilibrium_robustness.py      11520
├── exp09_karna_hp_ci.py                 9071
├── exp09_sensitivity_indices.py         7447
├── genetic_balance.py                   14175
├── main.py                              3249
├── predictive_combat.py                 6512
├── stress_test.py                       2385
├── visualize.py                         1796
└── worst_case_analysis.py               5013

results/
├── .gitkeep                             0
├── dqn_hparams.json                     5318
├── exp00_threshold_nonlinearity.json    6470
├── exp01_sample_size.json               2108
├── exp03_balance_matrix.json            8916
├── exp04_policy_dependence.json         8243
├── exp05_learning_curve.json            31204
├── exp05_reward_sensitivity.json        10184
├── exp06_surrogate_assisted_ea.json     26424
├── exp06_surrogate_validation.json      5664
├── exp07_nsga2_power_balance.json       22888
├── exp07_optimizer_ablation.json        187858
├── exp08_cost_accounting.json           7025
├── exp08_dimension_scaling.json         1282
├── exp09_equilibrium_robustness.json    25073
├── exp09_karna_hp_ci.json               9900
└── exp09_sensitivity_indices.json       13902
    (TIDAK ADA exp02_*.json meskipun configs/exp02_surrogate_validation.yaml ada — lihat bagian 5)

configs/
├── base.yaml                            1088
├── exp00_threshold_nonlinearity.yaml    607
├── exp01_sample_size.yaml               1401
├── exp02_surrogate_validation.yaml      1245
├── exp03_balance_matrix.yaml            1615
├── exp04_policy_dependence.yaml         2482
├── exp05_learning_curve.yaml            1296
├── exp05_reward_sensitivity.yaml        2100
├── exp06_surrogate_assisted_ea.yaml     1720
├── exp06_surrogate_validation.yaml      2182
├── exp07_nsga2_power_balance.yaml       1203
├── exp07_optimizer_ablation.yaml        2094
├── exp08_cost_accounting.yaml           1554
├── exp08_dimension_scaling.yaml         1184
├── exp09_equilibrium_robustness.yaml    1119
├── exp09_karna_hp_ci.yaml               928
└── exp09_sensitivity_indices.yaml       844

data/
├── ga_balanced_params.json              795
├── hasil_riset.csv                      1685
├── hasil_turnamen.csv                   373410
├── nsga2_pareto_front.json              7511
├── rajasika.json                        1150
├── satwika.json                         1503
└── tamasika.json                        1543

tests/
└── test_imports.py                      1588
    (hanya 1 file test di seluruh repo)
```

Catatan penomoran: tidak ada `exp02_*.py` di `experiments/` maupun `exp02_*.json` di `results/`, tetapi `configs/exp02_surrogate_validation.yaml` ADA — penomoran eksperimen melompat dari exp01 ke exp03 di kode/hasil sementara config exp02 berdiri sendiri tanpa runner/hasil yang cocok. Juga tidak ada `exp02_*` di manapun lain yang ditemukan pencarian.

---

## 2. Ruang parameter — SALIN VERBATIM

### BOUNDS (dari `src/simulator/fitness.py`, baris 8-36)

```python
BOUNDS = {
    "stw_yudhistira_hp": (90, 150),
    "stw_yudhistira_dmg": (20, 45),
    "stw_yudhistira_dr": (10, 30),
    "stw_yudhistira_heal": (15, 35),
    "stw_yudhistira_cost_satwika": (1, 2),
    "stw_yudhistira_cost_univ": (0, 1),
    "stw_arjuna_hp": (80, 125),
    "stw_arjuna_pasupati_dmg": (40, 65),
    "stw_arjuna_pasupati_cost": (2, 3),
    
    "rjs_balarama_hp": (60, 95),
    "rjs_balarama_dmg": (25, 45),
    "rjs_balarama_cost": (1, 2),
    "rjs_karna_hp": (70, 110),
    "rjs_karna_dmg": (45, 65),
    "rjs_karna_recoil": (5, 20),
    "rjs_karna_cost": (1, 2),
    
    "tms_sengkuni_hp": (75, 105),
    "tms_sengkuni_dmg": (20, 40),
    "tms_sengkuni_mill": (1, 3),
    "tms_sengkuni_cost_tamasika": (1, 2),
    "tms_sengkuni_cost_univ": (0, 1),
    "tms_duryodana_hp": (110, 150),
    "tms_duryodana_angkara_dmg": (30, 50),
    "tms_duryodana_scale_value": (3, 8),
    "tms_duryodana_angkara_cost": (2, 3)
}
```

(25 dimensi, dihitung dan diverifikasi manual: 6 + 3 + 3 + 4 + 4 + 5 = 25.)

### SMART_START (dari `src/simulator/fitness.py`, baris 39-46)

```python
SMART_START = {
    "stw_yudhistira_hp": 130, "stw_yudhistira_dmg": 30, "stw_yudhistira_dr": 20, "stw_yudhistira_heal": 20, "stw_yudhistira_cost_satwika": 1, "stw_yudhistira_cost_univ": 1,
    "stw_arjuna_hp": 110, "stw_arjuna_pasupati_dmg": 50, "stw_arjuna_pasupati_cost": 3,
    "rjs_balarama_hp": 70, "rjs_balarama_dmg": 35, "rjs_balarama_cost": 1,
    "rjs_karna_hp": 90, "rjs_karna_dmg": 60, "rjs_karna_recoil": 10, "rjs_karna_cost": 2,
    "tms_sengkuni_hp": 90, "tms_sengkuni_dmg": 35, "tms_sengkuni_mill": 2, "tms_sengkuni_cost_tamasika": 1, "tms_sengkuni_cost_univ": 1,
    "tms_duryodana_hp": 130, "tms_duryodana_angkara_dmg": 40, "tms_duryodana_scale_value": 5, "tms_duryodana_angkara_cost": 2
}
```

### POWER_SIGN (dari `src/metrics/power_creep.py`, baris 42-52)

```python
POWER_SIGN = {
    "stw_yudhistira_hp": 1, "stw_yudhistira_dmg": 1, "stw_yudhistira_dr": 1,
    "stw_yudhistira_heal": 1, "stw_yudhistira_cost_satwika": -1, "stw_yudhistira_cost_univ": -1,
    "stw_arjuna_hp": 1, "stw_arjuna_pasupati_dmg": 1, "stw_arjuna_pasupati_cost": -1,
    "rjs_balarama_hp": 1, "rjs_balarama_dmg": 1, "rjs_balarama_cost": -1,
    "rjs_karna_hp": 1, "rjs_karna_dmg": 1, "rjs_karna_recoil": -1, "rjs_karna_cost": -1,
    "tms_sengkuni_hp": 1, "tms_sengkuni_dmg": 1, "tms_sengkuni_mill": 1,
    "tms_sengkuni_cost_tamasika": -1, "tms_sengkuni_cost_univ": -1,
    "tms_duryodana_hp": 1, "tms_duryodana_angkara_dmg": 1, "tms_duryodana_scale_value": 1,
    "tms_duryodana_angkara_cost": -1,
}
```

File berisi assertion tepat setelah definisi ini: `assert set(POWER_SIGN) == set(BOUNDS), "POWER_SIGN must classify every BOUNDS dimension, no more, no fewer"` — jadi kesetaraan 25-dimensi antara BOUNDS dan POWER_SIGN ditegakkan oleh kode itu sendiri, bukan hanya oleh inspeksi manual laporan ini.

---

## 3. Konfigurasi run NSGA-II yang sudah ada (Fase 7, `run_nsga2_power_balance`)

Hanya **satu** artifact hasil ditemukan: `results/exp07_nsga2_power_balance.json`. Tidak ada file hasil kedua/lain (`*nsga2_power_balance*` dicari di seluruh repo, hanya 4 file ditemukan: config, runner, figure, dan json ini — masing-masing satu).

| Field | Nilai | Sumber |
|---|---|---|
| seed | 20260801 | `results/exp07_nsga2_power_balance.json` key `seed`, juga cocok dengan `SEED = 20260801` di `experiments/exp07_nsga2_power_balance.py` baris 36 |
| pop_size | 40 | key `pop_size` di JSON, cocok `POP_SIZE = 40` di runner baris 32 |
| generations | 40 | key `generations` di JSON, cocok `GENERATIONS = 40` di runner baris 33 |
| num_runs (search-time) | 60 | key `num_runs` di JSON, cocok `NUM_RUNS = 60` di runner baris 34 |
| validation_num_runs | 500 | key `validation_num_runs` di JSON, cocok `VALIDATION_NUM_RUNS = 500` di runner baris 35 |
| jumlah solusi di front akhir | 13 | `len(pareto_front)` = 13 |
| elapsed_seconds (dilaporkan sendiri oleh run) | 50.845390... detik | key `elapsed_seconds` di JSON |
| path artifact | `results/exp07_nsga2_power_balance.json` (22888 bytes) | — |
| figure terkait | `figures/nsga2_power_balance_pareto_front.png` (447063 bytes) | — |

**Tanggal run**: JSON hasil ini tidak menyimpan timestamp run secara eksplisit di dalam isinya (tidak ada field seperti `run_date`/`timestamp`). Dua proksi tersedia, keduanya dilaporkan apa adanya karena tidak identik:
- Commit git yang memasukkan file ini ke repo: **2026-08-04 10:06:19 +0800**, commit `99bd73c` ("feat: implement surrogate-assisted evolutionary optimization framework and expand experimental suite...").
- Filesystem mtime saat ini pada file tersebut: **2026-08-12 15:20:33 +0800**. Ini kemungkinan besar **bukan** waktu run asli — seluruh isi repo (semua file di `src/`, `experiments/`, `results/`, `configs/`, `data/`, `tests/`, `.git/`) memiliki mtime yang identik hingga hitungan detik, pola yang konsisten dengan satu operasi checkout/copy massal, bukan riwayat kerja yang tersebar dari waktu ke waktu.

`objective_ranges` yang dilaporkan run ini (dari front tervalidasi, untuk konteks, disalin apa adanya): `f1_balance` dalam [250.60, 5170.04], `f2_power_creep` dalam [0.0, 0.0002212066...], `f3_neg_identity` dalam [-0.48242642..., -0.31202664...].

---

## 4. Inventaris modul `src/metrics/`

Signature persis dari kode (via AST parse), satu baris keterangan dari baris pertama docstring masing-masing (apa adanya, dipotong di baris pertama). Fungsi/kelas berawalan `_` disertakan juga karena relevan secara struktural (dipakai fungsi publik di file yang sama), ditandai [private].

### `balance_objective.py`
- `class BalanceObjective` — (tidak ada docstring)
- `def marginal_win_rates(matrix: PayoffMatrix) -> dict` — "Each faction's win rate averaged over all *other* factions (excludes..."
- `def balance_objective(matrix: PayoffMatrix, identity: dict, identity_target: float = 0.3, weights: tuple = (1.0, 1.0, 1.0)) -> BalanceObjective` — "Compute the composite objective."

### `diversity.py`
- `def _kl_divergence_bits(p: list, q: list) -> float` [private] — "KL(P || Q) in bits. Assumes p, q are aligned probability vectors..."
- `def jensen_shannon_divergence(p: dict, q: dict) -> float` — "Jensen-Shannon divergence, in bits (0 to 1), between two categorical..."
- `def strategy_entropy(action_counts: dict, total_possible_actions: int = None) -> float` — "Normalized Shannon entropy (0-1) of an action/attack-choice frequency..."
- `def faction_identity_index(action_counts_by_faction: dict) -> dict` — "Pairwise Jensen-Shannon divergence between every pair of factions'..."

### `elo.py`
- `def elo_ratings(match_results, k_factor: float = 32.0, initial_rating: float = 1500.0) -> dict` — "Sequential Elo updates over a match log."
- `def bradley_terry_ratings(match_results, iterations: int = 1000, tol: float = 1e-10) -> dict` — "Maximum-likelihood Bradley-Terry strengths via Zermelo's algorithm..."

### `nash_averaging.py`
- `def _solve_support(A_sub: np.ndarray) -> np.ndarray | None` [private] — "Solve for a mixed strategy pi over the given support (A_sub is the..."
- `def _entropy(pi: np.ndarray) -> float` [private] — (tidak ada docstring)
- `def nash_average(payoff_matrix, names: list = None, tol: float = 1e-06) -> dict` — "Compute the maxent Nash equilibrium of the symmetric zero-sum game..."

### `nonparametric.py`
- `class WilcoxonResult` — (tidak ada docstring)
- `def wilcoxon_signed_rank(x: list, y: list) -> WilcoxonResult` — "Two-sided Wilcoxon signed-rank test on paired samples x, y (same..."

### `payoff_matrix.py`
- `class PayoffCell` — (tidak ada docstring)
- `class PayoffMatrix` — (tidak ada docstring)
- `def build_payoff_matrix(names: list, play_match_fn, n: int, base_seed: int = 0, alpha: float = 0.05) -> PayoffMatrix` — "Run every ordered pair (row, col) in `names` x `names` -- including..."

### `power_creep.py`
- `def aggregate_power_delta(theta: dict) -> float` — "mean_i raw_power_delta_i(Theta), signed (positive = net more..."
- `def power_creep_penalty(theta: dict) -> float` — "PowerCreepPenalty(Theta) = max(0, aggregate_power_delta(Theta))**2...."

### `restricted_play.py`
- `def restricted_play_depth(baseline_run_fn, restricted_run_fn, n: int, base_seed: int = 0, alpha: float = 0.05) -> dict` — "baseline_run_fn(seed) -> 1/0: outcome with the mechanic available."

### `winrate.py`
- `class WilsonInterval` — (tidak ada docstring)
- `def _z(alpha: float) -> float` [private] — "Two-sided critical z-value for significance level alpha."
- `def wilson_ci(wins: int, n: int, alpha: float = 0.05) -> WilsonInterval` — "Wilson score interval for a binomial win rate."
- `def standard_error(n: int, p: float = 0.5) -> float` — "SE of a binomial proportion estimate, sqrt(p(1-p)/n)."
- `def required_n(delta: float, alpha: float = 0.05, power: float = 0.8, p0: float = 0.5) -> int` — "Sample size (per configuration) needed for a two-sided one-sample..."
- `def paired_comparison(run_condition_a, run_condition_b, n: int, base_seed: int = 0, alpha: float = 0.05) -> dict` — "Compare two conditions using common random numbers (CRN)."

`__init__.py` di `src/metrics/` kosong (0 bytes, tidak ada re-export).

---

## 5. Inventaris `results/`

Semua file punya filesystem mtime identik (**2026-08-12 15:20:33** +/- milidetik, lihat catatan di Bagian 3 soal ini kemungkinan waktu checkout bukan waktu run asli). Commit git terakhir yang menyentuh seluruh direktori `results/`: **2026-08-04**, commit `99bd73c`. Tidak ditemukan indikator run gagal/parsial (tidak ada field `error`/`exception`/`traceback`/`failed` yang menandakan kegagalan; satu kecocokan string "error" di `exp01_sample_size.json` adalah bagian dari nama field `theoretical_se_*`/teks "margin-of-error", bukan indikator kegagalan run).

| exp_id (file) | Ukuran (bytes) | Seed | n per konfigurasi | Status |
|---|---|---|---|---|
| `dqn_hparams.json` | 5318 | — (bukan hasil run, ini spec hyperparameter: `training_regime.num_seeds`=10, `total_games_per_seed`=3000) | — | Spec file, bukan hasil eksperimen |
| `exp00_threshold_nonlinearity.json` | 6470 | `seed`=20260801 | `num_runs_per_point`=150 | Lengkap (struktur penuh: `win_rate_*`, `wilson_ci_95_*`, `linear_fit_r_squared`, `second_differences` semua terisi) |
| `exp01_sample_size.json` | 2108 | `pool.base_seed`=20260801 | `bootstrap_resamples_per_n`=300; pool_size=50000; `n_values`=[100..50000], 10 titik | Lengkap |
| `exp03_balance_matrix.json` | 8916 | `smart_start.base_seed`=20260801; `ga_balanced.base_seed`=**120260801** (persis seperti di file — angka 12-digit ini beda dari konvensi 20260801 di semua file lain, disalin apa adanya, TIDAK diperbaiki) | — (tidak ada field n/num_runs eksplisit di top level) | Lengkap (dua sub-objek `smart_start` dan `ga_balanced` sama-sama terisi) |
| `exp04_policy_dependence.json` | 8243 | `base_seed`=20260801 | tidak ada field n eksplisit selain `mcts_budget100`/`mcts_budget2000` (nama agent, bukan n) | Lengkap |
| `exp05_learning_curve.json` | 31204 | `num_seeds`=10, seed eksplisit **0-9** ditemukan di `per_seed[].seed`, 10 entri (dihitung langsung, cocok dengan `num_seeds`) | `n_eval_per_checkpoint`=200 (juga `eval_vs_random.n`=200 di setiap checkpoint per seed) | Lengkap; 10/10 seed benar-benar hadir dengan data checkpoint penuh (7 checkpoint per seed: games_trained 0,500,...,3000) |
| `exp05_reward_sensitivity.json` | 10184 | `base_seed`=20260801 | `n_per_cell`=783 (konsisten di semua 6 setting: baseline, w2=0.5/1.0/2.0, w3=0.1/0.5) | Lengkap |
| `exp06_surrogate_assisted_ea.json` | 26424 | `base_seed`=20260801 | `managed_loop.num_seed_points`=50, `num_runs_seed`=150, `num_runs_real`=150, `final_verified_num_runs`=20000 (sama untuk `naive_frozen_surrogate_ga`) | Lengkap |
| `exp06_surrogate_validation.json` | 5664 | `base_seed`=20260801 | `n_id_train`=300, `n_id_test`=80, `n_ood_test`=80, `num_runs_label`=150 | Lengkap |
| `exp07_nsga2_power_balance.json` | 22888 | `seed`=20260801 | `num_runs`=60 (search), `validation_num_runs`=500 (final front) | Lengkap — lihat Bagian 3 untuk detail |
| `exp07_optimizer_ablation.json` | 187858 | `base_seed`=20260801, `num_seeds`=20 (diverifikasi: setiap metode punya persis 20 elemen di `final_values_per_seed`) | `budget`=300, `num_runs`=60 | Lengkap; 5 metode diablasi (`ga_only`, `pso_only`, `hybrid_ga_pso`, `random_search`, `cma_es`), masing-masing 20/20 seed hadir |
| `exp08_cost_accounting.json` | 7025 | `base_seed`=20260801 | `n_repetitions`=5 | Lengkap |
| `exp08_dimension_scaling.json` | 1282 | tidak ada field seed (timing murni deterministik) | `n_timing_reps`=2000 | Lengkap |
| `exp09_equilibrium_robustness.json` | 25073 | `base_seed`=20260801 | Part A (basin of attraction): `num_runs`=100; Part B (multistart): `budget`=300, `num_runs`=60 | Lengkap |
| `exp09_karna_hp_ci.json` | 9900 | `base_seed`=20260801 | `num_runs`=300 | Lengkap |
| `exp09_sensitivity_indices.json` | 13902 | `base_seed`=20260801 | `num_runs_per_eval`=100 | Lengkap |

**Ketidaksesuaian penomoran dicatat ulang di sini**: `configs/exp02_surrogate_validation.yaml` ada tapi tidak ada `results/exp02_*.json` yang cocok — file yang paling dekat namanya adalah `exp06_surrogate_validation.json`/`exp06_surrogate_assisted_ea.json`, tapi ini TIDAK diasumsikan sebagai pengganti exp02 tanpa bukti eksplisit (tidak ditemukan referensi silang di config manapun yang menyatakan exp02 diganti namanya menjadi exp06).

---

## 6. Status FASE 9

Acceptance criteria Fase 9 (per `src/simulator/rules_spec.md` section 16, khususnya 16.5 "Revised claim language") **ADA buktinya dan artifact-nya lengkap.** Tiga komponen yang disebutkan rules_spec.md sebagai dibangun untuk fase ini, semuanya ditemukan:

1. **Sobol/Morris global sensitivity** (`src/sensitivity/sobol.py`, `src/sensitivity/morris.py`, `experiments/exp09_sensitivity_indices.py`) → artifact `results/exp09_sensitivity_indices.json` (13902 bytes) + `figures/exp09_sobol_morris_indices.png` (388811 bytes). ADA.
2. **Basin of attraction + multi-start uniqueness** (`experiments/exp09_equilibrium_robustness.py`, dua bagian: Part A dan Part B) → artifact `results/exp09_equilibrium_robustness.json` (25073 bytes) + `figures/exp09_basin_of_attraction.png` (250288 bytes) + `figures/exp09_multistart_clustering.png` (210220 bytes). ADA.
3. **Karna HP CI sweep / Fig. 2 replacement** (`experiments/exp09_karna_hp_ci.py`) → artifact `results/exp09_karna_hp_ci.json` (9900 bytes) + `figures/exp09_karna_hp_ci.png` (558765 bytes). ADA.

Isi rules_spec.md section 16.5 secara eksplisit menyatakan bahasa klaim yang direvisi ("Per this phase's acceptance criteria, replace: 'isolated the exact equilibrium point' with: ...") dan section 16.1 menyatakan "This is the headline finding this section's acceptance criteria asked for: Karna's HP was never the primary lever" — jadi rules_spec.md sendiri mengklaim acceptance criteria terpenuhi, dan tiga artifact hasil + tiga figure di atas ADA sebagai bukti pendukung klaim tersebut.

**Yang TIDAK dapat diverifikasi laporan ini**: rules_spec.md tidak menuliskan daftar acceptance criteria Fase 9 sebagai bullet list terpisah yang eksplisit (mis. checklist tercentang) di satu tempat — kriteria harus disimpulkan dari narasi section 16.1-16.5. Tidak ditemukan dokumen terpisah (mis. `docs/IMPLEMENTATION_PLAN.md`, yang TIDAK DITEMUKAN — lihat Bagian 0) yang menyatakan acceptance criteria Fase 9 secara formal untuk dicocokkan satu-satu dengan hasil. Jadi status "terpenuhi" di sini didasarkan pada klaim rules_spec.md sendiri + keberadaan artifact yang didukungnya, bukan pada pencocokan terhadap spesifikasi acceptance-criteria independen.

---

## 7. Utang teknis yang diketahui (dari `rules_spec.md` dan komentar kode, apa adanya)

Disalin/dirangkum langsung dari `src/simulator/rules_spec.md` (dinyatakan file itu sendiri disusun 2026-08-01 dengan memeriksa langsung kode, bukan diasumsikan) dan komentar/docstring kode. Tidak disaring, tidak diberi rekomendasi perbaikan.

1. **`heal_bench_card` secara matematis adalah no-op** (rules_spec.md 4.3). Efek ini memilih anggota bench acak dan menyembuhkan `min(value, target.hp - target.current_hp)`, tapi tidak ada kode lain di `models.py` yang pernah mengurangi `current_hp` anggota bench (damage hanya pernah mengenai `active_character`) — sehingga `target.hp - target.current_hp` selalu 0 dan heal selalu 0, berapa pun `value`-nya. Diverifikasi empiris di `experiments/exp03_balance_matrix.py`'s restricted-play run: melarang efek ini mengubah 0 dari 20.000 pertandingan berpasangan (depth = 0.00pp persis, paired_correlation = 1.000). Konsekuensi yang dinyatakan eksplisit: parameter `stw_yudhistira_heal` (salah satu dari 25 dimensi BOUNDS) saat ini tidak berpengaruh apa pun dalam permainan — setiap run GA/PSO yang men-tuning parameter ini men-tuning variabel mati.

2. **First-mover advantage berlaku sepanjang pertandingan, bukan hanya giliran pembuka** (rules_spec.md 1.2). `first_player` yang ditentukan oleh satu coin-toss di awal match bertindak lebih dulu di SETIAP giliran berikutnya — tidak ada pergantian siapa jalan duluan. Dinyatakan eksplisit sebagai "a real, structural first-mover advantage for the entire match... worth accounting for explicitly in any balance analysis."

3. **Mulligan tidak diimplementasikan** (rules_spec.md 1.1, poin 4). Tidak ada re-draw untuk tangan tanpa karakter Basic-stage. Saat ini tidak bisa terjadi dengan deck yang di-ship karena semua kartu di ketiga deck adalah Basic-stage Tokoh — tapi dinyatakan sebagai "a latent gap if the card pool is ever expanded."

4. **Soft-lock laten** (rules_spec.md 1.5). Jika `play_basic_to_active` mengembalikan `False`, `active_character` tetap `None` selamanya dan pemain itu tidak bisa bertindak lagi sepanjang sisa match, tanpa mekanisme pemulihan. Dinyatakan tidak bisa terjadi dengan deck saat ini, tapi laten jika card pool diperluas ke kartu multi-stage/non-Tokoh.

5. **Bug tabrakan nama pada mirror match** (rules_spec.md 4.5). `run_simulation`, `run_simulation_multi`, `run_logged_simulation` mengidentifikasi pemenang dengan membandingkan string nama, bukan identitas objek. Jika kedua instance `Player` dibuat dengan nama yang sama (mirror match, mis. diagonal payoff matrix), pemenang yang dilaporkan SELALU sama dengan `name1`/`name2` terlepas dari siapa yang benar-benar menang. Dikonfirmasi lewat test langsung: `run_simulation_multi(satwika, satwika, "SATWIKA", "SATWIKA")` 20 kali menghasilkan "SATWIKA" sebagai pemenang di ke-20 kalinya (100% "win rate" palsu, bukan hasil nyata). Satu-satunya kode yang menjalankan mirror match (`experiments/exp03_balance_matrix.py`) mengatasinya secara lokal dengan label sementara berbeda, TANPA memperbaiki engine — dinyatakan eksplisit bahwa kode masa depan yang menjalankan mirror match butuh workaround yang sama, atau engine perlu diubah ke identifikasi berbasis posisi.

6. **`retreat_cost` didefinisikan tapi tidak pernah dipakai** (rules_spec.md 2). Tidak ada aksi retreat/switch-active di `Player`/`engine.py`. Kode RL self-play di `src/agents/dqn_agent.py` punya aksi bench-swap ad-hoc yang mengabaikan `retreat_cost` sepenuhnya; dashboard TypeScript interaktif juga tidak mengenakan `retreat_cost`.

7. **Divergensi Python engine vs dashboard TypeScript** (rules_spec.md 4.4). Dashboard (`battle-simulator.impl.ts`) adalah reimplementasi terpisah, bukan client dari engine Python, dan berbeda dalam beberapa hal: (a) dashboard mengimplementasikan `lifesteal` dan `poison_recoil` yang tidak ada sama sekali di engine Python; (b) efek mill diberi key `'mill'` di TS vs `'mill_enemy_deck'` di Python — kartu yang ditulis untuk satu engine jadi no-op senyap di engine lain; (c) `runBatchSimulation` di TS menambahkan varians damage +/-10% yang tidak ada di engine Python. Dinyatakan eksplisit "None of this was in scope to reconcile in this pass."

8. **Prana curve "tidak bermakna" dengan card pool saat ini** (rules_spec.md 1.3). Setiap deck faksi hanya berisi 2 kartu unik (masing-masing 20 salinan), sehingga tidak ada keputusan deck-building/hand-management nyata seputar cost curve.

9. **Tidak ada draw-per-turn atau bermain kartu baru dari tangan setelah setup** (rules_spec.md 1.4). Seluruh sisa match hanya menggunakan karakter yang sudah ditempatkan saat setup. Lima kartu tambahan di `card_repository.py` (Gatotkaca, Bhishma Pitamaha, Abimanyu, Drona, Kresna) tidak direferensikan oleh ketiga deck faksi dan saat ini tidak bisa dimainkan lewat pipeline ini.

10. **Efek `"lifesteal"` dan string efek tak dikenal lainnya adalah no-op senyap** (rules_spec.md 4.3). `trigger_attack_effect` hanya mengenali `mill_enemy_deck`, `heal_bench_card`, `recoil_damage`; string lain (termasuk `"lifesteal"` yang didefinisikan pada kartu Gatotkaca) tidak melakukan apa-apa tanpa pesan error.

11. **Metodologi Sobol/Morris di Fase 9 mengasumsikan model deterministik, padahal `evaluate_chromosome` stokastik** (rules_spec.md 16.1, disebut eksplisit sebagai "Methodological caveat"). Karena Sobol/Morris diterapkan ke estimator Monte Carlo stokastik (n=100/matchup, bukan standar N_MATCH=20000), sebagian varians yang terukur adalah noise simulasi yang tak tereduksi, bukan sensitivitas parameter sejati — ini menginflasi efek interaksi yang tampak dan melebarkan CI yang dilaporkan. Dinyatakan eksplisit: ranking parameter lebih bisa dipercaya daripada nilai indeks eksaknya.

12. **Ekuilibrium "golden" (`data/ga_balanced_params.json`) tidak unik dan rapuh** (rules_spec.md 16.2, 16.3). Bahkan pada Theta* sendiri (sigma=0, tanpa perturbasi), hanya 40% dari evaluasi ulang independen yang lolos band "seimbang" +/-10pp di ketiga matchup sekaligus (n=25). 21 ekuilibrium berbeda dan saling berjauhan ditemukan dari 24 restart pencarian independen (budget=300, dinyatakan sebagai "a modest search budget... part of this dispersion could reflect incomplete convergence... rather than 21 genuinely distinct GLOBAL attractors" — caveat ini dicatat eksplisit oleh dokumen sumber sendiri). Basin sempit: fraksi sampel-terperturbasi yang masih "seimbang" turun dari 40% (sigma=0) ke 8% (sigma=0.02) ke 0% (sigma=0.05).

13. **Klaim "kurva Satwika dan Rajasika nyaris berimpit" TIDAK dapat direproduksi** (rules_spec.md 16.4). Re-analisis dengan baseline `ga_balanced_params.json` menemukan pasangan TERDEKAT justru Satwika/Tamasika (4.14pp), sementara Satwika/Rajasika adalah GAP TERBESAR dari ketiganya (14.15pp). Dinyatakan eksplisit "This section cannot confirm the specific Satwika/Rajasika claim as stated." Gap 4.14pp terdekat itu sendiri disebut dekat dengan lantai noise (rentang kontrol 8.0pp), sehingga bahkan "nyaris berimpit" itu sendiri tidak jelas beda dari noise sampling.

14. **Pers. (4) (`scalarized_objective`) adalah weighted-sum scalarization, bukan multi-objective sejati** (rules_spec.md, dirujuk di docstring `src/optim/objective.py` dan pembuka `experiments/exp07_nsga2_power_balance.py`). "PowerCreepPenalty(Theta)" dinamai di Pers. (4) tapi tidak pernah didefinisikan secara formal di mana pun sampai `src/metrics/power_creep.py` dibuat (lihat docstring modul tersebut, disalin di Bagian 2 di atas) — modul itu sendiri menyatakan ini sebagai celah yang baru diisi, bukan diasumsikan sudah ada sebelumnya.

15. **"Hybrid" TIDAK mengalahkan GA-only pada ablasi optimizer** (rules_spec.md, dirujuk sebagai "ACCEPTANCE CRITERION RESULT" di baris ~1159). Dinyatakan eksplisit: "hybrid does NOT beat GA-only... GA-only simply does not out-search GA-only [sic — kemungkinan salah ketik untuk 'hybrid does not out-search GA-only'] on this problem within this budget." Juga: Bayesian Optimization tidak mengalahkan Random Search pada baseline ini (p=0.9553), dinyatakan sebagai "a real limitation of THIS BO implementation, not a claim about Bayesian Optimization in general."

16. **Hanya 1 file test di seluruh repo** (`tests/test_imports.py`, 1588 bytes) — diamati langsung dari listing filesystem Bagian 1, bukan pernyataan dari rules_spec.md. Dicatat di sini sebagai fakta cakupan test, bukan tuduhan.

Ini bukan daftar lengkap seluruh isi rules_spec.md (dokumen 92133 bytes / >1500 baris) — item di atas adalah bagian yang secara eksplisit ditandai file sumber sebagai "Not implemented", bug, celah metodologis, atau caveat yang mempengaruhi validitas klaim. Bagian rules_spec.md yang tidak dibaca penuh oleh audit ini kemungkinan berisi item tambahan di luar 16 poin di atas.
