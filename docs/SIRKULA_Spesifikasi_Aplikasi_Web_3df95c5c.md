# SIRKULA — Spesifikasi Lengkap Aplikasi Web (PRD + Blueprint Teknis)

> **Sistem Informasi Verifikasi Aliran Sampah Berbasis Neraca Massa dan Deteksi Anomali untuk Mengukur Tingkat Daur Ulang Riil pada TPS3R**
>
> Dokumen ini adalah satu-satunya sumber kebenaran untuk membangun aplikasi. Targetnya bukan demo: aplikasi harus **siap dipakai petugas TPS3R, pengepul, pengelola, dan dinas lingkungan hidup di lapangan**, dihosting publik, dengan data nyata.
> Basis: *Dokumen Induk SIRKULA — LKTIN PWT XIV 2027*. Jika ada konflik antara dokumen ini dan dokumen induk, **dokumen induk menang** untuk model ilmiah (rumus, aturan R1–R7, definisi VRR), dan dokumen ini menang untuk detail rekayasa.

**Isi dokumen:** 0 Aturan wajib · 1 Ringkasan produk · 2 Keputusan desain · 3 Peran dan RBAC · 4 Arsitektur dan stack · 5 Model data · 6 Mesin neraca massa dan anomali · 7 Modul fitur + kriteria penerimaan · 8 Offline dan sinkronisasi · 9 Audit trail · 10 Keamanan dan privasi · 11 UI/UX · 12 Halaman publik dan legal · 13 Mode riset dan demo · 14 Non-fungsional · 15 Pengujian · 16 Deployment · 17 Fase build · 18 Data seed · 21 Daftar periksa go-live · Lampiran A (SQL) · B (kode mesin) · C (kontrak Edge Function) · D (keputusan terbuka) · E (keterlacakan)

---

## 0. ATURAN WAJIB UNTUK AI BUILDER (BACA PERTAMA)

Aturan ini tidak boleh dilanggar di fase mana pun.

1. **Bukan prototype tampilan.** Setiap layar harus terhubung ke database sungguhan. Dilarang data hardcode di komponen. Data contoh hanya boleh lewat skrip seed dan tenant demo (bagian 18).
2. **Backend = Supabase** (PostgreSQL + Auth + Storage + Edge Functions). Frontend = React + TypeScript + Vite + Tailwind. Jangan menaruh secret apa pun di kode frontend. Hanya `SUPABASE_URL` dan `SUPABASE_ANON_KEY` yang boleh ada di klien.
3. **Offline-first adalah inti, bukan tambahan.** Petugas harus bisa mencatat satu hari kerja penuh tanpa sinyal (bagian 8). Semua id dibuat di perangkat (UUID v4).
4. **Data tidak pernah ditimpa diam-diam.** Perubahan data bobot dilakukan lewat *koreksi* dengan alasan wajib. Setiap perubahan tercatat di `event_log` berantai hash lewat **trigger database**, bukan kode klien.
5. **Kebijakan keamanan di database (Row Level Security) wajib aktif di semua tabel.** Frontend hanya kenyamanan, bukan penjaga keamanan.
6. **Mesin neraca massa dan deteksi anomali = fungsi murni TypeScript** yang dipakai bersama oleh klien (pratinjau offline) dan Edge Function (hasil resmi). Wajib ada unit test dengan vektor uji di bagian 6.7.
7. **Aturan statistik, bukan machine learning.** Dilarang memakai LLM atau API AI di v1. Penjelasan anomali dibuat dari templat teks berdasarkan aturan yang dilanggar.
8. **Bahasa antarmuka: Indonesia baku, sederhana.** Identifier kode (tabel, kolom, fungsi) memakai bahasa Inggris snake_case atau camelCase.
9. **Bahasa netral soal anomali.** UI memakai kata "tidak konsisten", "perlu dicek", "belum terverifikasi". **Dilarang** memakai kata "curang", "fraud", "korupsi", "bohong" di UI, laporan, atau notifikasi.
10. **Dilarang klaim berlebihan di UI atau landing page:** tidak boleh menulis "anti-kecurangan", "100% akurat", "blockchain", "AI". Tulis fakta: "pencatatan berantai hash", "pemeriksaan konsistensi massa".
11. **Tanpa pendaftaran publik.** Akun dibuat oleh pengelola atau admin. Nonaktifkan self sign-up di Supabase Auth.
12. **Mobile-first untuk petugas, desktop-first untuk dinas dan pengelola.** Satu basis kode, satu PWA.
13. **Setiap fitur punya kriteria penerimaan (acceptance criteria).** Fitur dianggap selesai hanya jika kriterianya lolos.
14. Jika spesifikasi ambigu, pilih opsi yang **paling aman bagi integritas data**, lalu catat asumsi di `docs/ASSUMPTIONS.md`.

---

## 1. RINGKASAN PRODUK

| Item | Isi |
|---|---|
| Nama | **SIRKULA** |
| Tagline | *Daur ulang yang terbukti.* |
| Satu kalimat | Aplikasi yang memeriksa apakah angka daur ulang sebuah TPS3R benar-benar masuk akal, dengan mencocokkan massa masuk, dipilah, dikirim, dan diterima, lalu menghasilkan satu angka utama: **Verified Recycling Rate (VRR)**. |
| Masalah | Angka daur ulang fasilitas umumnya berasal dari laporan pengelola tanpa pemeriksaan silang. Kebijakan bertumpu pada data yang sulit diaudit. |
| Pembeda | (1) Verifikasi, bukan sekadar pencatatan. (2) Konfirmasi dua pihak (pengirim dan penerima). (3) Satu metrik keputusan: **Gap = RR − VRR**. (4) Aturan anomali transparan dan bisa dijelaskan. (5) Offline-first untuk kondisi lapangan. |
| Bukan | Bukan aplikasi bank sampah. Bukan alat penuduh kecurangan. Bukan pengganti audit lapangan atau timbangan tera. Bukan sistem yang sudah terintegrasi SIPSN. |
| Pengguna | Petugas TPS3R, petugas angkut, penerima (pengepul/pengolah/TPA), pengelola TPS3R, staf dinas LH, admin sistem. |
| Platform | PWA (dipasang dari browser, tanpa toko aplikasi), responsif HP dan laptop. |
| Cakupan verifikasi | Sampai **serah terima pertama (first-hop)** ke pihak penerima yang mengonfirmasi. Tidak menjamin penerima benar-benar mendaur ulang. Ini harus tertulis jelas di halaman Metode. |

### 1.1 Prinsip produk

1. **Cepat dicatat.** Satu batch tercatat dengan sedikit ketukan. Jumlah langkah dan waktu diukur (untuk evaluasi E3).
2. **Sulit dimanipulasi sepihak.** Berat yang dihitung untuk VRR adalah berat **konfirmasi penerima**, bukan klaim pengirim.
3. **Bisa dijelaskan.** Setiap tanda bahaya menunjuk aturan, nilai, dan ambang yang dipakai.
4. **Jujur pada keterbatasan.** Sistem menampilkan cakupan data dan tingkat keyakinan di samping angka utama.
5. **Netral.** Inkonsistensi data adalah alasan untuk mengecek, bukan kesimpulan.

---

## 2. KEPUTUSAN DESAIN YANG DIKUNCI

| # | Keputusan | Alasan | Konsekuensi |
|---|---|---|---|
| D1 | PWA offline-first dengan antrean operasi (outbox) di IndexedDB | Sinyal lapangan lemah | Perlu penanganan sinkron dan konflik (bagian 8) |
| D2 | Pengiriman fisik dimodelkan sebagai **shipment** dengan satu atau lebih **shipment_lines** (alokasi ke batch) | Penerima menimbang satu muatan, bukan per batch | Kasus 1 batch = 1 pengiriman identik dengan model dokumen induk |
| D3 | **Konfirmasi buta**: penerima mengisi berat terima **sebelum** melihat berat kirim | Mengurangi bias jangkar | Halaman konfirmasi tidak menampilkan W_k |
| D4 | Konfirmasi penerima lewat **tautan sekali pakai** (tanpa akun) | Penerima enggan membuat akun | Token di-hash di DB, punya masa berlaku, dibatasi laju |
| D5 | Aturan statistik robust (median, MAD), tanpa ML | Data kecil, harus bisa dijelaskan | Sensitivitas terhadap kesalahan kecil terbatas, diakui di UI |
| D6 | Audit trail berantai hash **per fasilitas**, dihitung oleh trigger DB | Klien tidak bisa memalsukan | Bukan blockchain. Pemilik akses penuh DB tetap bisa menghitung ulang, mitigasi: jangkar hash mingguan lewat email |
| D7 | Ambang dibekukan dan **berversi** (`threshold_sets`) | Hasil lama harus bisa direproduksi, dan ambang tidak disetel pada data uji | Ada layar kalibrasi dan pembekuan |
| D8 | R1–R4 memengaruhi status verifikasi. R5–R7 hanya peringatan | Sesuai definisi verifikasi di dokumen induk | VRR hanya dipengaruhi (a) konfirmasi, (b) d_k ≤ τ_d, (c) batch lolos R1/R2 |
| D9 | Dua angka VRR ditampilkan: **VRR ketat** (headline) dan **VRR dengan peninjauan** | Pengelola bisa menjelaskan anomali, tetapi penjelasan tidak otomatis memulihkan status | Lihat 6.5 |
| D10 | Evaluasi batch hanya setelah batch **ditutup** | Mencegah tanda palsu pada batch yang masih berjalan | Batch terbuka hanya mendapat pratinjau "sementara" |
| D11 | Pengelompokan basis ambang R1 per **kategori dominan** batch (kategori dengan berat pilah terbesar), fallback gabungan bila n kecil | Dokumen induk meminta ambang per kategori, sedangkan batch bercampur | Dicatat sebagai keputusan di Bab III naskah |
| D12 | Tidak ada hapus keras. Pembatalan = status `void` + alasan | Integritas riwayat | Semua daftar menyembunyikan `void` secara default |

---

## 3. PERAN DAN HAK AKSES (RBAC)

### 3.1 Peran

| Peran (`role`) | Siapa | Perangkat | Cakupan data |
|---|---|---|---|
| `petugas_tps3r` | Petugas timbang dan pilah | HP Android, sering offline | Fasilitasnya sendiri |
| `petugas_angkut` | Pengangkut | HP Android | Pengiriman yang ditugaskan di fasilitasnya |
| `pengelola` | Pengelola TPS3R | HP / laptop | Fasilitasnya sendiri |
| `dinas` | Staf dinas LH | Laptop | Semua fasilitas dalam `org_id`-nya, **baca saja** |
| `admin` | Admin sistem / tim peneliti | Laptop | Semua (lintas organisasi), tidak bisa mengubah `event_log` |
| *(non-akun)* penerima | Pengepul, pengolah, TPA | HP, tautan | Hanya satu pengiriman lewat token |

### 3.2 Matriks izin (C = buat, R = baca, U = ubah/koreksi, X = tidak boleh)

| Sumber daya | petugas_tps3r | petugas_angkut | pengelola | dinas | admin |
|---|---|---|---|---|---|
| batch | C R, U (koreksi dengan alasan) | R (terkait) | R, U (koreksi), void | R | R |
| batch_items / pilah | C R U(koreksi) | X | R | R | R |
| shipments / lines | C R | C R (ditugaskan) | R, void | R | R |
| confirmations | R | R | R | R | R |
| anomalies | R | X | R, **tinjau** | R | R |
| threshold_sets | X | X | R, buat draft | R | R, beku, global |
| period_reports | X | X | R, **tutup periode** | R | R |
| event_log | X | X | R | R | R |
| pengguna | X | X | C R U (fasilitasnya) | X | C R U |
| partners (penerima) | C R | R | C R U | R | C R U |
| mode riset (baseline, SUS, simulasi, ekspor) | X | X | R (miliknya) | R | **penuh** |

Semua kontrol dipaksakan oleh **RLS** (lihat Lampiran A), bukan hanya disembunyikan di UI.

---

## 4. ARSITEKTUR DAN TEKNOLOGI

### 4.1 Diagram

```
 ┌───────────────────────────── KLIEN (PWA, satu basis kode) ─────────────────────────────┐
 │  Petugas (HP, offline)   Pengelola (HP/Laptop)   Dinas (Laptop)   Penerima (tautan)  │
 │  React + TS + Tailwind · Service Worker (Workbox) · IndexedDB (Dexie) · Outbox sync     │
 │  Engine murni TS (pratinjau offline)                                                    │
 └──────────────┬───────────────────────────────────────────────────┬────────────────────┘
                │ HTTPS (supabase-js, JWT)                          │ HTTPS (token sekali pakai)
 ┌──────────────▼───────────────────────── SUPABASE ───────────────▼────────────────────┐
 │  Auth · PostgreSQL (RLS, trigger hash-chain, RPC) · Storage (bucket privat `evidence`) │
 │  Edge Functions: sync-push · sync-pull · confirm-get · confirm-submit · engine-run     │
 │                  cron-daily · report-close · admin-user · export-data · anchor-hash    │
 │  Email: Resend (jangkar hash mingguan, notifikasi batas waktu)                         │
 └────────────────────────────────────────────────────────────────────────────────────────┘
        Hosting frontend: Cloudflare Pages atau Vercel · Region Supabase: Singapore
```

### 4.2 Stack

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Framework | React 18 + TypeScript (strict) + Vite | |
| Styling | Tailwind CSS + komponen shadcn/ui | Token desain di bagian 11 |
| Routing | React Router v6, `lazy()` per peran | Code-splitting wajib |
| State server | TanStack Query | Cache + invalidasi |
| State lokal | Zustand (kecil) | Sesi, filter, UI |
| Offline DB | **Dexie** (IndexedDB) | Outbox + cache baca |
| PWA | `vite-plugin-pwa` (Workbox, `injectManifest`) | Precache shell, runtime cache API baca |
| Form | react-hook-form + zod | Validasi bersama klien dan Edge Function |
| QR | `qrcode` (buat) + `@zxing/browser` atau `qr-scanner` (pindai) | Fallback kode manual 6 karakter |
| Peta | `react-leaflet` + OpenStreetMap | Atribusi OSM wajib tampil |
| Grafik | Recharts | Maksimal 2 grafik per halaman analitik |
| PDF | `jspdf` + `jspdf-autotable` | Laporan periodik |
| CSV | `papaparse` | Ekspor dan impor |
| Tanggal | `date-fns` + locale `id` | Zona waktu tampilan: WIB/WITA/WIT per fasilitas |
| Uji | Vitest (unit), Playwright (e2e) | Bagian 15 |
| Pemantauan | Sentry (error) + log Supabase | PII disaring |
| Email | Resend lewat Edge Function | |

