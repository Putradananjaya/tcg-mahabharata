# Panduan TCG Mahabharata — Dari Awal Sampai Jalan di Lokal

Dokumen ini menjelaskan isi repo, cara menyiapkan lingkungan, menjalankan test,
menjalankan eksperimen riset, menjalankan API server, dan menjalankan dashboard
Angular di komputer lokal.

Dokumen terkait yang lebih spesifik:

| Dokumen | Isi |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Aturan kerja repo (wajib dibaca sebelum mengubah apa pun) |
| [REPRODUCE.md](REPRODUCE.md) | Detail reproduksi setiap eksperimen |
| [CLAIMS_LEDGER.md](CLAIMS_LEDGER.md) | Klaim paper ↔ artifact di `results/` yang mendukungnya |
| [src/simulator/rules_spec.md](src/simulator/rules_spec.md) | Spesifikasi formal aturan permainan yang diimplementasikan simulator |
| [docs/FASE_E9_SPEC.md](docs/FASE_E9_SPEC.md) | Spec fase aktif (E9: balancing dengan kendala lore) |
| [docs/STATUS_REPORT.md](docs/STATUS_REPORT.md) | Laporan status/audit proyek |
| [dashboard/README.md](dashboard/README.md) | Catatan khusus dashboard |

---

## 1. Apa isi repo ini

Repo ini adalah kode pendukung paper akademik tentang **balancing otomatis
trading card game (TCG)** bertema Mahabharata. Ada tiga faksi —
**Satwika, Rajasika, Tamasika** — dan pertanyaan risetnya adalah bagaimana
menyeimbangkan parameter kartu (HP, damage, dsb.) memakai simulasi,
optimizer (GA, PSO, NSGA-II), surrogate model, dan agen (random, greedy,
MCTS, Q-learning/DQN).

Repo terdiri dari dua bagian yang **terpisah**:

1. **Pipeline riset (Python)** — `src/`, `experiments/`, `configs/`,
   `results/`, `figures/`. Ini satu-satunya sumber angka untuk paper.
2. **Dashboard interaktif (Angular 18)** — `dashboard/`. Demo/showcase UI.
   Angka hasil riset yang ditampilkan dashboard dibaca langsung dari file
   `results/exp*.json` dan `data/ga_balanced_params.json`; simulasi di
   dashboard memakai engine TypeScript sendiri. **Angka yang muncul di
   dashboard bukan sumber kutipan paper** — selalu rujuk `results/` dan
   `CLAIMS_LEDGER.md`.

### Struktur folder

```
tcg-mahabharata/
├── src/                    # Kode inti Python
│   ├── domain/             #   Model kartu & pemain, repository kartu
│   ├── simulator/          #   Engine permainan, fitness, determinism (seed)
│   ├── agents/             #   Agen: random, greedy, scripted, MCTS, DQN/Q-learning
│   ├── metrics/            #   Win rate (Wilson CI), Elo, Nash averaging, payoff matrix, dll.
│   ├── optim/              #   GA, PSO, NSGA-II, hybrid, baseline random search
│   ├── surrogate/          #   Surrogate MLP, ensemble, baseline
│   ├── sensitivity/        #   Sobol & Morris
│   ├── constraints/        #   Kendala lore (Fase E9)
│   ├── api/server.py       #   FastAPI server (sebagian besar endpoint masih stub)
│   └── ...
├── experiments/            # Satu script per eksperimen (exp00 … exp09)
├── configs/                # YAML per eksperimen (dokumentasi parameter, lihat §5.3)
├── data/                   # Deck faksi (satwika/rajasika/tamasika.json), parameter hasil GA
├── results/                # Artifact JSON hasil eksperimen (sumber kebenaran paper)
├── figures/                # Figure PNG yang dihasilkan script dari results/
├── tests/                  # Unit test (pytest)
├── scripts/                # Script lama (legacy), bukan bukti paper
├── dashboard/              # Aplikasi Angular
├── requirements.txt        # Dependensi Python (versi di-pin)
└── docs/                   # Spec fase & laporan status
```

---

## 2. Prasyarat

| Kebutuhan | Versi | Catatan |
|---|---|---|
| Python | 3.9 | `requirements.txt` di-pin dan diverifikasi dengan Python 3.9.6 |
| pip + venv | bawaan Python | |
| Node.js | LTS (20 atau 22) direkomendasikan | Hanya untuk dashboard. Build juga berhasil di Node 26, tapi Angular 18 secara resmi mendukung Node 18.19+/20/22 |
| npm | bawaan Node.js | |
| Git | versi apa saja | |

