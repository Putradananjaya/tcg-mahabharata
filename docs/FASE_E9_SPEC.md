# FASE E9 — Constrained Balancing under Narrative-Fidelity Constraints

> Menjawab **RQ3**: apakah ekuilibrium seimbang tetap eksis ketika ruang parameter
> dibatasi oleh kendala pengetahuan domain, dan berapa "harga" kendala tersebut?
>
> **Aturan di `CLAUDE.md` berlaku penuh.** Terutama Aturan 1 (jangan fabrikasi hasil)
> dan Aturan 5 (keputusan domain bukan wewenang agent).

---

## 0. Konteks: kenapa fase ini tidak membatalkan apa pun

Hasil FASE 7 yang sudah ada (`results/exp07_nsga2_power_balance.json`, 13 solusi)
menjadi **lengan UNCONSTRAINED** dari eksperimen ini. E9 hanya menambahkan
**lengan CONSTRAINED** dengan konfigurasi identik, lalu membandingkan keduanya.

Tidak ada mekanik simulator yang berubah. Tidak ada eksperimen lama yang perlu diulang.

**Konfigurasi yang WAJIB dipakai ulang persis** (dari `results/exp07_nsga2_power_balance.json`):

```
seed                 = 20260801
pop_size             = 40
generations          = 40
num_runs             = 60
validation_num_runs  = 500
```

Menyimpang dari salah satu angka ini membuat perbandingan tidak sah.

---

## 1. Fakta kelayakan yang sudah diverifikasi

Sudah diuji di luar repo terhadap `BOUNDS` (400.000 sampel acak seragam):

- **Θ_lore mencakup ~4,2% dari Θ_full.** Ruangnya tidak kosong, dan cukup ketat untuk bermakna.
- Kendala paling mengikat: L4 (58,1% dilanggar), L5 (50,1%), L17 (37,5%), L1 (23,8%).
- L2, L6, L9, L16 hampir selalu terpenuhi otomatis (< 4%).
- L3, L7, L10, L11, L13, L15, L18 **tidak pernah dilanggar** oleh sampel acak — karena
  `BOUNDS` sendiri sudah menjaminnya (mis. `rjs_karna_recoil` low = 5 > 0).

**Implikasi penting:** tujuh kendala terakhir itu **tidak mengikat** pada `BOUNDS` saat ini.
Tetap implementasikan seluruh 18 — mereka mendokumentasikan penalaran naratif dan
akan mengikat jika `BOUNDS` berubah — tapi **laporkan status keterikatannya di paper.**
Menyajikan 18 kendala seolah semuanya aktif ketika hanya 11 yang mengikat adalah
misrepresentasi yang akan ditangkap reviewer.

`ga_balanced_params.json` memenuhi **17 dari 18** — hanya **L4 yang dilanggar**
(pasupati_dmg=50 < karna_dmg=58). Ini temuan, bukan bug. **Jangan diperbaiki.**

---

## 2. Deliverable

### 2.1 `src/constraints/lore.py`

Modul baru. Tidak boleh mengubah file lain kecuali yang disebut di §2.2–2.4.

```python
LoreConstraint = namedtuple("LoreConstraint", ["id", "expr", "rationale", "source"])
```

Implementasikan ke-18 kendala sebagai fungsi `g_k(theta) -> float`, dengan konvensi
**`g_k(θ) ≤ 0` berarti terpenuhi** (konvensi standar constraint handling).

Untuk kendala relasional `a > b` dengan margin integer ε=1: `g(θ) = b − a + 1`.