### 4.3 Struktur repo

```
sirkula/
├─ apps/web/                      # PWA
│  ├─ src/
│  │  ├─ app/                     # router, provider, shell per peran
│  │  ├─ features/
│  │  │  ├─ batch/  shipment/  confirm/  stock/  anomalies/
│  │  │  ├─ periods/  dashboard/  audit/  partners/  users/
│  │  │  ├─ thresholds/  research/  reports/  auth/
│  │  ├─ lib/
│  │  │  ├─ supabase.ts  db.ts(Dexie)  outbox.ts  sync.ts
│  │  │  ├─ format.ts (angka/tanggal id-ID)  image.ts (kompres foto)
│  │  ├─ components/  (UI dasar)
│  │  └─ sw.ts                    # service worker
│  └─ public/ (manifest, ikon, offline.html)
├─ packages/engine/               # fungsi murni: balance, rules, metrics (+ tes)
├─ supabase/
│  ├─ migrations/                 # SQL berurutan (Lampiran A)
│  ├─ functions/                  # Edge Functions (Deno)
│  └─ seed/                       # seed kategori, ambang default, tenant demo
├─ docs/  (ASSUMPTIONS.md, RUNBOOK.md, PANDUAN_PETUGAS.md)
└─ .github/workflows/ci.yml
```

### 4.4 Variabel lingkungan

| Variabel | Lokasi | Keterangan |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend | publik |
| `VITE_SUPABASE_ANON_KEY` | frontend | publik, dilindungi RLS |
| `VITE_APP_ENV` | frontend | `production` / `staging` / `demo` |
| `VITE_SENTRY_DSN` | frontend | opsional |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions saja | **rahasia** |
| `TOKEN_PEPPER` | Edge Functions | rahasia, untuk hash token konfirmasi |
| `RESEND_API_KEY` | Edge Functions | rahasia |
| `MAIL_FROM` | Edge Functions | mis. `SIRKULA <noreply@domain>` |
| `APP_BASE_URL` | Edge Functions | untuk tautan konfirmasi |

---
## 5. MODEL DATA

SQL lengkap (tabel, enum, RLS, trigger) ada di **Lampiran A**. Bagian ini menjelaskan maknanya.

### 5.1 Entitas