Cek versi yang terpasang:

```bash
python3 --version
node --version
npm --version
```

> **Catatan dependensi:** repo ini sengaja **tidak** memakai scipy,
> scikit-learn, SALib, atau torch. Beberapa modul (Sobol, uji non-parametrik,
> Nash averaging, baseline optimizer/surrogate) diimplementasikan dari nol.
> Jangan menambahkan library tersebut tanpa meninjau ulang implementasi itu.

---

## 3. Clone repo

```bash
git clone https://github.com/Putradananjaya/tcg-mahabharata.git
cd tcg-mahabharata
```

Semua perintah di bawah dijalankan dari **root repo** kecuali disebutkan lain.

---

## 4. Setup Python

### 4.1 Buat virtual environment dan instal dependensi

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Setelah aktivasi, `python` mengacu ke `venv`. Alternatifnya, panggil
langsung `venv/bin/python` / `venv/bin/pytest` tanpa aktivasi — gaya inilah
yang dipakai di docstring setiap script eksperimen.

### 4.2 Jalankan unit test

```bash
venv/bin/python -m pytest tests/
```

Hasil yang diharapkan: semua test lulus (per 2026-09-29: `146 passed`,
dengan beberapa warning). Jika ada test yang gagal, **jangan lanjut ke
eksperimen** — laporkan dulu kegagalannya.

---

## 5. Menjalankan eksperimen riset

### 5.1 Pola umum

Setiap script di `experiments/` berdiri sendiri. Docstring di bagian atas
file menjelaskan perintah `Run:`, input, dan artifact yang dihasilkan.
**Baca docstring itu sebelum menjalankan.**

```bash
venv/bin/python experiments/exp01_sample_size.py
```

Script menulis:
- artifact JSON ke `results/<nama>.json`
- (kebanyakan) figure ke `figures/<nama>.png`

> ⚠️ Menjalankan ulang script akan **menimpa** artifact dan figure yang sudah
> ada di `results/` dan `figures/`. Cek `git diff` setelahnya; setiap
> perubahan angka harus bisa dijelaskan, bukan sekadar di-commit.

### 5.2 Daftar eksperimen

| Script | Artifact di `results/` | Figure di `figures/` |
|---|---|---|
| `exp00_threshold_nonlinearity.py` | `exp00_threshold_nonlinearity.json` | — (diagnostik) |
| `exp01_sample_size.py` | `exp01_sample_size.json` | `sample_size_justification.png` |
| `exp03_balance_matrix.py` | `exp03_balance_matrix.json` | `payoff_matrix_3x3_ga_balanced.png`, `payoff_matrix_3x3_smart_start.png` |
| `exp04_policy_dependence.py` | `exp04_policy_dependence.json` | `policy_dependence_heatmap.png` |
| `exp05_learning_curve.py` | `exp05_learning_curve.json` | `rl_learning_curve.png` |
| `exp05_reward_sensitivity.py` | `exp05_reward_sensitivity.json` | `reward_sensitivity.png` |
| `exp06_surrogate_validation.py` | `exp06_surrogate_validation.json` | `surrogate_baseline_comparison.png`, `surrogate_calibration.png` |
| `exp06_surrogate_assisted_ea.py` | `exp06_surrogate_assisted_ea.json` | `surrogate_error_vs_generation.png` |
| `exp07_nsga2_power_balance.py` | `exp07_nsga2_power_balance.json` | `nsga2_power_balance_pareto_front.png` |
| `exp07_optimizer_ablation.py` | `exp07_optimizer_ablation.json` | `exp07_convergence_curves.png`, `exp07_final_value_comparison.png` |
| `exp08_cost_accounting.py` | `exp08_cost_accounting.json` | `exp08_breakeven_analysis.png` |
| `exp08_dimension_scaling.py` | `exp08_dimension_scaling.json` | `exp08_dimension_scaling.png` |
| `exp09_equilibrium_robustness.py` | `exp09_equilibrium_robustness.json` | `exp09_basin_of_attraction.png`, `exp09_multistart_clustering.png` |
| `exp09_karna_hp_ci.py` | `exp09_karna_hp_ci.json` | `exp09_karna_hp_ci.png` |
| `exp09_sensitivity_indices.py` | `exp09_sensitivity_indices.json` | `exp09_sobol_morris_indices.png` |
| `exp09_lore_constrained.py` | `exp09_lore_constrained.json` | `exp09_lore_constrained_pareto_front.png` |
| `exp09_angkara_scaling_diagnostic.py` | `exp09_angkara_scaling_diagnostic.json` | — (diagnostik) |