| ID | Ekspresi | Sumber naratif |
|---|---|---|
| L1 | `stw_yudhistira_hp` > `stw_arjuna_hp` | Anusasana Parva (Vol. XI) — Yudhishthira sebagai penerima wejangan dharma |
| L2 | `stw_yudhistira_dmg` < `stw_arjuna_pasupati_dmg` | Vol. II, Kairata Parva — Arjuna tak tertandingi di antara Kshatriya |
| L3 | `stw_yudhistira_dr` > 0 | Anusasana Parva — dharma sebagai perlindungan |
| L4 | `stw_arjuna_pasupati_dmg` ≥ max(`rjs_karna_dmg`, `rjs_balarama_dmg`, `tms_sengkuni_dmg`, `tms_duryodana_angkara_dmg`) | Vol. II, Sec. XL — Pasupata, senjata Mahadewa |
| L5 | `stw_arjuna_pasupati_cost` ≥ 3 | Vol. II, Sec. XXXVIII–XLI — diperoleh lewat tapa dan pertarungan |
| L6 | `rjs_karna_dmg` > `rjs_balarama_dmg` | Vol. IV, Sec. CLVIII — Balarama menarik diri dari perang |
| L7 | `rjs_karna_recoil` > 0 | Vol. III, Kundala-harana — kekuatan dibayar dengan umur |
| L8 | `rjs_karna_hp` < `stw_yudhistira_hp` | Vol. III — zirah diserahkan, kerapuhan didapat |
| L9 | `rjs_karna_hp` < `tms_duryodana_hp` | Vol. VII, Salya Parva — Duryodhana terlatih 13 tahun |
| L10 | `rjs_karna_dmg` ≥ `stw_yudhistira_dmg` | Vol. IV, hlm. 276 — Karna setara Bhishma/Drona/Kripa |
| L11 | `tms_sengkuni_hp` < `tms_duryodana_hp` | Vol. II, Dyuta Parva — Sakuni penghasut, bukan ksatria |
| L12 | `tms_sengkuni_dmg` < `tms_duryodana_angkara_dmg` | Vol. II, Dyuta Parva |
| L13 | `tms_sengkuni_mill` ≥ 1 | Vol. II, Dyuta Parva — kehancuran lewat manipulasi |
| L14 | `tms_duryodana_hp` ≥ `stw_arjuna_hp` | Vol. VII, hlm. 467 — keterampilan & ketahanan hasil latihan |
| L15 | `tms_duryodana_scale_value` > 0 | Vol. VII — Angkara menskala dengan kehancuran |
| L16 | mean HP Satwika > mean HP Rajasika | Vol. V, Bhagavad Gita — *goodness* vs *passion* |
| L17 | mean damage Rajasika > mean damage Satwika | Vol. V, Bhagavad Gita |
| L18 | `rjs_karna_cost` ≤ `stw_arjuna_pasupati_cost` | Vol. V — *passion* sebagai tempo cepat |

API wajib:

```python
def constraint_violations(theta: dict) -> dict[str, float]:
    """{constraint_id: g_k(theta)}. Nilai <= 0 berarti terpenuhi."""

def total_violation(theta: dict) -> float:
    """Jumlah max(0, g_k) atas seluruh k. 0.0 berarti fully feasible."""

def is_feasible(theta: dict) -> bool: ...

def feasibility_report(theta: dict) -> dict:
    """{'feasible': bool, 'n_satisfied': int, 'violated': [ids],
        'total_violation': float}"""
```

### 2.2 Constrained tournament selection di NSGA-II

Tambahkan **fungsi baru** `run_nsga2_lore_constrained(...)` di `src/optim/nsga2.py`.
**Jangan modifikasi** `run_nsga2_power_balance` — itu lengan pembanding.

Gunakan constraint-domination Deb (2000), bukan penalty term:

1. Solusi layak selalu mengalahkan solusi tidak layak.
2. Dua solusi tidak layak: yang `total_violation` lebih kecil menang.
3. Dua solusi layak: Pareto-dominance biasa (pakai `dominates()` yang sudah ada).

Alasan memilih ini: tidak menambah hyperparameter (Anda sudah punya masalah λ),
dan sudah ada di literatur NSGA-II yang disitasi paper.

**Inisialisasi:** `SMART_START` kemungkinan tidak layak — periksa dan laporkan.
Jika tidak layak, seed populasi dengan sampel acak yang ditolak-sampai-layak
(rejection sampling; pada 4,2% keterterimaan, ~24 percobaan per individu — murah).
Catat berapa percobaan yang dibutuhkan.

### 2.3 `experiments/exp09_lore_constrained.py`

Jalankan **kedua lengan** dengan konfigurasi identik dari §0:

- **Lengan A (unconstrained):** panggil ulang `run_nsga2_power_balance` dengan seed
  yang sama. Verifikasi hasilnya cocok dengan `results/exp07_nsga2_power_balance.json`.
  Kalau tidak cocok, **berhenti dan laporkan** — itu berarti ada nondeterminisme
  yang harus diselidiki lebih dulu.
- **Lengan B (constrained):** `run_nsga2_lore_constrained`, seed sama.

Tulis ke `results/exp09_lore_constrained.json`.

### 2.4 Metrik perbandingan

Wajib dilaporkan:

| Metrik | Keterangan |
|---|---|
| **Cost of Lore Fidelity** | `min f₁ (constrained) − min f₁ (unconstrained)`, dengan CI |
| **Hypervolume** kedua front | Reference point sama untuk keduanya; nyatakan nilainya |
| Ukuran front akhir | Lengan A vs lengan B |
| Kelayakan front unconstrained | Berapa dari 13 solusi FASE 7 yang memenuhi Θ_lore, dan mana yang dilanggar |
| Status keterikatan per kendala | Untuk tiap L1–L18: mengikat atau tidak, pada front akhir |
| Matriks payoff berpasangan | Untuk solusi best-balance kedua lengan, n=20.000/sel, Wilson CI |

**Metrik utama paper adalah Cost of Lore Fidelity.** Kalau nilainya ~0, itu temuan
kuat ("kesetiaan naratif nyaris gratis"). Kalau besar, itu juga temuan kuat
("ada trade-off terukur"). Keduanya publishable — **jangan menyetel apa pun untuk
mendapat hasil tertentu.**

---

## 3. Acceptance Criteria

- [ ] `tests/test_lore_constraints.py`: ke-18 `g_k` diuji terhadap kasus yang diketahui.
      Minimal: `ga_balanced_params.json` → 17/18, hanya L4 dilanggar.
- [ ] Uji kelayakan direproduksi di dalam repo: 400.000 sampel acak seed-terkontrol
      menghasilkan tingkat keterterimaan ~4,2% (toleransi ±0,3%).
- [ ] Lengan A mereproduksi hasil FASE 7 persis, atau ketidakcocokan dilaporkan eksplisit.
- [ ] `results/exp09_lore_constrained.json` memuat kedua front + seluruh metrik §2.4.
- [ ] Setiap solusi di front constrained melewati `is_feasible()` — nol pelanggaran.
- [ ] Figure: Pareto front kedua lengan pada sumbu yang sama, dihasilkan dari JSON.
- [ ] Entri baru di `CLAIMS_LEDGER.md` untuk setiap klaim RQ3.

---

## 4. Yang TIDAK boleh dilakukan agent

Hentikan dan tanyakan ke manusia jika tergoda melakukan salah satu dari ini:

1. **Mengubah `BOUNDS`** agar Θ_lore lebih besar atau lebih kecil.
2. **Mengubah `ga_balanced_params.json`** agar memenuhi L4.
3. **Melonggarkan atau menghapus kendala** karena optimizer kesulitan.
4. **Mengubah `run_nsga2_power_balance`** — itu lengan pembanding, harus utuh.
5. **Mengubah mekanik simulator apa pun** — membatalkan seluruh E1–E8.
6. **Menambah/mengubah kendala lore.** Justifikasi naratif adalah wewenang penulis.
7. Menjalankan ulang dengan seed berbeda karena hasilnya "kurang menarik".

---

## 5. Catatan untuk penulisan paper (bukan tugas agent)

- Tujuh kendala (L3, L7, L10, L11, L13, L15, L18) tidak mengikat pada `BOUNDS` saat ini.
  Laporkan sebagai tabel dengan kolom status, jangan disajikan seolah semuanya aktif.
- L4 adalah konflik naratif-mekanis yang nyata: senjata Mahadewa kalah dari panah manusia
  pada solusi seimbang. Ini contoh konkret terbaik untuk memotivasi RQ3.
- Tegangan L4 ↔ L17 mempersempit `stw_yudhistira_dmg` dari [20,45] jadi [20,44] —
  contoh bagus bahwa kendala naratif berinteraksi, bukan sekadar bertumpuk.