| Tabel | Isi pokok | Catatan |
|---|---|---|
| `organizations` | id, nama, kode wilayah, tipe (`dinas`, `kampus`, `mandiri`) | Dinas membaca semua fasilitas di organisasinya |
| `facilities` | id, org_id, nama, tipe (`tps3r`, `bank_sampah`, `pengepul`, `pengolah`, `tpa`), provinsi, kab_kota, lat, lng, zona waktu, `is_demo`, `scale_resolution_kg` | Hanya tipe `tps3r` yang memakai alur penuh |
| `profiles` | id (= auth.users.id), nama samaran, username, role, facility_id, org_id, aktif | Nama tampil = pseudonim di laporan |
| `material_categories` | id, kode, nama, toleransi susut default | Awal: organik, plastik, kertas, logam, kaca, residu |
| `partners` | id, facility_id (pemilik daftar), nama, tipe, telepon, aktif | Direktori penerima. Telepon dipakai untuk tautan WhatsApp |
| `batches` | id (UUID klien), facility_id, kode 6 karakter, sumber, `weight_in_total_kg` (M_in), foto timbangan, waktu masuk, status, petugas, `closed_at`, `remaining_stock_kg` (ΔS) | Status: `masuk` → `dipilah` → `ditutup` / `void` |
| `batch_items` | batch_id, category_id, `weight_sorted_kg`, `weight_in_est_kg` (opsional) | Hasil pilah per kategori |
| `onsite_processing` | batch_id, jenis (`kompos`, `maggot`, `lainnya`), berat | Sumber **M_org** |
| `shipments` | id, facility_id, partner_id, tujuan (`daur_ulang`, `organik_olah`, `residu`), waktu kirim, petugas, status (`dikirim`, `dikonfirmasi`, `ditolak`, `kedaluwarsa`, `void`) | W_k = jumlah `shipment_lines` |
| `shipment_lines` | shipment_id, batch_id, category_id, berat_kg | Alokasi muatan ke batch |
| `confirmation_tokens` | shipment_id, `token_hash`, kedaluwarsa, dipakai, jumlah percobaan | Token mentah tidak pernah disimpan |
| `confirmations` | shipment_id (unik), `weight_received_kg` (W'_k), status, metode, info perangkat, foto, catatan | Satu per pengiriman |
| `stock_snapshots` | facility_id, tanggal, category_id, berat | Dipakai untuk ΔS periode dan pemeriksaan harian |
| `event_log` | id, facility_id, seq, entitas, entity_id, aksi, nilai_lama, nilai_baru, aktor, waktu, waktu klien, `prev_hash`, `hash` | **Append-only**, per fasilitas |
| `threshold_sets` | id, scope (global/fasilitas), versi, status (`draft`, `beku`, `pensiun`), params JSON, statistik kategori JSON, rentang kalibrasi, waktu beku | Ambang beku tidak boleh diubah |
| `anomalies` | id, batch_id / shipment_id, kode aturan, skor, detail JSON, severity, status, penyebab, peninjau, `threshold_set_id`, `engine_version`, `superseded_at` | Hasil mesin |
| `reported_figures` | facility_id, periode, berat daur ulang yang dilaporkan | Basis **RR**, diisi pengelola |
| `period_reports` | facility_id, periode, total_in, verified, rr, vrr, vrr_with_review, gap, cakupan JSON, threshold_set_id, status, `snapshot_hash` | Keluaran untuk dinas |
| `hash_anchors` | facility_id, seq_upto, hash, kanal, waktu | Jangkar mingguan |
| `pilot_baseline` | facility_id, tanggal, kategori, berat, sumber | Pencatatan dasar manual (Fase A pilot) |
| `reference_weighings` | batch_id, berat timbangan fasilitas, berat timbangan referensi, penimbang | Untuk E1 dan kalibrasi τ |
| `sus_responses` | kode peserta, peran, jawaban[10], skor, persetujuan | E6 |
| `usage_metrics` | user, aksi, mulai, selesai, jumlah ketukan, perangkat | E3 (waktu dan langkah per batch) |
| `sync_ops` | client_op_id (PK), device_id, user, status, hasil, konflik | Idempotensi sinkron |
| `consents` | user_id, versi dokumen, waktu | Persetujuan privasi |

### 5.2 Definisi bobot dan ΔS (penting)

- **M_in** = `batches.weight_in_total_kg`: berat total sampah tercampur saat tiba.
- **M_rec** = jumlah `shipment_lines.weight_kg` batch tersebut dengan tujuan `daur_ulang`.
- **M_org** = `onsite_processing` batch itu **+** `shipment_lines` bertujuan `organik_olah`.
- **M_res** = `shipment_lines` bertujuan `residu`.
- **ΔS** = `batches.remaining_stock_kg`: sisa batch yang masih tersimpan di fasilitas saat batch ditutup (boleh 0). Petugas wajib mengisinya saat menutup batch.
- `Σ weight_sorted_kg` tidak masuk rumus penutupan. Ia dipakai untuk validasi input (peringatan jika melebihi M_in) dan penentuan kategori dominan.

### 5.3 Alur status

```
batch:    masuk ──(isi pilah)──▶ dipilah ──(isi keluaran + stok sisa, tutup)──▶ ditutup
             └───────────────────────── void (dengan alasan) ◀────────────────────┘
shipment: dikirim ──(penerima isi W')──▶ dikonfirmasi
             ├──(penerima: tidak sesuai/menolak)──▶ ditolak
             ├──(lewat batas waktu tanpa konfirmasi)──▶ kedaluwarsa (memicu R4)
             └──▶ void
```

---

## 6. SPESIFIKASI MESIN NERACA MASSA, ANOMALI, DAN METRIK

Paket `packages/engine`: fungsi murni tanpa akses jaringan atau DB. Versi mesin (`ENGINE_VERSION`, semver) disimpan di setiap hasil.

### 6.1 Notasi (sama dengan dokumen induk)

`M_in, M_rec, M_org, M_res, ΔS, e, e_rel, W_k, W'_k, d_k`

### 6.2 Neraca massa per batch (hanya batch `ditutup`)

```
e      = M_in − (M_rec + M_org + M_res + ΔS)
e_rel  = e / M_in            // jika M_in = 0 → batch tidak valid (tolak saat input)
```

Contoh dokumen induk (angka rekaan): M_in=100, M_rec=38, M_org=22, M_res=30, ΔS=4 ⇒ e=6, e_rel=0,06.

### 6.3 Konfirmasi dua pihak (per shipment)

```
W_k  = Σ shipment_lines.weight_kg
d_k  = |W_k − W'_k| / W_k
```

Pengiriman **terverifikasi** jika semua benar:
- (a) ada konfirmasi berstatus `diterima`,
- (b) `d_k ≤ τ_d`,
- (c) semua batch pada `shipment_lines` **tidak punya anomali R1 atau R2 berstatus aktif** (lihat 6.5),
- (d) tujuan = `daur_ulang` (untuk masuk pembilang VRR).

Berat yang dihitung untuk VRR adalah **W'_k**.

### 6.4 Aturan anomali

| Kode | Nama | Kondisi tanda | Parameter | Severity | Memengaruhi verifikasi |
|---|---|---|---|---|---|
| R1 | Closure error di luar rentang wajar | `|z(e_rel)| > z_cutoff` terhadap distribusi kelompok kategori dominan | median, MAD per kelompok, `z_cutoff`=3,5 | tinggi | Ya (batch) |
| R2 | Closure error negatif | `e_rel < −τ_neg` | `τ_neg` dari akurasi timbangan referensi | tinggi | Ya (batch) |
| R3 | Selisih dua pihak | `d_k > τ_d` | `τ_d` dari uji awal timbangan | tinggi | Ya (pengiriman) |
| R4 | Belum dikonfirmasi | tidak ada konfirmasi setelah `ack_timeout_hours` | default 72 jam, disepakati dengan pengelola | sedang | Ya (pengiriman) |
| R5 | Pola harian tidak wajar | z robust total masuk harian terhadap median bergulir 28 hari, minimal 14 hari riwayat | median, MAD | rendah | Tidak |
| R6 | Data tidak lengkap | batch ditutup tanpa foto timbangan / tanpa waktu / tanpa catatan keluaran / pengiriman tanpa lines | aturan pasti | sedang | Tidak |
| R7 | Preferensi angka bulat | proporsi bobot berakhir 0 atau 5 di atas pembanding (uji binomial satu sisi, p < 0,01, n ≥ 30 per petugas/periode, disesuaikan `scale_resolution_kg`) | opsional, `enabled=false` default | info | Tidak |

**Skor z robust (R1, R5):**

```
z_i = 0.6745 · (x_i − median(x)) / MAD(x)
tandai jika |z_i| > 3.5   // acuan Iglewicz & Hoaglin; tim mengecek rujukan asli untuk Bab III
```

**Kasus tepi (wajib ditangani dan diuji):**
- `MAD = 0`: pakai `1.253314 × MeanAD` sebagai pengganti penyebut (varian Iglewicz–Hoaglin). Jika `MeanAD` juga 0, jangan tandai R1/R5 dan catat "sebaran nol".
- `n < min_n` (default `min_n = 20` per kelompok): gabungkan kelompok (pooled). Jika pooled tetap `< min_n`, R1 **tidak dijalankan**, UI menampilkan lencana "Ambang belum terkalibrasi", dan hanya R2/R3/R4/R6 yang aktif dengan nilai ambang sementara (`provisional=true`).
- Nilai `provisional` boleh diubah admin sebelum dibekukan. Layar mana pun yang menampilkan hasil dengan ambang sementara menampilkan peringatan kuning permanen.
- `M_in` sangat kecil (< 1 kg): jangan jalankan R1 (rasio tidak stabil), cukup R2 dan R6.
- Pembulatan: hitung dengan `numeric` penuh, tampilkan 1–2 desimal. Jangan membulatkan sebelum membandingkan ambang.

### 6.5 Status peninjauan anomali dan dampaknya

| Status | Arti | Efek pada VRR ketat | Efek pada VRR dengan peninjauan |
|---|---|---|---|
| `open` | Belum ditinjau | dikecualikan | dikecualikan |
| `dikoreksi` | Ada koreksi data (event koreksi tercatat), mesin dijalankan ulang | ikut hasil hitung ulang | ikut hasil hitung ulang |
| `dijelaskan` | Pengelola memilih penyebab sah (salah timbang, susut, kadar air) tanpa koreksi data | **tetap dikecualikan** | **dihitung** |
| `tidak_terjelaskan` | Sudah ditinjau, penyebab tidak ditemukan | dikecualikan | dikecualikan |

Penyebab (`cause`) pilihan tetap: `salah_timbang`, `susut_alami`, `kadar_air`, `salah_input`, `kesalahan_alat`, `lainnya` (wajib catatan teks minimal 10 karakter). Peninjau tidak boleh sama dengan petugas pencatat batch tersebut jika fasilitas punya lebih dari satu akun peninjau (prinsip dua mata). Jika hanya ada satu akun, tampilkan peringatan.

### 6.6 Metrik periode

```
RR    = reported_recycled_kg / Σ M_in(b)              // angka laporan pengelola, periode sama
VRR   = Σ W'_k (k ∈ V) / Σ M_in(b)                    // V = pengiriman daur ulang terverifikasi (6.3)
VRR_p = VRR + (tambahan dari status 'dijelaskan')     // VRR dengan peninjauan
Gap   = RR − VRR                                      // headline
```

Penyebut = batch yang **ditutup** dalam periode. Pengiriman yang belum terkonfirmasi di akhir periode tetap masuk periode batchnya dan dihitung tidak terverifikasi (R4 bila lewat waktu).

**Metadata cakupan wajib** di setiap laporan: jumlah batch, % batch tertelusuri (masuk → keluar → terkonfirmasi), % pengiriman terkonfirmasi, jumlah anomali per kode, apakah ambang sementara atau beku, versi mesin, `n` data kalibrasi.

**Pembacaan Gap (templat teks, pakai persis):**
- Gap kecil (|Gap| < 0,05, nilai ini konfigurasi): "Laporan konsisten dengan bukti pada periode ini."
- Gap positif besar: "Laporan melampaui bukti yang terverifikasi. Ini alasan untuk pemeriksaan lanjut, bukan kesimpulan adanya pelanggaran."
- Gap negatif: "Fasilitas melaporkan lebih rendah dari bukti, biasanya karena pencatatan lama yang tidak lengkap."
- Cakupan rendah (< 60% batch tertelusuri): tambahkan "Cakupan data masih rendah, hasil belum dapat dibaca sebagai gambaran utuh."

### 6.7 Vektor uji wajib (Vitest)

| Uji | Input | Harapan |
|---|---|---|
| Neraca contoh | M_in 100; rec 38; org 22; res 30; ΔS 4 | e=6; e_rel=0,06 |
| Neraca negatif | M_in 100; keluar total 108; ΔS 0 | e=−8; e_rel=−0,08; R2 menyala bila τ_neg=0,02 |
| d_k | W=100; W'=94 | d_k=0,06; R3 menyala bila τ_d=0,05, tidak bila τ_d=0,10 |
| z robust | x=[10,12,11,13,12,50] | median=12; MAD=1; z(50)=25,6 (|z|>3,5 → tandai); z(13)=0,67 |
| MAD nol | x=[5,5,5,5,9]; uji z(9) | MAD=0 → pakai MeanAD; z(9)≈3,99; tidak crash |
| n kecil | 8 batch di satu kelompok | R1 tidak jalan, lencana "belum terkalibrasi" |
| VRR contoh | total masuk 1000; verified Σ W' 300; reported 450 | RR=0,45; VRR=0,30; Gap=0,15 |
| Konfirmasi tanpa batch lolos | pengiriman terkonfirmasi, batch punya R2 `open` | tidak masuk V |
| `dijelaskan` | R2 dijelaskan | VRR ketat tidak berubah, VRR_p bertambah |
| Idempoten | jalankan mesin dua kali pada data sama | hasil identik, tidak ada anomali ganda |

Seluruh angka di atas adalah **contoh uji**, bukan data nyata.

### 6.8 Kalibrasi dan pembekuan ambang (layar `/kelola/ambang`)

1. Sumber: `pilot_baseline` + batch fase pilot + `reference_weighings`.
2. Tombol **Hitung usulan**: median dan MAD `e_rel` per kelompok, `τ_neg` dan `τ_d` dari sebaran selisih timbangan referensi (usulan: persentil yang dipilih admin, mis. P95 selisih relatif, bisa diubah).
3. Pengelola/admin meninjau dan menyetujui → status `draft`.
4. **Bekukan**: set `status=beku`, simpan `frozen_at`, rentang data kalibrasi. Setelah beku, params tidak bisa diubah (trigger DB menolak).
5. Versi baru = baris baru. Hasil lama tetap menunjuk versi lamanya.
6. UI menampilkan: tanggal data kalibrasi, `n` per kelompok, nilai tiap ambang, siapa yang membekukan.
7. Aturan peringatan: bila ada batch evaluasi yang tanggalnya masuk rentang kalibrasi, beri catatan "data ini ikut membentuk ambang" (mencegah evaluasi sirkular).

---
## 7. MODUL FITUR DAN KRITERIA PENERIMAAN

Prioritas: **P0** wajib untuk pilot (siap lapangan), **P1** wajib untuk final lomba dan rilis publik, **P2** setelah itu. Kode F01–F16 mengacu ke dokumen induk.

### M1. Autentikasi dan akun (F01) — P0

- Login `username + kata sandi`. Username dipetakan ke email internal (`username@sirkula.app` atau domain proyek) agar petugas tanpa email tetap bisa masuk. Pengelola dan dinas boleh memakai email asli.
- Akun dibuat oleh pengelola (untuk petugas fasilitasnya) atau admin. Kata sandi sementara, **wajib ganti saat login pertama**. Kebijakan: min 10 karakter.
- Sesi panjang untuk petugas (refresh token). Aplikasi **tetap bisa dipakai offline walau token kedaluwarsa**; sinkron akan meminta login ulang tanpa menghapus antrean.
- Kunci cepat opsional di perangkat (PIN 4–6 digit, disimpan hash lokal) agar HP bersama tidak bebas dibuka. P1.
- Pengguna menyetujui Kebijakan Privasi dan Syarat saat login pertama (`consents`).
- Daftar pengguna: nonaktifkan, reset kata sandi, ubah peran (hanya pengelola/admin). Tidak ada hapus akun, hanya nonaktif.

**Kriteria penerimaan:** (1) akun tanpa email bisa login; (2) pengguna fasilitas A tidak dapat membaca satu baris pun milik fasilitas B walau memanggil API langsung (uji RLS); (3) self sign-up mati; (4) pengguna nonaktif tidak bisa sinkron.

### M2. Pencatatan batch (F02, F03) — P0

Layar petugas, urutan **stepper**: *Masuk → Pilah → Keluar → Tutup*.

**Langkah "Masuk":**
- Tombol besar **Batch Baru**. Sistem membuat UUID, kode 6 karakter (huruf besar tanpa 0/O/1/I), dan QR berisi `sirkula:b:<kode>`.
- Isian: sumber (pilihan: Permukiman, Pasar, Kawasan Komersial, Bank Sampah, Lainnya + nama bebas), **berat masuk total (kg)**, **foto timbangan** (kamera, wajib), waktu (otomatis, bisa diedit mundur paling jauh 24 jam dengan alasan).
- Foto dikompres di klien (maks sisi 1280 px, JPEG ~0,7, target ≤ 300 KB). EXIF lokasi dihapus kecuali pengelola mengaktifkan "catat lokasi".
- Input berat: keypad numerik besar, terima koma atau titik, validasi `> 0`, kelipatan `scale_resolution_kg` hanya sebagai **peringatan**, bukan penolakan.
- Cetak/tampilkan QR untuk ditempel (layar bisa dibagikan sebagai gambar). Pemindaian QR membuka batch (F02). Fallback: ketik kode 6 karakter.

**Langkah "Pilah":** (F04)
- Baris per kategori (kategori dari `material_categories`), isi berat hasil pilah. Tombol "Tambah kategori".
- Jumlah berat pilah ditampilkan berjalan; peringatan oranye bila melebihi `M_in × (1 + toleransi)`.
- Residu adalah kategori biasa.
- Pencatatan **organik diolah di tempat** (`onsite_processing`): jenis dan berat.

**Langkah "Keluar":** (F05) lihat M3.

**Langkah "Tutup":**
- Prasyarat: berat masuk ada, minimal satu catatan keluaran atau stok sisa, **stok sisa (ΔS) diisi** (angka 0 diperbolehkan tetapi harus eksplisit).
- Tombol **Tutup Batch** menampilkan ringkasan neraca: M_in, keluaran per tujuan, ΔS, e dan e_rel dengan label **"pratinjau sementara"** bila offline. Hasil resmi muncul setelah sinkron.
- Setelah ditutup, perubahan berat hanya lewat **Koreksi** (alasan wajib, tersimpan sebagai event).

**Kriteria penerimaan:** (1) batch dibuat offline dan setelah sinkron tidak duplikat walau sinkron diulang 5 kali; (2) tanpa foto timbangan batch tidak bisa ditutup; (3) jumlah ketukan dan waktu per batch tercatat di `usage_metrics`; (4) kode QR dan kode manual membuka batch yang sama; (5) koreksi tanpa alasan ditolak.

### M3. Pengiriman keluar dan konfirmasi dua pihak (F05, F06) — P0

**Membuat pengiriman (petugas):**
- Pilih **tujuan** (`daur_ulang`, `organik_olah`, `residu`), pilih **penerima** dari direktori `partners` (atau tambah cepat), pilih satu atau beberapa batch dan isi **alokasi berat per batch dan kategori**. Total = W_k.
- Foto muatan/timbangan kirim (wajib untuk `daur_ulang`).
- Sistem membuat **tautan konfirmasi sekali pakai** dan menampilkan tombol:
  1. **Kirim via WhatsApp** (buka `https://wa.me/<telepon>?text=...` dengan teks siap kirim tanpa berat kirim),
  2. Salin tautan, 3. Tampilkan QR agar penerima memindai langsung di lokasi.
- Masa berlaku default 72 jam (`ack_timeout_hours`). Tautan baru bisa diterbitkan ulang (token lama dicabut).

**Halaman konfirmasi penerima (publik, tanpa login) — `/k/:token`:**
- Mobile, bahasa sederhana, tanpa menu. Menampilkan: nama fasilitas pengirim, tanggal, jenis material, **tanpa berat kirim** (konfirmasi buta, D3).
- Isian: **berat yang diterima (kg)**, foto timbangan penerima (opsional, disarankan), catatan, dan pilihan **"Muatan tidak sesuai / tidak diterima"**.
- Setelah kirim: halaman terima kasih. Penerima **tidak** melihat berat kirim maupun selisih.
- Token: sekali pakai, kedaluwarsa, maksimal 5 percobaan salah/hari, pembatasan laju per IP (hash), simpan info perangkat kasar (user agent, hash IP). Tidak boleh dipakai ulang setelah terkirim. Koreksi oleh penerima hanya lewat permintaan ke fasilitas pengirim (fasilitas menerbitkan token baru dan event tercatat).
- Setelah konfirmasi, selisih `d_k` dihitung otomatis oleh server. Petugas pengirim melihat status "Terkonfirmasi" dan d_k.

**Kriteria penerimaan:** (1) token tidak bisa dipakai dua kali; (2) token kedaluwarsa menampilkan pesan jelas dan nomor kontak fasilitas; (3) berat kirim tidak muncul di respons API `confirm-get` (diuji); (4) pengiriman tanpa konfirmasi lewat batas waktu otomatis berstatus `kedaluwarsa` dan memicu R4; (5) halaman terbuka cepat di jaringan lambat (< 100 KB awal, tanpa pustaka berat).

### M4. Mode offline dan sinkronisasi (F07) — P0

Spesifikasi lengkap di bagian 8. Ringkas: setiap aksi masuk **outbox**, dikirim berurutan, idempoten per `client_op_id`, ada indikator sinkron selalu terlihat.

### M5. Mesin neraca massa (F08) — P0

- Edge Function `engine-run` menjalankan 6.2–6.4 untuk batch yang baru ditutup, pengiriman yang baru dikonfirmasi, hasil koreksi, dan jadwal berkala.
- Hasil: baris `anomalies` (bila ada) plus kolom turunan di `batches` (`e_kg`, `e_rel`, `balance_status`: `lolos` / `ditandai` / `belum_dievaluasi`).
- Menjalankan ulang tidak menggandakan anomali (kunci unik `(target, rule_code, engine_run_group)` dengan `superseded_at`).
- **Kriteria penerimaan:** seluruh vektor uji 6.7 lolos di klien dan server dengan hasil sama.

### M6. Deteksi anomali dan antrean tinjauan (F09, F12) — P0 (deteksi), P1 (antrean penuh)

- Setiap anomali tampil sebagai kartu: kode aturan, nama, **kalimat alasan** dari templat, nilai terukur, ambang, versi ambang, batch/pengiriman terkait, tautan ke riwayat.
- Templat alasan contoh: *"Selisih penutupan batch 6,0% (6 kg dari 100 kg). Batas wajar untuk kategori dominan Plastik: 3,2% (ambang v2, beku 12 Des 2026)."*
- Pengelola memilih **penyebab** dan status tinjauan (6.5), dengan catatan. Perubahan status tercatat di `event_log`.
- Filter: status, aturan, severity, periode, petugas. Urut default: severity lalu terbaru.
- **Kriteria penerimaan:** (1) tiap anomali dapat dijelaskan lewat satu kalimat otomatis yang memuat nilai dan ambang; (2) peninjau sama dengan pencatat memunculkan peringatan bila ada peninjau lain; (3) status `dijelaskan` tidak mengubah VRR ketat.

### M7. VRR, Gap, dan penutupan periode (F10) — P0

- Pengelola mengisi **angka laporan** (`reported_figures`: berat daur ulang yang selama ini dilaporkan untuk periode itu).
- **Tutup periode**: sistem membekukan perhitungan (menyimpan `snapshot_hash` dari data yang dipakai, versi ambang, versi mesin). Periode default: bulanan, bisa mingguan untuk pilot.
- Sebelum menutup, sistem menampilkan daftar penghalang: pengiriman belum terkonfirmasi, anomali `open`, batch belum ditutup. Pengelola boleh menutup dengan penghalang (catat), tetapi laporan menandainya.
- Keluaran: RR, VRR, VRR_p, Gap, cakupan, penjelasan Gap (templat 6.6), pemisahan **gap karena tidak terkonfirmasi** vs **gap karena selisih berat** (untuk evaluasi E5).
- **Kriteria penerimaan:** angka di dasbor sama persis dengan hasil fungsi engine dari data mentah (uji rekonsiliasi otomatis).

### M8. Dasbor dinas (F11) — P1 (inti P0 untuk pilot: tabel per fasilitas)

- **Kartu ringkasan:** VRR ketat, RR, Gap, % batch tertelusuri, % pengiriman terkonfirmasi, jumlah anomali terbuka, jumlah fasilitas aktif. Setiap kartu menampilkan periode dan lencana "ambang sementara/beku".
- **Peta** (Leaflet): penanda per fasilitas berwarna menurut kategori gap, plus ikon bentuk berbeda (bukan hanya warna). Klik → ringkasan fasilitas.
- **Daftar prioritas audit:** peringkat fasilitas. Skor prioritas **transparan**: urut utama Gap (turun), kolom pendamping jumlah anomali tinggi, % tidak terkonfirmasi, tingkat cakupan. Tiap kolom bisa diurutkan. Fasilitas dengan cakupan rendah diberi lencana "Data belum cukup" dan tidak diberi peringkat Gap (muncul di daftar terpisah "Perlu pendampingan pencatatan").
- **Tren:** satu grafik garis VRR dan RR per periode. Satu grafik batang gap per fasilitas.
- **Drill-down:** fasilitas → periode → batch → pengiriman → event log.
- Filter: wilayah, periode, tipe fasilitas.
- Pengguna dinas **hanya membaca**. Foto bukti tampil dengan pseudonim petugas.

### M9. Audit trail dan verifikasi integritas (F13) — P1

- Layar riwayat per fasilitas: daftar event, filter entitas dan aktor, tampilan **sebelum / sesudah**.
- Tombol **Verifikasi rantai**: menjalankan fungsi `verify_chain(facility_id)` dan menampilkan "Utuh (N event)" atau "Rantai putus di #seq" dengan detail.
- **Jangkar mingguan** (`anchor-hash`): tiap Senin 02:00 WIB, kirim email berisi hash terakhir tiap fasilitas ke pengelola dan dinas; simpan di `hash_anchors`.
- **Halaman publik verifikasi laporan** `/verifikasi/:reportId`: menampilkan metadata laporan periodik (tanpa data sensitif) dan hash snapshot, serta status rantai terakhir. Tujuannya agar auditor dapat memeriksa tanpa login.
- Batasan yang harus tampil di halaman Metode: pemilik akses penuh database tetap dapat menghitung ulang rantai; perlindungan tambahan berupa jangkar eksternal.

### M10. Laporan dan ekspor (F14) — P1

- **Laporan periodik PDF** per fasilitas (A4): kop SIRKULA, identitas fasilitas, periode, RR/VRR/Gap, cakupan, tabel anomali ringkas, penjelasan Gap, versi mesin dan ambang, `snapshot_hash`, QR ke halaman verifikasi, catatan batasan.
- **Ekspor CSV**: batch, pengiriman, konfirmasi, anomali, periode. Nama petugas = pseudonim. Dinas hanya mengekspor fasilitas dalam organisasinya.
- **Ekspor riset (admin)**: dump anonim ke CSV/JSON dengan kamus data (E1–E6).

### M11. Direktori mitra dan manajemen fasilitas — P0/P1

- Pengelola mengelola `partners` (nama, tipe, telepon, aktif).
- Admin mengelola `organizations`, `facilities`, `material_categories` (tambah/nonaktifkan, tidak hapus), parameter fasilitas (`scale_resolution_kg`, zona waktu, `ack_timeout_hours`).

### M12. Mode riset, pilot, dan demo — P1

Spesifikasi di bagian 13.

### M13. Notifikasi — P1

- In-app: banner pengiriman belum terkonfirmasi menjelang batas waktu (F16), antrean sinkron, anomali baru untuk pengelola.
- Email (Resend): jangkar hash mingguan; ringkasan mingguan anomali terbuka untuk pengelola; peringatan tautan konfirmasi hampir kedaluwarsa. Web Push: P2.

### M14. Halaman publik dan bantuan — P0/P1

Lihat bagian 12.

---

## 8. SPESIFIKASI OFFLINE-FIRST DAN SINKRONISASI

### 8.1 Prinsip

- Sumber kebenaran sementara di perangkat = **IndexedDB** (Dexie). Sumber kebenaran akhir = PostgreSQL.
- Penulisan dari UI **selalu** ke IndexedDB + outbox lebih dulu (optimistic), tidak menunggu jaringan.
- Id dibuat klien (UUID v4). Setiap operasi punya `client_op_id` (UUID), `device_id`, `client_time`, `seq_local`.
- Server **tidak pernah** menimpa data dengan "terakhir menang" untuk bobot. Koreksi = operasi baru dengan alasan.

### 8.2 Skema Dexie

```
outbox:     ++seq_local, client_op_id (unik), op_type, payload, status(queued|sending|failed|done|conflict), attempts, last_error, created_at
cache_*:    batches, batch_items, shipments, shipment_lines, partners, categories, thresholds, anomalies, period_reports (+ _synced_at)
kv:         key, value   // sync cursor (`last_pulled_at`), device_id, versi skema
blobs:      id, kind, file(Blob), parent_op_id, status  // foto menunggu unggah
```

### 8.3 Jenis operasi (`op_type`)

`batch.create`, `batch.update_items`, `batch.set_onsite`, `batch.close`, `batch.correct` (alasan wajib), `batch.void`, `shipment.create`, `shipment.reissue_token`, `shipment.void`, `partner.upsert`, `stock.snapshot`, `baseline.add`, `ref_weighing.add`, `metric.add`.

### 8.4 Alur kirim (push)

1. Deteksi online: `navigator.onLine` **dan** ping ringan ke endpoint kesehatan (jangan percaya `onLine` saja). Coba juga saat aplikasi dibuka, fokus ulang, dan tiap 30 detik bila ada antrean (backoff eksponensial sampai 5 menit).
2. Ambil operasi `queued` terurut `seq_local`, kirim dalam kelompok (maks 25) ke Edge Function `sync-push`.
3. Server memproses tiap operasi **dalam transaksi**: jika `client_op_id` sudah ada di `sync_ops` → kembalikan hasil lama (idempoten). Jika belum → validasi (zod + aturan bisnis + RLS) → terapkan → tulis `sync_ops` → trigger menulis `event_log`.
4. Respons per operasi: `ok`, `rejected` (dengan kode galat dan pesan manusiawi), atau `conflict` (dengan detail).
5. Klien menandai `done`, `failed` (bisa dicoba ulang), atau `conflict`. Kegagalan sementara (jaringan/5xx) tidak menghapus antrean.
6. **Foto** diunggah terpisah ke Storage (jalur `evidence/<facility>/<yyyy>/<mm>/<uuid>.jpg`) setelah operasi induknya `ok`, bisa dilanjutkan jika terputus (cek ukuran). Operasi tidak menunggu foto, tetapi batch tanpa foto tertunda ditandai "foto menunggu".

### 8.5 Alur ambil (pull)

- `sync-pull?since=<cursor>` mengembalikan baris yang berubah untuk fasilitas pengguna (dan data referensi), disertai `server_time`. Klien memperbarui `cache_*` dan cursor. Hapus lokal hanya untuk status `void` (tombstone), bukan hapus fisik.
- Pull awal setelah login: ambil data 90 hari terakhir + referensi. Riwayat lebih lama dimuat sesuai kebutuhan saat online.

### 8.6 Konflik

| Situasi | Perlakuan |
|---|---|
| Dua perangkat mengedit batch yang sama | Operasi koreksi memuat `base_version`. Jika `base_version` ≠ versi server → `conflict`; **kedua nilai disimpan** (event), batch ditandai `needs_review`, pengelola memilih nilai yang berlaku (dengan alasan) |
| Penambahan pengiriman pada batch yang sudah `void` | Ditolak server, pesan jelas, operasi ditandai `conflict` |
| Batch ditutup offline, sementara pengelola sudah mengoreksi | Konflik seperti baris pertama |
| Konfirmasi penerima masuk saat petugas offline mengubah alokasi | Server menerima kedua event berurutan waktu server, menandai pengiriman `needs_review` |
| Pembuatan (`create`) | Tidak pernah konflik (UUID unik) |

UI **Pusat Sinkron** (`/app/sinkron`): jumlah menunggu, gagal, konflik; tombol coba ulang; detail galat dalam bahasa awam; indikator global di header (hijau tersinkron, kuning menunggu N, merah gagal, abu-abu offline).

### 8.7 Service worker dan PWA

- Precache shell aplikasi (HTML/JS/CSS/ikon/font). Halaman `offline.html` cadangan.
- Strategi: *stale-while-revalidate* untuk aset; *network-first dengan fallback cache* untuk data baca; **tidak pernah** menyimpan respons Edge Function sinkron di cache SW.
- Prompt pembaruan versi: "Versi baru tersedia, muat ulang" (jangan paksa reload saat ada form terbuka). Versi skema Dexie dimigrasi dengan aman.
- Manifest: nama SIRKULA, `display: standalone`, `orientation: portrait` untuk petugas, ikon 192/512 dan **maskable**, warna tema sesuai merek. Tombol "Pasang aplikasi" di Beranda.
- Minta `navigator.storage.persist()` agar data lokal tidak dibuang browser. Tampilkan peringatan bila penyimpanan hampir penuh.

### 8.8 Kriteria penerimaan offline (diuji manual dan Playwright)

1. Mode pesawat, buat 10 batch lengkap (masuk-pilah-keluar-tutup) → nyalakan jaringan → semua muncul di server tepat satu kali.
2. Putuskan jaringan di tengah sinkron → lanjut tanpa duplikat dan tanpa kehilangan.
3. Tutup paksa browser saat antrean berisi → buka ulang → antrean utuh.
4. Token kedaluwarsa saat offline → antrean tetap, login ulang → sinkron berlanjut.
5. Dua perangkat mengoreksi batch sama → konflik tertangkap, tidak ada nilai hilang.

---

## 9. AUDIT TRAIL DAN INTEGRITAS (ringkas teknis)

- Tabel yang diaudit (trigger): `batches`, `batch_items`, `onsite_processing`, `shipments`, `shipment_lines`, `confirmations`, `anomalies` (perubahan status), `threshold_sets`, `reported_figures`, `period_reports`, `profiles` (peran/status), `partners`.
- Rantai **per fasilitas** (`facility_id`). Trigger mengambil `pg_advisory_xact_lock(hash facility_id)`, membaca hash terakhir, menghitung `hash = SHA-256(prev_hash || payload_kanonik)`, memasukkan baris dengan `seq = prev_seq + 1`.
- `payload_kanonik` = teks deterministik dari `entitas|entity_id|aksi|old(jsonb::text)|new(jsonb::text)|actor|occurred_at`. Hash genesis = 64 nol.
- `event_log`: **tidak bisa UPDATE/DELETE** (trigger menolak, hak akses dicabut untuk semua peran termasuk `authenticated`).
- `verify_chain()` menghitung ulang seluruh rantai dan membandingkan.
- Catatan jujur untuk Metode: ini *append-only log dengan integritas berantai hash*, **bukan blockchain**, dan tidak mencegah kolusi atau pihak dengan akses penuh.

---

## 10. KEAMANAN, PRIVASI, DAN KEPATUHAN

### 10.1 Kontrol keamanan (wajib)

| Risiko | Kontrol |
|---|---|
| Akses lintas fasilitas | RLS di semua tabel + uji otomatis dua pengguna dari fasilitas berbeda |
| Eskalasi peran | Peran hanya bisa diubah lewat Edge Function `admin-user` (service role), bukan UPDATE klien |
| Data diubah diam-diam | Trigger hash-chain, `event_log` immutable, jangkar mingguan |
| Pemalsuan konfirmasi | Token acak 128-bit, hanya hash (SHA-256 + `TOKEN_PEPPER`) di DB, sekali pakai, kedaluwarsa, pembatasan laju, bukti foto opsional, catat perangkat |
| Brute force login | Rate limit Supabase Auth, CAPTCHA/Turnstile pada login setelah 5 gagal (P1) |
| XSS/injeksi | Tanpa `dangerouslySetInnerHTML`, validasi zod di server, query terparameter, CSP ketat |
| Penyadapan | HTTPS saja, HSTS |
| Kebocoran berkas | Bucket `evidence` **privat**, akses lewat *signed URL* berumur pendek (≤ 5 menit), jalur menyertakan facility_id, kebijakan Storage mengikuti RLS |
| Kehilangan data | Pencadangan harian otomatis + uji pemulihan tercatat (checklist go-live) |
| Dependensi rentan | `npm audit` di CI, Dependabot |
| Kebocoran PII di log | Saring email, telepon, nama di Sentry (`beforeSend`) |

**Header HTTP (di hosting):** `Content-Security-Policy` (self + Supabase + tile OSM + Sentry), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self)`, HSTS.

Lampirkan hasil daftar periksa **OWASP Top 10 / ASVS dasar** di `docs/SECURITY_CHECKLIST.md` (dokumen induk meminta bukti pengujian keamanan).

### 10.2 Privasi dan etika data

- **Minimalisasi:** simpan nama samaran petugas, bukan NIK/alamat. Telepon mitra hanya untuk tautan WhatsApp, tidak tampil ke dinas.
- Laporan dan dasbor dinas menampilkan **pseudonim** petugas (`Petugas-07`).
- Foto: panduan "foto timbangan dan tumpukan sampah, jangan memuat wajah" tampil di layar kamera. EXIF lokasi dihapus default.
- Persetujuan tertulis pengelola untuk penelitian disimpan sebagai berkas bertanda waktu (admin unggah ke `consents_docs`), nama fasilitas boleh disamarkan di publikasi (`facilities.public_alias`).
- **Retensi** (bisa diatur admin, usulan awal): foto bukti 12 bulan lalu dihapus (metadata tetap), `event_log` permanen, akun nonaktif dipseudonimkan setelah 24 bulan, permintaan hapus data diproses lewat prosedur di `docs/RUNBOOK.md`.
- Tim perlu membaca ketentuan pelindungan data pribadi yang berlaku (mis. UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi) dan memverifikasi sendiri kewajiban yang relevan, termasuk kebijakan lokasi penyimpanan data bila dinas mensyaratkan.
- **Kebijakan Privasi** dan **Syarat Penggunaan** berbahasa Indonesia sederhana wajib ada sebelum rilis publik (templat isi di bagian 12).

### 10.3 Hak akses data penelitian

Data pilot hanya untuk penelitian dengan persetujuan pengelola. Ekspor riset hanya admin, selalu teranonimkan, dan tercatat di `event_log` (siapa, kapan, cakupan).

---
## 11. UI/UX DAN SISTEM DESAIN

### 11.1 Karakter visual

Hangat, tepercaya, ilmiah, tidak kaku seperti aplikasi korporat. Bersih, banyak ruang kosong, angka besar dan jelas. Cocok dilihat di bawah sinar matahari di HP murah.

### 11.2 Token warna (Tailwind `theme.extend.colors`)

| Token | Hex | Pemakaian |
|---|---|---|
| `brand-900` | `#0B3D2E` | teks judul, header gelap |
| `brand-700` | `#0F6B4F` | tombol utama, tautan |
| `brand-500` | `#1FA37A` | aksen, status baik |
| `brand-100` | `#DDF4EA` | latar kartu positif |
| `teal-500` | `#14B8A6` | grafik sekunder |
| `amber-500` | `#F5A524` | peringatan, anomali sedang, ambang sementara |
| `red-600` | `#D92D20` | galat, anomali tinggi |
| `ink-900` | `#101828` | teks utama |
| `ink-500` | `#667085` | teks sekunder |
| `surface` | `#FFFFFF` / `#F6F8F7` | latar |
| `line` | `#E4E7EC` | garis |

