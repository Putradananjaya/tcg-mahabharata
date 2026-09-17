# Mahabharata TCG Research Dashboard (Angular CLI Edition)

Dashboard interaktif ini dibangun menggunakan **Angular 18** dengan prinsip **Clean Architecture (Domain, Data, & Presentation Layer)**.

> ⚠️ **Bukan sumber hasil paper.** App ini adalah demo/showcase UI terpisah dari pipeline riset di
> `src/`/`experiments/`/`results/`. Battle simulator-nya reimplementasi TypeScript sendiri yang
> mekaniknya berbeda dari engine Python (lihat `src/simulator/rules_spec.md` §4.4), dan panel
> "GA/PSO Balancer" beserta chart di tab Analytics memakai data ilustratif/hardcoded, bukan hasil
> komputasi nyata. Untuk klaim yang bisa dikutip di paper, selalu rujuk `CLAIMS_LEDGER.md` dan
> file di `results/`/`figures/`, bukan angka yang tampil di dashboard ini.

---

## 🏗️ Struktur Arsitektur (Clean Architecture)

Proyek ini dipisahkan secara ketat untuk menjamin modularitas dan kepatuhan akademis:
- **`core/domain/`**: Berisi objek data model inti TCG (`Card`, `PlayerState`, `GameLog`).
- **`core/usecases/`**: Mendefinisikan kontrak layanan bisnis abstrak (`BattleSimulatorService`, `BalanceOptimizerService`, `AnalyticsService`).
- **`data/repositories/`**: Implementasi konkrit dari kontrak Use-Cases (termasuk simulator TCG berbasis giliran murni TS, pensimulasi konvergensi GA/PSO, dan datasets riset Chart.js).
- **`presentation/components/`**: Standalone components yang merepresentasikan antarmuka visual (Simulator pertempuran, slider parameter, grafik interaktif, dan flowchart operasi).

---

## 🚀 Cara Menjalankan Dashboard

Karena sandbox IDE membatasi koneksi internet keluar (outbound network), silakan jalankan perintah instalasi dan kompilasi ini **langsung melalui terminal sistem operasi Anda**:

### 1. Masuk ke direktori dashboard
```bash
cd dashboard
```

### 2. Instalasi Node Dependencies
Instal pustaka Angular dan Chart.js yang dibutuhkan:
```bash
npm install
```

### 3. Jalankan Server Dev Lokal
Jalankan server pengembangan Angular:
```bash
npm run start
```

Setelah server aktif, buka peramban Anda dan kunjungi:
👉 **`http://localhost:4200/`**

---

## 📈 Fitur Utama Dashboard
1. **Live Battle Simulator:** Simulator TCG interaktif (engine TS terpisah dari Python, lihat catatan di atas) dengan HP bar animasi, log pertempuran detail, dan mode *Auto-Play*.
2. **Triangular Auto-Balancer Sliders:** Slider parameter untuk penyetelan manual statistik kartu, dilengkapi tombol **animasi demo** (bukan komputasi nyata) yang mengilustrasikan konvergensi GA & PSO.
3. **Interactive Visual Analytics:** Chart ilustratif (data hardcoded, lihat `analytics.impl.ts`) untuk kurva sensitivitas, waktu komputasi, power spikes faksi, dan clustering arketipe — bukan output nyata dari `results/`.
4. **Flow & Schema Diagram:** Penjelasan skema JSON/CSV dan alur komputasi data pipeline.
