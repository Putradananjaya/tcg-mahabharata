# Aturan Kerja Repo — Wajib Dibaca Setiap Sesi

Repo ini adalah kode pendukung paper akademik. Setiap angka yang dihasilkan
akan di-review peer reviewer. Konsekuensinya berbeda dari software biasa.

Rencana kerja: `docs/IMPLEMENTATION_PLAN.md`. Spec fase aktif: `docs/FASE_E9_SPEC.md`.

## ATURAN 1 — Jangan pernah memfabrikasi atau mensintesis data hasil

DILARANG:
- Membuat data dummy, mock, atau sintetis untuk mengisi figure/tabel hasil
- Meng-hardcode angka ke dalam script pembuat figure
- Fungsi yang mengembalikan "hasil contoh" saat komputasi gagal atau lambat
- Menyesuaikan parameter, seed, atau filter data agar hasil terlihat rapi
- Memilih subset hasil tanpa alasan metodologis yang ditulis eksplisit

Jika eksperimen gagal atau memberi hasil tak terduga: laporkan apa adanya
dan berhenti. Hasil negatif adalah output yang valid dan diinginkan.

Data sintetis hanya boleh untuk unit test, di `tests/`, berawalan
`synthetic_` atau `fixture_`. Tidak pernah masuk `results/`.

## ATURAN 2 — Reproducibility
- Satu eksperimen = satu script + satu config YAML + satu artifact di `results/`
- Setiap run mencatat: master seed, git commit hash, versi library, timestamp
- Notebook hanya untuk eksplorasi, bukan sumber kebenaran
- Semua figure dihasilkan script dari `results/`; tidak ada edit manual

## ATURAN 3 — Ketidakpastian
- Minimal 10 seed untuk hasil stokastik; laporkan `mean ± 95% CI`
- Win rate memakai Wilson score interval
- Klaim "A lebih baik dari B" butuh uji signifikansi dan effect size
- Setiap hasil menyertakan n

## ATURAN 4 — Setiap klaim butuh baseline
Surrogate vs constant predictor. Optimizer vs random search.
Agen vs random dan greedy.

## ATURAN 5 — Keputusan yang BUKAN wewenang agent
Berhenti dan tanyakan ke manusia jika menemui:
1. Definisi domain (mis. `Sasmita` = prize count atau HP)
2. Kendala lore — rumusan dan justifikasi naratif
3. Bobot reward dan nilai lambda
4. Perubahan aturan simulator (membatalkan semua hasil sebelumnya)
5. Perubahan pada spec atau IMPLEMENTATION_PLAN
6. Membuang atau memfilter data

## ATURAN 6 — Cara kerja per sesi
1. Kerjakan hanya satu fase yang ditugaskan
2. Audit kode yang ada dulu; struktur di plan adalah target, bukan kondisi kini
3. Jalankan acceptance criteria, tunjukkan output
4. Update checkbox plan dan `CLAIMS_LEDGER.md`
5. Jangan mulai fase berikutnya tanpa instruksi

## ATURAN 7 — Gaya kode
- Python 3.11+, type hints, docstring pada fungsi publik
- Tidak ada magic number; konstanta ke config
- Modul metrik dan statistik wajib punya unit test
- Fungsi statistik diuji terhadap nilai referensi yang diketahui

## Kalimat yang harus memicu kewaspadaan
Jika Anda menulis atau memikirkan salah satu dari ini, berhenti dan tanya:
- "Saya buat data contoh dulu supaya pipeline-nya jalan"
- "Angkanya saya sesuaikan agar sesuai paper"
- "Ini kira-kira nilainya sekitar..."
- "Untuk sementara saya hardcode dulu"
- "Hasilnya aneh, saya coba seed lain"