Mode gelap: P2. Mode **kontras tinggi** untuk di luar ruangan: P1 (tombol di Profil).

Status **tidak boleh hanya warna**: selalu ikon + teks (✓ Terverifikasi, ⚠ Perlu dicek, ✕ Ditolak, ⏳ Menunggu).

### 11.3 Tipografi dan angka

- Font: **Plus Jakarta Sans** (judul dan isi), angka tabel `font-variant-numeric: tabular-nums`. Fallback sistem.
- Petugas: ukuran dasar **18 px**, input angka **28 px**. Pengelola/dinas: 16 px.
- Format Indonesia: `1.234,5 kg`, tanggal `4 Nov 2026, 14.05 WIB`. Input menerima koma atau titik.

### 11.4 Komponen dan pola

- Tombol minimal tinggi **48 px**, area sentuh minimal 44×44, jarak antar target ≥ 8 px (nyaman bersarung tangan).
- Aksi utama berada di **bawah layar** (ibu jari), bilah navigasi bawah 4 tab untuk petugas: **Beranda · Batch · Kirim · Sinkron**.
- Stepper batch tampil sebagai bilah kemajuan di atas, langkah berikutnya selalu satu tombol besar.
- Formulir: satu tugas per layar, label di atas kolom, galat di bawah kolom dengan bahasa manusiawi ("Berat harus lebih dari 0").
- Konfirmasi untuk aksi tak terbalik (tutup batch, void) pakai *bottom sheet* dengan ringkasan akibat.
- Kondisi kosong, memuat (skeleton), dan galat didesain untuk **setiap** daftar.
- Layar tabel dinas: tabel dapat diurutkan, sticky header, kolom dapat disembunyikan, ekspor CSV.

