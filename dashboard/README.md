# Mahabharata TCG Research Dashboard (Angular CLI Edition)

Dashboard interaktif ini dibangun menggunakan **Angular 18** dengan prinsip **Clean Architecture (Domain, Data, & Presentation Layer)** untuk memvisualisasikan seluruh pencapaian riset penyeimbangan faksi Mahabharata TCG.

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
1. **Live Battle Simulator:** Simulator TCG interaktif dengan HP bar animasi, log pertempuran detail, dan mode *Auto-Play*.
2. **Triangular Auto-Balancer Sliders:** Slider parameter yang memungkinkan penyetelan manual statistik kartu, dilengkapi tombol animasi simulasi komputasi GA & PSO.
3. **Interactive Visual Analytics:** Menampilkan visualisasi kurva sensitivitas, kestabilan konvergen, power spikes faksi, dan hasil clustering arketipe K-Means menggunakan Chart.js.
4. **Flow & Schema Diagram:** Penjelasan skema JSON/CSV dan alur komputasi data pipeline.