Belum ada perintah tunggal `run_all`; jalankan per script. Beberapa
eksperimen (terutama yang memakai n = 20.000 match per matchup, multi-seed,
atau NSGA-II) bisa berjalan lama.

Untuk mengetahui klaim paper mana yang didukung setiap artifact, lihat
[CLAIMS_LEDGER.md](CLAIMS_LEDGER.md).

### 5.3 Tentang `configs/*.yaml`

`configs/base.yaml` berisi default bersama (seed dasar `20260801`, minimal
10 seed, `n_match` 20.000, CI Wilson). **Namun script di `experiments/`
belum membaca file YAML-nya** — setiap script menyimpan parameternya sebagai
konstanta Python, dan YAML adalah catatan yang dipelihara manual. Jika Anda
mengubah konstanta di script, perbarui YAML-nya di commit yang sama. Kode
adalah yang berlaku bila keduanya berbeda.

### 5.4 Script legacy

`scripts/*.py`, `experiments/main.py`, `experiments/visualize.py`,
`experiments/advanced_visualize.py`, dan beberapa script lain tanpa awalan
`exp` dibuat sebelum reorganisasi `configs/`/`results/`. Output-nya bersifat
eksploratif dan **tidak** dikutip di paper.

---

## 6. Menjalankan API server (opsional)

Ada server FastAPI kecil di `src/api/server.py`:

```bash
venv/bin/uvicorn src.api.server:app --reload --port 8000
```

Cek di browser atau terminal:

```bash
curl http://localhost:8000/
# {"message":"Welcome to Mahabharata TCG Engine API"}
```

Dokumentasi interaktif otomatis: `http://localhost:8000/docs`.

> ⚠️ Endpoint `/api/simulate`, `/api/rl/recommend`, dan `/api/optimize/ga`
> saat ini masih **stub**: tidak menjalankan simulasi atau optimizer
> sungguhan, dan `/api/rl/recommend` mengembalikan Q-value tetap untuk
> ilustrasi. Dashboard juga tidak memanggil server ini. Jangan memakai
> output server sebagai hasil.

---

## 7. Menjalankan dashboard (Angular)

### 7.1 Instal dependensi

```bash
cd dashboard
npm install
```

### 7.2 Konfigurasi environment

File `dashboard/src/environments/environment.ts` berisi konfigurasi
Firebase. Jika file itu belum ada, salin dari template:

```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```

lalu isi dengan konfigurasi project Firebase Anda sendiri (Firebase Console
→ Project settings → General → Your apps). Saat ini konfigurasi Firebase
belum dipakai oleh kode aplikasi, jadi dashboard tetap berjalan dengan nilai
placeholder.

### 7.3 Jalankan server pengembangan

```bash
npm run start
```

Buka **http://localhost:4200/** di browser. Server akan me-reload otomatis
saat file berubah. Hentikan dengan `Ctrl+C`.

Dashboard menyajikan `results/exp*.json` dan `data/ga_balanced_params.json`
sebagai file statis (lihat `assets` di `dashboard/angular.json`), jadi
jalankan eksperimen Python lebih dulu bila Anda ingin dashboard menampilkan
hasil terbaru.

### 7.4 Halaman yang tersedia

| URL | Isi |
|---|---|
| `/guide` | Panduan penggunaan (halaman awal) |
| `/simulator` | Simulator pertempuran |
| `/simulator/tcg` | Mode TCG (bermain melawan bot) |
| `/balancer` | Hasil riset balancing (dibaca dari `results/`) |
| `/creator` | Pembuat kartu |
| `/tuning` | Slider parameter kartu |
| `/analytics` | Analitik |
| `/flow` | Diagram alur data pipeline |

### 7.5 Build produksi

```bash
npm run build
```

Output ada di `dashboard/dist/`. Warning soal ukuran bundle yang melebihi
budget dan soal `environment.ts` yang tidak terpakai saat ini muncul tetapi
tidak menggagalkan build.