### 11.5 Peta layar (sitemap)

**Publik:** `/` (landing) · `/metode` · `/privasi` · `/syarat` · `/masuk` · `/k/:token` (konfirmasi penerima) · `/verifikasi/:reportId`

**Petugas (mobile):** `/app` Beranda · `/app/batch` daftar · `/app/batch/baru` · `/app/batch/:id` (stepper) · `/app/pindai` · `/app/kirim` daftar · `/app/kirim/baru` · `/app/kirim/:id` · `/app/stok` · `/app/sinkron` · `/app/profil` · `/app/bantuan`

**Pengelola:** `/kelola` ringkasan · `/kelola/batch` · `/kelola/pengiriman` · `/kelola/anomali` · `/kelola/periode` · `/kelola/mitra` · `/kelola/pengguna` · `/kelola/ambang` · `/kelola/audit` · `/kelola/laporan`

**Dinas:** `/dinas` dasbor · `/dinas/peta` · `/dinas/prioritas` · `/dinas/fasilitas/:id` · `/dinas/laporan` · `/dinas/ekspor`

**Admin/Riset:** `/admin/organisasi` · `/admin/fasilitas` · `/admin/kategori` · `/admin/ambang-global` · `/admin/riset` (baseline, timbangan referensi, SUS, simulasi, metrik, ekspor) · `/admin/demo` · `/admin/flag`

Pintu masuk: setelah login, arahkan otomatis menurut peran. Navigasi lain disembunyikan, **bukan** satu-satunya penjaga (RLS tetap).

### 11.6 Layar kunci (isi minimal)

**Beranda petugas:** salam + nama fasilitas, indikator sinkron, tombol besar **+ Batch Baru** dan **Pindai QR**, kartu "Hari ini" (jumlah batch, total masuk kg, pengiriman menunggu konfirmasi), daftar 5 batch terakhir dengan status, banner kondisi (offline, foto menunggu unggah, konflik).

**Detail batch:** header kode + QR, ringkasan neraca (M_in, keluaran, ΔS, e, e_rel) dengan lencana status (Lolos / Ditandai / Belum dievaluasi / Sementara), tab Pilah · Keluar · Riwayat, tombol Koreksi dan Void (alasan wajib).

**Antrean anomali (pengelola):** kartu bergaya daftar kerja, tombol cepat penyebab, pengaturan filter, penghitung "N perlu ditinjau".

**Dasbor dinas:** lihat M8.

**Halaman Metode (publik):** penjelasan rumus (e, e_rel, d_k, VRR, Gap), aturan R1–R7 beserta cara ambang ditetapkan, definisi first-hop, batasan, rujukan metode. Memenuhi N08 (rumus dan ambang bisa dilihat dan dijelaskan).

### 11.7 Microcopy (aturan)

- Kalimat pendek, kata kerja di depan: "Timbang sampah, lalu foto timbangan."
- Galat jaringan: "Tidak ada sinyal. Data aman di HP dan akan dikirim otomatis."
- Anomali: "Perlu dicek" (bukan "mencurigakan").
- Konfirmasi penerima: "Berapa kg yang Anda terima?" Terima kasih: "Terima kasih. Konfirmasi Anda sudah tercatat."
- Dilarang jargon (closure error, MAD) di layar petugas. Istilah teknis hanya di Metode dan layar pengelola/dinas dengan tooltip.

### 11.8 Aksesibilitas

WCAG 2.1 AA: kontras ≥ 4,5:1, fokus terlihat, label formulir, `aria-live` untuk status sinkron, dukungan pembaca layar dasar, tanpa animasi berkedip. Uji dengan font sistem diperbesar 130%.

### 11.9 Bantuan di dalam aplikasi

`/app/bantuan`: panduan satu halaman bergambar (cara timbang dan foto, cara pindai QR, apa yang dilakukan bila offline, cara kirim tautan konfirmasi). Tur singkat (3 layar) pada login pertama. Tombol "Hubungi pendamping" (tautan WhatsApp dari pengaturan admin).

---

## 12. HALAMAN PUBLIK DAN LEGAL

| Halaman | Isi |
|---|---|
| **Landing `/`** | Satu kalimat nilai, masalah (tanpa angka yang belum diverifikasi), cara kerja 4 langkah, siapa yang diuntungkan, tombol Masuk, tautan Metode dan Privasi. Tidak ada klaim berlebihan (aturan 0.10). Boleh memuat tangkapan layar nyata. |
| **Metode `/metode`** | Lihat 11.6. Termasuk "Yang bukan klaim kami" (tidak menggantikan audit, bukan bukti kecurangan, belum terintegrasi SIPSN, cakupan first-hop). |
| **Privasi `/privasi`** | Data apa yang dikumpulkan dan mengapa, pseudonim, foto, retensi, siapa yang melihat data, hak pengguna dan cara mengajukan permintaan, kontak. Tinjau bersama dosen/unit hukum kampus. |
| **Syarat `/syarat`** | Penggunaan wajar, tanggung jawab keakuratan input, batas tanggung jawab, status pilot/versi, perubahan syarat. |
| **Verifikasi `/verifikasi/:id`** | Lihat M9. |
| **404 / Galat** | Ramah, tautan kembali, tanpa detail teknis. |

SEO dasar (judul, deskripsi, Open Graph 1200×630), `robots.txt`: halaman `/app`, `/kelola`, `/dinas`, `/admin`, `/k/` diberi `noindex`.

---

## 13. MODE RISET, PILOT, DAN DEMO

Tujuan: aplikasi ikut menghasilkan **bukti** untuk naskah (evaluasi E1–E6) tanpa mencemari data produksi.

### 13.1 Alat riset (`/admin/riset`, peran admin; pengelola bisa baca hasil fasilitasnya)

| Alat | Fungsi | Evaluasi |
|---|---|---|
| **Pencatatan dasar manual** (`pilot_baseline`) | Input data dari lembar manual (foto lembar dapat diunggah). Dipakai membentuk garis dasar dan ambang | E3, kalibrasi |
| **Timbangan referensi** (`reference_weighings`) | Pilih batch acak (tombol "Undi N batch" memakai seed tercatat), isi berat timbangan fasilitas vs referensi. Hitung rata-rata, simpangan baku, rentang | E1, τ |
| **Metrik penggunaan** (`usage_metrics`) | Waktu dan jumlah ketukan per batch otomatis. Tampil tabel dan ekspor | E3 |
| **Kuesioner SUS** | 10 pernyataan standar, skala 1–5, skor 0–100 dengan aturan baku (ganjil −1; genap 5−nilai; jumlah × 2,5). Per peserta tampil, tidak hanya rata-rata. Persetujuan responden dicatat | E6 |
| **Simulator injeksi anomali** | Menyalin data pilot ke **ruang simulasi terpisah** (bukan data produksi), menyuntikkan enam jenis kesalahan sintetis (penggelembungan keluaran, keluaran tanpa masuk, selisih dua pihak, konfirmasi hilang, lonjakan harian, data duplikat) dengan besar dan lokasi tercatat **sebelum** mesin dijalankan, lalu menghitung precision, recall, F1 per aturan dan gabungan, serta kurva terhadap besar kesalahan. Hasil berlabel **SIMULASI** | E4 |
| **Kalibrasi ambang** | Lihat 6.8 | kalibrasi |
| **Ekspor riset** | CSV/JSON anonim + kamus data | semua |
| **Pembagi data** | Bagi data pilot menjadi bagian kalibrasi dan bagian uji dengan aturan tanggal/seed yang tercatat | E4 |

Pelabelan: semua hasil simulasi, sintetis, dan data demo memuat tanda jelas di UI dan ekspor.

### 13.2 Mode demo

- Tenant `is_demo=true` terpisah dengan data hasil **skrip seed** realistis (bukan angka aneh), dapat di-reset satu tombol.
- Banner permanen "MODE DEMO — data bukan data nyata".
- Skenario tiga langkah (final lomba): (1) petugas mencatat batch dengan QR, matikan jaringan lalu sinkron; (2) penerima mengonfirmasi berat sedikit berbeda; (3) anomali muncul di dasbor dengan alasan dan Gap tampil di ringkasan dinas.
- Kode manual 6 karakter sebagai cadangan pemindaian. Mode demo bisa berjalan dari data lokal (cadangan bila internet venue buruk).

---

## 14. KEBUTUHAN NON-FUNGSIONAL

| ID | Kebutuhan | Target dan cara uji |
|---|---|---|
| N01 | Bekerja tanpa sinyal minimal satu hari kerja | Uji mode pesawat ≥ 8 jam simulasi, 100 batch |
| N02 | Pencatatan batch ringkas | Jumlah ketukan dan waktu diukur di `usage_metrics`, dilaporkan apa adanya |
| N03 | Tanpa kehilangan data saat sinkron berulang | Uji 8.8 |
| N04 | Setiap perubahan tercatat siapa/kapan/nilai lama | Uji audit trail dan verifikasi rantai |
| N05 | Data pribadi minim, pseudonim | Tinjauan privasi, uji ekspor |
| N06 | Nyaman di HP kecil (≥ 360 px), teks besar | Uji kegunaan dengan petugas |
| N07 | Dasbor cepat untuk data satu fasilitas setahun | p75 render < 2 detik di laptop menengah (uji dengan 50.000 baris, gunakan indeks dan agregasi di server) |
| N08 | Rumus dan ambang dapat dilihat | Halaman Metode + tooltip + versi ambang |
| N09 | Lighthouse | PWA lulus, Performance ≥ 85 (mobile, jaringan 4G lambat), Accessibility ≥ 95 |
| N10 | Ukuran muat awal petugas | JS awal ≤ 250 KB gzip (dashboard dimuat malas), halaman konfirmasi publik ≤ 100 KB |
| N11 | Browser | Chrome/Edge/Samsung Internet 2 versi terakhir, Android 8+, Safari iOS 16+ (PWA terbatas, uji manual) |
| N12 | Ketersediaan | Target 99% pada jam kerja; kegagalan server tidak menghalangi pencatatan (offline-first) |
| N13 | Pemulihan | RPO ≤ 24 jam, RTO ≤ 4 jam, uji pemulihan tercatat |
| N14 | Skala | Satu fasilitas: puluhan ribu baris/tahun cukup satu PostgreSQL. Indeks pada `(facility_id, created_at)`, `(batch_id)`, `(shipment_id)`. Rencana skala kabupaten: partisi per `facility_id`, antrean pekerjaan engine. **Ditulis sebagai rencana, bukan klaim teruji** |
| N15 | Pemantauan | Sentry untuk galat klien dan Edge Function, dasbor Supabase, peringatan bila kegagalan sinkron > 5% dalam sejam |

---

## 15. PENGUJIAN DAN JAMINAN MUTU

| Jenis | Cakupan | Alat |
|---|---|---|
| Unit | Engine: semua vektor 6.7, kasus tepi, properti (hasil sama pada urutan data berbeda) | Vitest |
| Basis data | RLS (pengguna A vs B, dinas baca saja, admin), trigger hash-chain, `verify_chain` menangkap perubahan manual, `event_log` immutable | pgTAP atau skrip SQL + Vitest |
| Integrasi | Edge Function sync-push (idempoten, penolakan, konflik), confirm-get/submit (token), engine-run | Vitest + Supabase lokal |
| E2E | Alur lengkap petugas → penerima → anomali → dasbor; skenario offline 8.8 | Playwright (emulasi offline, perangkat Android) |
| Rekonsiliasi | Angka dasbor = hasil engine dari data mentah | Uji otomatis nightly |
| Keamanan | Checklist OWASP, uji akses langsung API tanpa UI, uji token (reuse, brute force, kedaluwarsa) | Manual + skrip |
| Kegunaan | Uji dengan petugas nyata (3–5), SUS | Pilot |
| Aksesibilitas | axe-core, uji manual pembaca layar dasar | axe + manual |
| Beban ringan | 50.000 baris, 20 pengguna bersamaan | k6 atau skrip sederhana |

CI (`.github/workflows/ci.yml`): lint, typecheck, unit, build, `npm audit --omit=dev`, e2e pada PR utama.

---

## 16. DEPLOYMENT DAN OPERASI

### 16.1 Setup sekali jalan (urut)

1. Buat project **Supabase**, region **Singapore** (terdekat ke Indonesia). Aktifkan pencadangan harian (paket yang mendukung) dan catat uji pemulihan.
2. Jalankan migrasi dari `supabase/migrations` berurutan (Lampiran A).
3. Auth: **matikan "Allow new users to sign up"**, wajibkan konfirmasi email untuk akun email, atur kebijakan kata sandi (≥ 10 karakter), template email berbahasa Indonesia.
4. Storage: buat bucket **privat** `evidence`; pasang kebijakan sesuai Lampiran A.
5. Deploy Edge Functions, set secrets (`TOKEN_PEPPER`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_BASE_URL`, `SERVICE_ROLE`).
6. Jadwalkan `cron-daily` (jam 01:00 WIB) dan `anchor-hash` (Senin 02:00 WIB) lewat Supabase Cron.
7. Seed: kategori material, `threshold_sets` global *draft* (ditandai sementara), organisasi dan akun admin pertama.
8. Deploy frontend ke **Cloudflare Pages** atau **Vercel** dengan variabel lingkungan; pasang header keamanan; domain khusus + HTTPS.
9. Uji PWA di HP Android sungguhan: pasang, mode pesawat, catat batch, nyalakan, sinkron.
10. Jalankan seluruh daftar go-live (bagian 21).

### 16.2 Lingkungan

`production`, `staging` (project Supabase terpisah), `demo` (tenant demo di staging atau project terpisah). Migrasi diuji di staging dulu. Tidak ada data nyata di staging.

### 16.3 Rilis dan pembaruan

- Versi semver, `CHANGELOG.md`. Rilis kecil sering. Pembaruan PWA lewat prompt (8.7).
- Migrasi DB **tidak merusak** (tambah kolom dulu, hapus belakangan). Jangan rilis migrasi yang mengubah `event_log`.
- Matikan fitur bermasalah lewat *feature flag* (`/admin/flag`, tabel `feature_flags`).

### 16.4 Onboarding fasilitas baru (dokumen `RUNBOOK.md` harus memuat)

1. Surat izin/kesepakatan pengelola. 2. Buat fasilitas dan akun. 3. Pemetaan alur material dan daftar mitra. 4. Pelatihan 30 menit (petugas, penerima, pengelola) memakai panduan satu halaman. 5. Pencatatan paralel manual beberapa hari. 6. Pendampingan jarak jauh (WhatsApp). 7. Tinjauan mingguan data dan galat.

### 16.5 Biaya dan batasan layanan

Paket gratis layanan cloud umumnya cukup untuk pilot satu fasilitas, tetapi proyek gratis dapat dijeda saat tidak aktif dan punya batas penyimpanan, jadi **untuk dipakai masyarakat luas gunakan paket berbayar** dan pantau kuota (penyimpanan foto adalah pemakai terbesar). Cek ketentuan terbaru masing-masing penyedia sebelum rilis.

---

## 17. URUTAN BUILD (FASE) DAN DEFINISI SELESAI

Bangun **berurutan**. Jangan lanjut ke fase berikutnya sebelum kriteria fase sebelumnya lolos.

| Fase | Isi | Selesai bila | Level |
|---|---|---|---|
| **0 Fondasi** | Repo, token desain, shell per peran, Supabase skema + RLS + trigger hash-chain, auth + RBAC, seed kategori, CI, deploy staging | Login per peran jalan, uji RLS lulus, `verify_chain` jalan | P0 |
| **1 Pencatatan inti offline** | Batch (masuk, pilah, organik, tutup), foto, QR + kode manual, stok sisa, outbox + sync-push/pull, Pusat Sinkron, PWA | Skenario offline 8.8 (1–3) lulus | P0 |
| **2 Pengiriman + konfirmasi buta** | Direktori mitra, shipment + lines, token, tautan WhatsApp, halaman `/k/:token`, status dan kedaluwarsa | Kriteria M3 lulus | P0 |
| **3 Mesin + anomali** | Paket engine + tes, engine-run, R1–R6 (R7 opsional), ambang sementara, kartu anomali, tinjauan | Semua vektor 6.7 lulus klien dan server | P0 |
| **4 Metrik + dasbor** | Angka laporan, tutup periode, RR/VRR/VRR_p/Gap, dasbor dinas (kartu, tabel prioritas, peta, tren), drill-down | Rekonsiliasi dasbor = engine | P0/P1 |
| **5 Integritas** | UI audit + verifikasi rantai, jangkar mingguan, halaman verifikasi publik, laporan PDF dan CSV | Perubahan manual DB terdeteksi | P1 |
| **6 Riset + demo** | Baseline, timbangan referensi, kalibrasi dan pembekuan ambang, SUS, simulator, metrik, ekspor riset, tenant demo | Hasil E1–E6 dapat diekspor | P1 |
| **7 Pengerasan dan go-live** | Keamanan, performa, aksesibilitas, e2e penuh, dokumentasi, pemantauan, uji pemulihan, halaman legal | Daftar go-live 21 lulus | P1 |
| **8 Lanjutan** | Impor timbangan IoT (ESP32 + HX711), notifikasi push, API terbuka, kunci PIN, mode gelap | — | P2 |

**Jika waktu mepet (lihat tenggat lomba):** kerjakan **Fase 0–3 + bagian inti Fase 4 (tutup periode, VRR/Gap, tabel dinas)**. Itu sudah cukup untuk pilot dan bukti naskah. Peta, PDF, jangkar email, simulator, dan IoT boleh menyusul.

**Di luar cakupan v1 (jangan dibangun):** verifikasi foto berbasis AI, model machine learning, integrasi SIPSN, pembayaran, aplikasi native toko aplikasi, blockchain, verifikasi sampai rantai penerima berikutnya.

---

## 18. DATA SEED (hanya untuk tenant demo dan pengembangan)

- Kategori: Organik, Plastik, Kertas, Logam, Kaca, Residu (toleransi susut default dikonfigurasi admin).
- Tenant demo: 1 organisasi "Dinas Demo", 6 fasilitas fiktif di satu kota (koordinat acak masuk akal), 3 mitra per fasilitas, 60 hari data: batch harian 8–20 kg hingga 300 kg, pola mingguan wajar, komposisi masuk akal (organik dominan), susut 2–6%.
- Sebarkan kasus: 4 fasilitas konsisten (gap kecil), 1 gap positif sedang, 1 gap positif besar. Sisipkan masing-masing contoh R1–R6 yang jelas dengan penjelasan.
- Semua baris ditandai `is_demo`. Tombol **Reset demo** menghapus dan membuat ulang (hanya tenant demo).
- Angka seed bukan klaim tentang dunia nyata dan tidak boleh dikutip di naskah.

---

## 21. DAFTAR PERIKSA SIAP RILIS (GO-LIVE)

**Fungsi dan data**
- [ ] Seluruh kriteria penerimaan M1–M11 (P0 dan P1) lulus
- [ ] Semua vektor uji engine lulus; rekonsiliasi dasbor = engine
- [ ] Uji offline 8.8 lulus di HP Android sungguhan
- [ ] `verify_chain` mendeteksi perubahan manual pada data uji

**Keamanan dan privasi**
- [ ] RLS aktif di semua tabel; uji akses lintas fasilitas gagal sebagaimana mestinya
- [ ] Self sign-up mati; bucket `evidence` privat; signed URL pendek
- [ ] Tidak ada secret di bundel frontend (periksa hasil build)
- [ ] Header keamanan terpasang; HTTPS dan HSTS
- [ ] Checklist OWASP terisi dan tersimpan
- [ ] Kebijakan Privasi dan Syarat terbit; persetujuan dicatat
- [ ] Sentry menyaring PII

**Operasional**
- [ ] Pencadangan aktif **dan uji pemulihan pernah dijalankan**
- [ ] Cron `cron-daily` dan `anchor-hash` berjalan (cek log satu siklus)
- [ ] Email Resend terverifikasi domain (SPF/DKIM)
- [ ] Pemantauan dan peringatan aktif
- [ ] `RUNBOOK.md`, `PANDUAN_PETUGAS.md`, `SECURITY_CHECKLIST.md` selesai
- [ ] Kontak dukungan (WhatsApp) tercantum di aplikasi
- [ ] Rencana rollback dan matikan fitur lewat flag teruji

**Kualitas**
- [ ] Lighthouse: PWA lulus, Performance ≥ 85, Accessibility ≥ 95
- [ ] Uji kegunaan dengan minimal 3 petugas nyata
- [ ] Tidak ada kata terlarang (curang, fraud, blockchain, AI) di UI (cari teks)
- [ ] Semua data demo berlabel, tidak bercampur dengan produksi

---
## LAMPIRAN A — SKEMA SQL (Supabase / PostgreSQL)

> Simpan sebagai migrasi berurutan di `supabase/migrations/`. Semua perubahan data dari klien **hanya lewat RPC `apply_op`** (security definer). Tabel hanya punya kebijakan `SELECT` untuk `authenticated`; tidak ada kebijakan INSERT/UPDATE/DELETE langsung, sehingga klien yang memanggil API tabel secara langsung akan ditolak.

### A.1 Ekstensi, enum, fungsi bantu

```sql
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app;

create type public.user_role as enum ('petugas_tps3r','petugas_angkut','pengelola','dinas','admin');
create type public.facility_type as enum ('tps3r','bank_sampah','pengepul','pengolah','tpa');
create type public.outbound_purpose as enum ('daur_ulang','organik_olah','residu');

-- Fungsi bantu (security definer agar RLS tidak rekursif)
create or replace function app.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;
create or replace function app.my_facility() returns uuid
language sql stable security definer set search_path = public as $$
  select facility_id from profiles where id = auth.uid() and is_active
$$;
create or replace function app.my_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid() and is_active
$$;

create or replace function app.can_read_facility(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    left join facilities fa on fa.id = f
    where p.id = auth.uid() and p.is_active and (
      p.role = 'admin'
      or (p.role in ('petugas_tps3r','petugas_angkut','pengelola') and p.facility_id = f)
      or (p.role = 'dinas' and p.org_id = fa.org_id)
    )
  )
$$;

create or replace function app.can_write_facility(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.is_active
      and p.role in ('petugas_tps3r','petugas_angkut','pengelola')
      and p.facility_id = f
  )
$$;
```

### A.2 Tabel inti

```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_code text,
  org_type text not null check (org_type in ('dinas','kampus','mandiri')),
  created_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  public_alias text,
  facility_type facility_type not null default 'tps3r',
  province text, city text,
  lat numeric(9,6), lng numeric(9,6),
  timezone text not null default 'Asia/Jakarta',
  scale_resolution_kg numeric(6,3) not null default 0.1,
  ack_timeout_hours int not null default 72,
  is_demo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  username text not null unique,
  display_name text not null,                    -- pseudonim, mis. 'Petugas-07'
  role public.user_role not null,
  org_id uuid references organizations(id),
  facility_id uuid references facilities(id),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  check (role in ('dinas','admin') or facility_id is not null)
);

create table public.material_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_tolerance_pct numeric(5,2),
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),   -- pemilik daftar
  name text not null,
  partner_type text not null check (partner_type in ('pengepul','pengolah','tpa','lainnya')),
  phone text,                                            -- hanya untuk tautan WhatsApp
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key,                                   -- UUID dibuat klien
  facility_id uuid not null references facilities(id),
  code text not null,
  source_type text not null,
  source_name text,
  weight_in_total_kg numeric(12,3) not null check (weight_in_total_kg > 0),   -- M_in
  weigh_photo_path text,
  received_at timestamptz not null,
  status text not null default 'masuk' check (status in ('masuk','dipilah','ditutup','void')),
  remaining_stock_kg numeric(12,3) check (remaining_stock_kg >= 0),           -- ΔS
  closed_at timestamptz,
  void_reason text,
  officer_id uuid not null references profiles(id),
  e_kg numeric(12,3), e_rel numeric(9,6),
  balance_status text not null default 'belum_dievaluasi'
    check (balance_status in ('belum_dievaluasi','lolos','ditandai')),
  needs_review boolean not null default false,
  version int not null default 1,
  client_created_at timestamptz,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, code)
);
create index on batches (facility_id, received_at desc);

create table public.batch_items (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  batch_id uuid not null references batches(id),
  category_id uuid not null references material_categories(id),
  weight_sorted_kg numeric(12,3) not null check (weight_sorted_kg >= 0),
  weight_in_est_kg numeric(12,3),
  unique (batch_id, category_id)
);

create table public.onsite_processing (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  batch_id uuid not null references batches(id),
  method text not null check (method in ('kompos','maggot','lainnya')),
  weight_kg numeric(12,3) not null check (weight_kg >= 0)
);

create table public.shipments (
  id uuid primary key,
  facility_id uuid not null references facilities(id),
  partner_id uuid not null references partners(id),
  purpose public.outbound_purpose not null,
  shipped_at timestamptz not null,
  photo_path text,
  officer_id uuid not null references profiles(id),
  status text not null default 'dikirim'
    check (status in ('dikirim','dikonfirmasi','ditolak','kedaluwarsa','void')),
  void_reason text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on shipments (facility_id, shipped_at desc);

create table public.shipment_lines (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  shipment_id uuid not null references shipments(id),
  batch_id uuid not null references batches(id),
  category_id uuid not null references material_categories(id),
  weight_kg numeric(12,3) not null check (weight_kg > 0)
);
create index on shipment_lines (batch_id);
create index on shipment_lines (shipment_id);

create table public.confirmation_tokens (        -- tanpa kebijakan RLS: hanya service role
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  failed_attempts int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  shipment_id uuid not null unique references shipments(id),
  weight_received_kg numeric(12,3) check (weight_received_kg >= 0),   -- W'_k
  status text not null check (status in ('diterima','ditolak_tidak_sesuai')),
  method text not null default 'token_link',
  photo_path text,
  note text,
  device_info jsonb,                                  -- user agent kasar + hash IP
  confirmed_at timestamptz not null default now()
);

create table public.stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  snapshot_date date not null,
  category_id uuid not null references material_categories(id),
  weight_kg numeric(12,3) not null check (weight_kg >= 0),
  unique (facility_id, snapshot_date, category_id)
);

create table public.threshold_sets (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id),          -- null = global
  version int not null,
  status text not null default 'draft' check (status in ('draft','beku','pensiun')),
  provisional boolean not null default true,
  params jsonb not null,
  category_stats jsonb not null default '{}'::jsonb,   -- {plastik:{n,median,mad,meanAd}, pooled:{...}}
  calibration_from date, calibration_to date,
  frozen_at timestamptz, frozen_by uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create unique index threshold_sets_ver_uq on threshold_sets (coalesce(facility_id::text,'global'), version);