### 7.6 Verifikasi engine TypeScript

Dua script memeriksa bahwa engine TypeScript di dashboard konsisten dengan
engine Python:

```bash
npm run verify:engine   # Wilson CI, BOUNDS, dan payoff matrix 3x3 vs results/exp03_balance_matrix.json
npm run verify:tcg      # Pemeriksaan mode TCG
```

Keduanya harus berakhir dengan `ALL CHECKS PASSED`. Karena generator acak
TS dan Python berbeda, kesetaraan diuji secara statistik (z-test dengan
koreksi Bonferroni), bukan angka identik.

---

## 8. Ringkasan: dari nol sampai semua jalan

```bash
# 1. Clone
git clone https://github.com/Putradananjaya/tcg-mahabharata.git
cd tcg-mahabharata

# 2. Python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m pytest tests/

# 3. (Opsional) Jalankan satu eksperimen
python experiments/exp01_sample_size.py

# 4. (Opsional) API server — terminal terpisah
uvicorn src.api.server:app --reload --port 8000

# 5. Dashboard — terminal terpisah
cd dashboard
npm install
npm run start
# buka http://localhost:4200/
```

---

## 9. Aturan kerja singkat (ringkasan CLAUDE.md)

Baca [CLAUDE.md](CLAUDE.md) untuk versi lengkap. Intinya:

1. **Jangan memfabrikasi data hasil.** Tidak ada data dummy/hardcode di
   figure atau `results/`. Hasil negatif dilaporkan apa adanya.
2. **Reproducibility.** Satu eksperimen = satu script + satu YAML + satu
   artifact. Setiap run mencatat seed, commit hash, versi library, timestamp.
   Figure hanya dibuat oleh script dari `results/`.
3. **Ketidakpastian.** Minimal 10 seed; laporkan mean ± 95% CI; win rate
   memakai Wilson score interval; sertakan n.
4. **Selalu ada baseline** (mis. optimizer vs random search, agen vs random
   dan greedy).
5. **Keputusan domain, lore, bobot reward, perubahan aturan simulator, dan
   filter data** harus ditanyakan ke peneliti, bukan diputuskan sendiri.
6. Data sintetis hanya untuk test di `tests/` dengan awalan `synthetic_`
   atau `fixture_`.

---

## 10. Troubleshooting

| Masalah | Penyebab / solusi |
|---|---|
| `ModuleNotFoundError: No module named 'src'` | Jalankan perintah dari root repo, bukan dari dalam `experiments/` atau `src/` |
| `pip install` gagal di versi Python lain | `requirements.txt` diverifikasi di Python 3.9; buat venv dengan Python 3.9 bila versi lain bermasalah |
| `ng: command not found` | Gunakan `npm run start` (memakai Angular CLI lokal), atau `npx ng ...` |
| Port 4200 / 8000 sudah dipakai | `npm run start -- --port 4300` atau `uvicorn ... --port 8001` |
| Halaman `/balancer` menampilkan error load | File `results/exp*.json` tidak ada; jalankan eksperimen yang relevan. Dashboard sengaja menampilkan error, bukan angka pengganti |
| `npm run verify:engine` gagal | Engine TS menyimpang dari engine Python; laporkan, jangan ubah threshold |
| Figure/artifact berubah setelah menjalankan ulang | Periksa `git diff results/`; perubahan harus dijelaskan (mis. perubahan kode), bukan diabaikan |

---

## 11. Keterbatasan yang diketahui

- Belum ada perintah `run_all`; eksperimen dijalankan satu per satu.
- `configs/*.yaml` belum di-load oleh script (lihat §5.3).
- `configs/exp02_surrogate_validation.yaml` tidak punya script/artifact
  pasangan.
- `results/dqn_hparams.json` disebut dihasilkan oleh
  `experiments/exp05_hparams_report.py`, tetapi script itu tidak ada di repo.
- `src/sensitivity/`, `src/optim/`, dan `src/surrogate/` belum punya unit
  test berbasis nilai referensi.
- `src/agents_llm/card_designer.py` masih menghasilkan statistik kartu secara
  acak (belum ada panggilan LLM atau evaluasi nyata) — outputnya tidak boleh
  dipakai.
- Endpoint API di `src/api/server.py` masih stub (lihat §6).