create table public.anomalies (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  batch_id uuid references batches(id),
  shipment_id uuid references shipments(id),
  target_date date,                                    -- untuk R5
  rule_code text not null check (rule_code in ('R1','R2','R3','R4','R5','R6','R7')),
  severity text not null check (severity in ('tinggi','sedang','rendah','info')),
  score numeric, measured numeric, threshold numeric,
  detail jsonb not null default '{}'::jsonb,
  reason_text text not null,
  threshold_set_id uuid references threshold_sets(id),
  provisional boolean not null default false,
  engine_version text not null,
  status text not null default 'open'
    check (status in ('open','dikoreksi','dijelaskan','tidak_terjelaskan')),
  cause text check (cause in ('salah_timbang','susut_alami','kadar_air','salah_input','kesalahan_alat','lainnya')),
  review_note text,
  reviewed_by uuid references profiles(id), reviewed_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  check (batch_id is not null or shipment_id is not null or target_date is not null)
);
create unique index anomalies_active_uq on anomalies
  (facility_id, coalesce(batch_id::text, shipment_id::text, target_date::text), rule_code)
  where superseded_at is null;

create table public.reported_figures (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  period_start date not null, period_end date not null,
  reported_recycled_kg numeric(14,3) not null check (reported_recycled_kg >= 0),
  source_note text,
  unique (facility_id, period_start, period_end)
);

create table public.period_reports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  period_start date not null, period_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  total_in_kg numeric(14,3), verified_kg numeric(14,3), verified_p_kg numeric(14,3),
  rr numeric(9,6), vrr numeric(9,6), vrr_p numeric(9,6), gap numeric(9,6),
  coverage jsonb, blockers jsonb,
  threshold_set_id uuid references threshold_sets(id),
  engine_version text,
  snapshot_hash text,
  closed_by uuid references profiles(id), closed_at timestamptz,
  unique (facility_id, period_start, period_end)
);

create table public.hash_anchors (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  seq_upto bigint not null, hash text not null,
  channel text not null, anchored_at timestamptz not null default now()
);

-- Riset dan evaluasi
create table public.pilot_baseline (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  record_date date not null, category_id uuid references material_categories(id),
  weight_kg numeric(12,3) not null, source text, photo_path text
);
create table public.reference_weighings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  batch_id uuid references batches(id),
  facility_scale_kg numeric(12,3) not null, reference_scale_kg numeric(12,3) not null,
  weighed_by uuid references profiles(id), weighed_at timestamptz not null default now()
);
create table public.sus_responses (
  id uuid primary key default gen_random_uuid(),
  participant_code text not null, role text,
  answers int[] not null check (array_length(answers,1) = 10),
  score numeric(5,2) not null, consent boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.usage_metrics (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  user_id uuid not null references profiles(id),
  action text not null, started_at timestamptz not null, ended_at timestamptz not null,
  taps int, device text
);

create table public.sync_ops (
  client_op_id uuid primary key,
  user_id uuid not null,
  facility_id uuid,
  device_id text,
  op_type text not null,
  status text not null check (status in ('ok','rejected','conflict')),
  result jsonb,
  received_at timestamptz not null default now()
);
create table public.consents (
  user_id uuid not null references profiles(id),
  doc_version text not null, accepted_at timestamptz not null default now(),
  primary key (user_id, doc_version)
);
create table public.feature_flags (key text primary key, enabled boolean not null default false, note text);
```

### A.3 Audit trail berantai hash (trigger)

```sql
create table public.event_log (
  id bigint generated always as identity primary key,
  facility_id uuid not null,
  seq bigint not null,
  entity text not null,
  entity_id text not null,
  action text not null,
  old_value jsonb, new_value jsonb,
  actor_id uuid, actor_role text,
  client_op_id uuid,
  occurred_at timestamptz not null,
  prev_hash text not null,
  hash text not null,
  unique (facility_id, seq)
);

create or replace function app.log_event() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_fac uuid; v_prev_hash text; v_prev_seq bigint;
  v_old jsonb; v_new jsonb; v_action text; v_now timestamptz := clock_timestamp();
  v_actor uuid := auth.uid(); v_payload text; v_op text;
begin
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_new := to_jsonb(new);
  v_fac := coalesce((v_new->>'facility_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
  v_action := lower(tg_op);

  perform pg_advisory_xact_lock(hashtextextended(v_fac::text, 0));
  select seq, hash into v_prev_seq, v_prev_hash
    from event_log where facility_id = v_fac order by seq desc limit 1;
  if not found then v_prev_seq := 0; v_prev_hash := repeat('0', 64); end if;

  v_payload := concat_ws('|', tg_table_name, coalesce(v_new->>'id',''), v_action,
    coalesce(v_old::text,''), coalesce(v_new::text,''), coalesce(v_actor::text,''),
    to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US'));
  v_op := nullif(current_setting('app.client_op_id', true), '');

  insert into event_log (facility_id, seq, entity, entity_id, action, old_value, new_value,
                         actor_id, actor_role, client_op_id, occurred_at, prev_hash, hash)
  values (v_fac, v_prev_seq + 1, tg_table_name, coalesce(v_new->>'id',''), v_action, v_old, v_new,
          v_actor, app.my_role()::text, v_op::uuid, v_now, v_prev_hash,
          encode(digest(convert_to(v_prev_hash || v_payload, 'utf8'), 'sha256'), 'hex'));
  return new;
end $$;

create or replace function app.block_delete() returns trigger language plpgsql as $$
begin raise exception 'Penghapusan fisik tidak diizinkan (gunakan status void)'; end $$;

create or replace function app.block_mutation() returns trigger language plpgsql as $$
begin raise exception 'event_log bersifat append-only'; end $$;

-- Pasang pada semua tabel yang diaudit (semua punya kolom id; hampir semua punya facility_id)
do $$
declare t text;
begin
  foreach t in array array['batches','batch_items','onsite_processing','shipments','shipment_lines',
    'confirmations','anomalies','threshold_sets','reported_figures','period_reports','profiles','partners']
  loop
    execute format('create trigger trg_audit_%1$s after insert or update on public.%1$s
                    for each row execute function app.log_event()', t);
    execute format('create trigger trg_nodelete_%1$s before delete on public.%1$s
                    for each row execute function app.block_delete()', t);
  end loop;
end $$;
```

```sql
create trigger trg_event_log_immutable before update or delete on public.event_log
  for each row execute function app.block_mutation();
create trigger trg_event_log_notruncate before truncate on public.event_log
  for each statement execute function app.block_mutation();
revoke all on public.event_log from anon, authenticated;
grant select on public.event_log to authenticated;

-- Ambang beku tidak boleh diubah
create or replace function app.protect_frozen_threshold() returns trigger language plpgsql as $$
begin
  if old.status = 'beku' and (
       new.params is distinct from old.params
    or new.category_stats is distinct from old.category_stats
    or (new.status <> old.status and new.status <> 'pensiun')) then
    raise exception 'Ambang yang sudah dibekukan tidak dapat diubah. Buat versi baru.';
  end if;
  return new;
end $$;
create trigger trg_protect_threshold before update on public.threshold_sets
  for each row execute function app.protect_frozen_threshold();

-- Verifikasi rantai
create or replace function public.verify_chain(p_facility uuid)
returns table(ok boolean, checked bigint, broken_at bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_prev text := repeat('0',64); v_expected text; v_n bigint := 0;
begin
  if not app.can_read_facility(p_facility) then raise exception 'akses ditolak'; end if;
  for r in select * from event_log where facility_id = p_facility order by seq loop
    v_n := v_n + 1;
    if r.seq <> v_n or r.prev_hash <> v_prev then
      return query select false, v_n, r.seq; return;
    end if;
    v_expected := encode(digest(convert_to(r.prev_hash || concat_ws('|', r.entity, r.entity_id, r.action,
      coalesce(r.old_value::text,''), coalesce(r.new_value::text,''), coalesce(r.actor_id::text,''),
      to_char(r.occurred_at at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US')), 'utf8'), 'sha256'), 'hex');
    if v_expected <> r.hash then return query select false, v_n, r.seq; return; end if;
    v_prev := r.hash;
  end loop;
  return query select true, v_n, null::bigint;
end $$;
```



> Catatan: `verify_chain` mendeteksi perubahan pada baris `event_log`. Untuk P2, tambahkan `verify_state()` yang membandingkan kondisi terkini tiap tabel dengan `new_value` event terakhirnya, agar perubahan langsung pada tabel (dengan trigger dimatikan oleh pemilik DB) juga terdeteksi.

### A.4 Row Level Security

```sql
do $$
declare t text;
begin
  -- Tabel berfasilitas: hanya SELECT untuk pengguna terautentikasi
  foreach t in array array['batches','batch_items','onsite_processing','shipments','shipment_lines',
    'confirmations','stock_snapshots','anomalies','reported_figures','period_reports','partners',
    'pilot_baseline','reference_weighings','usage_metrics','hash_anchors','event_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (app.can_read_facility(facility_id))', t||'_sel', t);
  end loop;
end $$;

alter table public.organizations enable row level security;
create policy org_sel on public.organizations for select to authenticated
  using (app.my_role() = 'admin' or id = app.my_org()
         or id = (select org_id from facilities where id = app.my_facility()));

alter table public.facilities enable row level security;
create policy fac_sel on public.facilities for select to authenticated
  using (app.can_read_facility(id));

alter table public.profiles enable row level security;
create policy prof_sel on public.profiles for select to authenticated
  using (id = auth.uid() or (facility_id is not null and app.can_read_facility(facility_id))
         or app.my_role() = 'admin');
-- Pada produksi: sediakan view `profiles_public(id, display_name, role, facility_id)` untuk dinas
-- agar username tidak terbaca.

alter table public.material_categories enable row level security;
create policy cat_sel on public.material_categories for select to authenticated using (true);

alter table public.threshold_sets enable row level security;
create policy thr_sel on public.threshold_sets for select to authenticated
  using (facility_id is null or app.can_read_facility(facility_id));

alter table public.sync_ops enable row level security;
create policy sync_sel on public.sync_ops for select to authenticated using (user_id = auth.uid());

alter table public.sus_responses enable row level security;
create policy sus_sel on public.sus_responses for select to authenticated
  using (app.my_role() in ('admin','pengelola'));

alter table public.consents enable row level security;
create policy cons_sel on public.consents for select to authenticated using (user_id = auth.uid());

alter table public.feature_flags enable row level security;
create policy ff_sel on public.feature_flags for select to authenticated using (true);

alter table public.confirmation_tokens enable row level security;   -- tanpa kebijakan = hanya service role

-- Storage (bucket privat 'evidence'; jalur: <facility_id>/<yyyy>/<mm>/<uuid>.jpg)
create policy evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and app.can_read_facility(((storage.foldername(name))[1])::uuid));
create policy evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and app.can_write_facility(((storage.foldername(name))[1])::uuid));
```

### A.5 RPC penulisan (kerangka `apply_op`)

Semua penulisan klien melewati fungsi ini. Pola yang sama dipakai untuk setiap `op_type` di 8.3. Implementasikan semuanya, termasuk validasi status (mis. batch `void` menolak operasi lanjutan) dan deteksi konflik `base_version`.

```sql
create or replace function public.apply_op(p_op jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := (p_op->>'client_op_id')::uuid;
  v_type text := p_op->>'op_type';
  v_pl jsonb := p_op->'payload';
  v_fac uuid := app.my_facility();
  v_prev jsonb; v_res jsonb;
begin
  if auth.uid() is null then raise exception 'tidak terautentikasi'; end if;
  select result into v_prev from sync_ops where client_op_id = v_id;
  if found then return v_prev; end if;                       -- idempoten
  if v_fac is null or not app.can_write_facility(v_fac) then
    return jsonb_build_object('status','rejected','code','forbidden',
                              'message','Anda tidak punya izin untuk aksi ini.');
  end if;
  perform set_config('app.client_op_id', v_id::text, true);

  case v_type
    when 'batch.create' then
      insert into batches (id, facility_id, code, source_type, source_name, weight_in_total_kg,
                           received_at, officer_id, client_created_at, device_id)
      values ((v_pl->>'id')::uuid, v_fac, v_pl->>'code', v_pl->>'source_type', v_pl->>'source_name',
              (v_pl->>'weight_in_total_kg')::numeric, (v_pl->>'received_at')::timestamptz,
              auth.uid(), (p_op->>'client_time')::timestamptz, p_op->>'device_id')
      on conflict (id) do nothing;
      v_res := jsonb_build_object('status','ok');
    -- when 'batch.update_items'  then ...   (upsert batch_items, ubah status -> 'dipilah')
    -- when 'batch.close'         then ...   (wajib remaining_stock_kg, foto, set closed_at, panggil engine-run)
    -- when 'batch.correct'       then ...   (alasan wajib, cek base_version, naikkan version)
    -- when 'shipment.create'     then ...   (lines wajib, jumlah tidak melebihi sisa batch)
    -- when 'shipment.reissue_token' ...     (dipanggil via Edge Function karena butuh service role)
    else
      v_res := jsonb_build_object('status','rejected','code','unknown_op',
                                  'message','Jenis operasi tidak dikenal.');
  end case;

  insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
  values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, v_res->>'status', v_res);
  return v_res;
exception when others then
  insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
  values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected',
          jsonb_build_object('status','rejected','code','error','message', sqlerrm))
  on conflict do nothing;
  return jsonb_build_object('status','rejected','code','error','message', sqlerrm);
end $$;
revoke all on function public.apply_op(jsonb) from anon;
grant execute on function public.apply_op(jsonb) to authenticated;
```

> Penting: kode batch (6 karakter) dibuat klien. Jika bentrok dengan `unique (facility_id, code)`, server membuat kode baru dan mengembalikannya di hasil agar klien memperbarui tampilan QR.

### A.6 Seed ambang awal (sementara, bukan klaim ilmiah)

```sql
insert into threshold_sets (facility_id, version, status, provisional, params, note) values
(null, 1, 'draft', true,
 '{"tau_neg":0.02,"tau_d":0.05,"z_cutoff":3.5,"min_n":20,"ack_timeout_hours":72,
   "gap_small":0.05,"coverage_low":0.6,"r7_enabled":false}'::jsonb,
 'NILAI SEMENTARA untuk pengembangan. Wajib diganti dengan hasil kalibrasi data pilot sebelum dibekukan.');

insert into material_categories (code, name, sort_order) values
 ('organik','Organik',1),('plastik','Plastik',2),('kertas','Kertas',3),
 ('logam','Logam',4),('kaca','Kaca',5),('residu','Residu',6);
```

---

## LAMPIRAN B — MESIN NERACA MASSA (`packages/engine/src/index.ts`)

Kode referensi ini **sudah dijalankan dan lulus** terhadap vektor uji 6.7 (kecuali kasus yang butuh data pilot). AI builder wajib memakainya apa adanya sebagai dasar, menambahkan: `evaluateDaily` (R5), `evaluateR7`, pembentuk kalimat alasan, dan fungsi pemilih kelompok kategori dominan.

```ts
export const ENGINE_VERSION = '1.0.0';

export interface BalanceInput { mIn: number; mRec: number; mOrg: number; mRes: number; deltaS: number }
export interface BalanceResult { e: number; eRel: number | null }

export function balance(i: BalanceInput): BalanceResult {
  const e = i.mIn - (i.mRec + i.mOrg + i.mRes + i.deltaS);
  return { e, eRel: i.mIn > 0 ? e / i.mIn : null };
}

export function relDiff(wSent: number, wReceived: number): number | null {
  return wSent > 0 ? Math.abs(wSent - wReceived) / wSent : null;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const mad = (xs: number[]) => { const m = median(xs); return median(xs.map(x => Math.abs(x - m))); };
export const meanAd = (xs: number[]) => { const m = median(xs); return xs.reduce((a, x) => a + Math.abs(x - m), 0) / xs.length; };

export interface RobustStats { n: number; median: number; mad: number; meanAd: number }
export const statsOf = (xs: number[]): RobustStats =>
  ({ n: xs.length, median: median(xs), mad: mad(xs), meanAd: meanAd(xs) });

export type ZMethod = 'mad' | 'meanad' | 'none';
/** Skor z robust (Iglewicz & Hoaglin). Jika MAD=0 pakai varian MeanAD; jika keduanya 0 → tidak dihitung. */
export function robustZ(x: number, s: RobustStats): { z: number | null; method: ZMethod } {
  if (s.mad > 0) return { z: 0.6745 * (x - s.median) / s.mad, method: 'mad' };
  if (s.meanAd > 0) return { z: (x - s.median) / (1.253314 * s.meanAd), method: 'meanad' };
  return { z: null, method: 'none' };
}

export interface Thresholds {
  tauNeg: number; tauD: number; zCutoff: number; minN: number;
  provisional: boolean;
  groupStats: Record<string, RobustStats>; // kunci: kategori dominan, plus 'pooled'
}
export type RuleCode = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';
export interface Flag {
  rule: RuleCode; severity: 'tinggi' | 'sedang' | 'rendah' | 'info';
  measured: number | null; threshold: number | null; z?: number | null;
  provisional: boolean; note?: string;
}

export function evaluateBatch(
  b: BalanceInput & { dominantCategory: string | null; hasPhoto: boolean; hasOutput: boolean },
  th: Thresholds
): Flag[] {
  const flags: Flag[] = [];
  const { eRel } = balance(b);
  if (eRel === null) return flags;
  if (eRel < -th.tauNeg)
    flags.push({ rule: 'R2', severity: 'tinggi', measured: eRel, threshold: -th.tauNeg, provisional: th.provisional });
  if (b.mIn >= 1) {
    const g = th.groupStats[b.dominantCategory ?? ''];
    const pooled = th.groupStats['pooled'];
    const s = g && g.n >= th.minN ? g : pooled && pooled.n >= th.minN ? pooled : null; // n kecil → R1 tidak jalan
    if (s) {
      const { z } = robustZ(eRel, s);
      if (z !== null && Math.abs(z) > th.zCutoff)
        flags.push({ rule: 'R1', severity: 'tinggi', measured: eRel, threshold: th.zCutoff, z, provisional: th.provisional });
    }
  }
  if (!b.hasPhoto || !b.hasOutput)
    flags.push({ rule: 'R6', severity: 'sedang', measured: null, threshold: null, provisional: false });
  return flags;
}

export function evaluateShipment(
  s: { wSent: number; wReceived: number | null; confirmed: boolean; ageHours: number; ackTimeoutHours: number; hasLines: boolean },
  th: Thresholds
): Flag[] {
  const flags: Flag[] = [];
  if (!s.hasLines) flags.push({ rule: 'R6', severity: 'sedang', measured: null, threshold: null, provisional: false });
  if (s.confirmed && s.wReceived !== null) {
    const d = relDiff(s.wSent, s.wReceived);
    if (d !== null && d > th.tauD)
      flags.push({ rule: 'R3', severity: 'tinggi', measured: d, threshold: th.tauD, provisional: th.provisional });
  } else if (s.ageHours > s.ackTimeoutHours) {
    flags.push({ rule: 'R4', severity: 'sedang', measured: s.ageHours, threshold: s.ackTimeoutHours, provisional: false });
  }
  return flags;
}

export type R12State = 'none' | 'active' | 'explained';   // active = open atau tidak_terjelaskan
export interface MetricBatch { id: string; mIn: number; closed: boolean; r12: R12State }
export interface MetricShipment {
  id: string; purpose: 'daur_ulang' | 'organik_olah' | 'residu';
  wSent: number; wReceived: number | null; confirmed: boolean; batchIds: string[];
}

export function periodMetrics(a: {
  batches: MetricBatch[]; shipments: MetricShipment[]; reportedRecycledKg: number; tauD: number;
}) {
  const closed = a.batches.filter(b => b.closed);
  const totalIn = closed.reduce((s, b) => s + b.mIn, 0);
  const byId = new Map(closed.map(b => [b.id, b] as const));
  let verified = 0, verifiedP = 0, confirmedN = 0, recyclingN = 0;
  for (const s of a.shipments) {
    if (s.purpose !== 'daur_ulang') continue;
    recyclingN++;
    if (!(s.confirmed && s.wReceived !== null)) continue;
    confirmedN++;
    const d = relDiff(s.wSent, s.wReceived);
    if (d === null || d > a.tauD) continue;
    const bs = s.batchIds.map(id => byId.get(id)).filter((x): x is MetricBatch => !!x);
    if (bs.length !== s.batchIds.length) continue;
    if (bs.every(b => b.r12 === 'none')) verified += s.wReceived;       // VRR ketat
    if (bs.every(b => b.r12 !== 'active')) verifiedP += s.wReceived;    // VRR dengan peninjauan
  }
  const div = (x: number) => (totalIn > 0 ? x / totalIn : null);
  const rr = div(a.reportedRecycledKg), vrr = div(verified), vrrP = div(verifiedP);
  return {
    totalIn, verifiedKg: verified, verifiedKgP: verifiedP, rr, vrr, vrrP,
    gap: rr !== null && vrr !== null ? rr - vrr : null,
    coverage: { batches: closed.length, shipmentsConfirmedPct: recyclingN ? confirmedN / recyclingN : null },
  };
}
```

**Berkas uji (`engine.test.ts`, Vitest):** ubah fungsi `eq` pada skrip uji menjadi `expect(...).toBeCloseTo(...)`. Kasus yang sudah diverifikasi: e=6 dan e_rel=0,06; e=−8; d_k=0,06; median=12 dan MAD=1; z(50)=25,63 (≈25,6); z(13)=0,67; fallback MeanAD (z≈3,99); RR=0,45, VRR=0,30, Gap=0,15; status `explained` → VRR ketat 0 dan VRR dengan peninjauan 0,30.

### B.1 Templat kalimat alasan anomali

| Kode | Templat (isi `{}` dari nilai nyata) |
|---|---|
| R1 | "Selisih penutupan batch {e_rel%} ({e} kg dari {m_in} kg) berada di luar rentang wajar untuk kategori dominan {kategori} (skor z {z}, batas {z_cutoff}). Ambang v{versi}, {sementara/beku}." |
| R2 | "Massa keluar dan stok ({keluar} kg) melebihi massa masuk ({m_in} kg). Selisih {e_rel%}, batas toleransi {tau_neg%}." |
| R3 | "Berat kirim {w} kg berbeda {d_k%} dari berat terima {w'} kg. Batas selisih {tau_d%}." |
| R4 | "Pengiriman belum dikonfirmasi penerima setelah {jam} jam (batas {ack} jam)." |
| R5 | "Total masuk {tanggal} sebesar {x} kg jauh dari kebiasaan 28 hari terakhir (median {med} kg)." |
| R6 | "Data belum lengkap: {foto timbangan / waktu / catatan keluaran} belum ada." |
| R7 | "Proporsi berat berakhiran 0 atau 5 tinggi ({p%}) dibanding perkiraan 20%. Ini indikator lemah, bukan bukti." |

---

## LAMPIRAN C — KONTRAK EDGE FUNCTION

| Fungsi | Auth | Masukan | Keluaran | Galat penting |
|---|---|---|---|---|
| `sync-push` | JWT pengguna | `{ device_id, ops:[{client_op_id, op_type, payload, client_time, base_version?}] }` (maks 25) | `{ results:[{client_op_id, status:'ok'|'rejected'|'conflict', code?, message?, data?}] }` | 401 sesi habis (klien menahan antrean), 413 terlalu besar |
| `sync-pull` | JWT pengguna | `?since=<ISO>` | `{ server_time, tables:{batches:[...], ...}, tombstones:[...] }` | — |
| `shipment-token` | JWT pengguna (write) | `{ shipment_id }` | `{ url, expires_at }` (token mentah hanya muncul sekali) | 409 pengiriman sudah dikonfirmasi |
| `confirm-get` | **anon + token** | `{ token }` | `{ facility_name, shipped_date, materials:[nama], expires_at }` — **tanpa berat kirim** | 404 token salah, 410 kedaluwarsa/terpakai, 429 batas laju |
| `confirm-submit` | **anon + token** | `{ token, status, weight_received_kg?, note?, photo? }` | `{ ok:true }` | 410, 422 validasi, 429 |
| `engine-run` | service / webhook DB | `{ facility_id, scope:'batch'|'shipment'|'daily'|'all', id? }` | `{ anomalies_created, superseded, engine_version }` | — |
| `review-anomaly` | JWT pengelola | `{ anomaly_id, status, cause?, note }` | `{ ok }` | 422 catatan < 10 karakter bila `lainnya` |
| `report-close` | JWT pengelola | `{ facility_id, period_start, period_end, reported_recycled_kg }` | `{ report }` | 409 periode sudah ditutup |
| `admin-user` | JWT admin/pengelola | `{ action:'create'|'deactivate'|'reset', ... }` | `{ ok, temp_password? }` | 403 |
| `threshold-freeze` | JWT admin/pengelola | `{ threshold_set_id }` | `{ ok }` | 409 sudah beku |
| `cron-daily` | cron | — | menandai pengiriman `kedaluwarsa`, menjalankan R4/R5, email pengingat | — |
| `anchor-hash` | cron | — | email hash terakhir per fasilitas + isi `hash_anchors` | — |
| `export-data` | JWT admin/dinas | `{ dataset, facility_ids?, period }` | berkas CSV/JSON (dicatat di log) | 403 |

Semua fungsi: validasi zod, batas ukuran, CORS terbatas ke domain aplikasi, log terstruktur tanpa PII, kode galat konsisten dengan pesan bahasa Indonesia untuk pengguna.

---

## LAMPIRAN D — KEPUTUSAN TERBUKA YANG HARUS DIKONFIRMASI TIM

AI builder memakai nilai bawaan ini dan mencatat di `docs/ASSUMPTIONS.md`. Tim memutuskan bersama pengelola mitra dan dosen pembimbing.

| # | Pertanyaan | Bawaan sementara |
|---|---|---|
| 1 | Apakah pengiriman gabungan lintas batch (shipment_lines) cocok dengan praktik TPS3R mitra? | Ya (D2) |
| 2 | Periode laporan: bulanan atau mingguan untuk pilot? | Mingguan untuk pilot, bulanan setelahnya |
| 3 | Batas waktu konfirmasi (`ack_timeout_hours`) | 72 jam |
| 4 | Ambang sementara τ_neg, τ_d | 2% dan 5%, **hanya sementara** sampai kalibrasi |
| 5 | Persentil untuk usulan τ dari timbangan referensi | P95 selisih relatif |
| 6 | Apakah angka laporan pengelola (RR) bisa diperoleh per periode? | Diisi manual pengelola |
| 7 | Foto bukti wajib untuk semua pengiriman atau hanya `daur_ulang`? | Hanya `daur_ulang` |
| 8 | Lokasi penyimpanan data apakah dinas mensyaratkan server di Indonesia? | Belum diketahui, tanyakan |
| 9 | Kepemilikan dan lisensi kode setelah lomba | Putuskan dengan unit HKI kampus |
| 10 | Nama domain dan kanal dukungan (WhatsApp pendamping) | Isi sebelum rilis |

---

## LAMPIRAN E — KETERLACAKAN KE DOKUMEN INDUK

| Dokumen induk | Dipenuhi oleh |
|---|---|
| F01 Login berperan | M1 |
| F02 Batch + QR | M2 |
| F03 Berat masuk + foto | M2 |
| F04 Hasil pilah | M2 |
| F05 Pengeluaran | M3 |
| F06 Konfirmasi penerima | M3 |
| F07 Offline + konflik | M4, bagian 8 |
| F08 Neraca massa | M5, 6.2 |
| F09 Deteksi anomali | M6, 6.4 |
| F10 VRR dan Gap | M7, 6.6 |
| F11 Dasbor dinas | M8 |
| F12 Antrean tinjauan | M6 |
| F13 Audit trail berantai hash | M9, bagian 9, A.3 |
| F14 Laporan PDF dan CSV | M10 |
| F15 Impor timbangan IoT | Fase 8 (P2) |
| F16 Notifikasi batas waktu | M13 |
| N01–N08 | bagian 14 |
| E1–E6 | bagian 13 |
| RM1, RM2, RM3 | M2–M3, M5–M6, M7–M8 + bagian 13 |

---

*Akhir dokumen. Versi 1.0 — disusun dari Dokumen Induk SIRKULA (3 Nov 2026).*
