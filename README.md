# SIRKULA: Sistem Informasi Ketertelusuran & Verifikasi Daur Ulang Riil (VRR) TPS 3R

SIRKULA adalah aplikasi web *progressive* (PWA) berbasis neraca massa dinamis (*dynamic mass balance*) dan audit trail kriptografis (SHA-256 hash-chaining) untuk mengukur tingkat daur ulang riil (*Verified Recycling Rate* / VRR) pada Tempat Pengolahan Sampah Reuse-Reduce-Recycle (TPS 3R).

Aplikasi ini mengatasi kelemahan pelaporan daur ulang berbasis estimasi manual dan klaim sepihak melalui **protokol konfirmasi penerima buta (*blind confirmation*)**, audit trail berantai pada tingkat basis data, serta kemampuan operasional *offline-first*.

---

## 🚀 Fitur Utama

1. **Neraca Massa Konservatif & Deteksi Anomali Otomatis (R1 s.d. R6):**
   - Menghitung *closure error* mutlak ($e$) dan relatif ($e_{\text{rel}}$) per batch.
   - Aturan deteksi anomali: $R_1$ (Closure error negatif), $R_2$ (Indikasi bocor), $R_3$ (Selisih timbangan dua pihak), $R_4$ (Timeout konfirmasi mitra), $R_5$ (Material tanpa bukti foto), $R_6$ (Fluktuasi outlier).
2. **Protokol Konfirmasi Penerima Buta (F06):**
   - Tautan WhatsApp sekali pakai (*single-use cryptographic token*) dengan batas waktu (default 72 jam).
   - Mitra penerima menginput berat riil timbangan mereka tanpa melihat berat kirim dari fasilitas, menjamin kebenaran independen (*ground truth*).
3. **Audit Trail Berantai SHA-256 (Append-Only):**
   - Setiap mutasi data dikaitkan dengan hash baris sebelumnya via trigger PostgreSQL `app.log_event()`.
   - Verifikasi keutuhan rantai langsung di server lewat `public.verify_chain(facility_id)`.
4. **Offline-First Lapangan (C-Lite):**
   - Menggunakan Dexie (IndexedDB) untuk pencatatan tanpa sinyal internet.
   - Antrean penulisan (*outbox*) disinkronkan otomatis saat online kembali secara idempoten via RPC `public.apply_op`.
5. **Portal Pengawasan Dinas (F11):**
   - Peta interaktif fasilitas se-wilayah dengan Leaflet dan OpenStreetMap.
   - Grafik tren perbandingan Klaim ($RR$) vs Terverifikasi ($VRR$) vs $Gap$ menggunakan Recharts.
   - Daftar prioritas audit fasilitas terurut otomatis.
6. **Portal Verifikasi Publik Bebas Login:**
   - Siapa pun dapat memeriksa keaslian snapshot kriptografis laporan periode melalui rute `/verifikasi/:reportId`.

---

## 🛠️ Arsitektur Teknologi

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion, Lucide Icons.
- **Offline Storage:** Dexie.js (IndexedDB).
- **Backend & Database:** Supabase (PostgreSQL 15+, Row-Level Security, RPC Functions, Extensions `pgcrypto`).
- **Serverless Edge Functions:** Deno runtime untuk token hashing, cron harian, dan penjangkaran mingguan.
- **Testing:** Vitest (10/10 vektor uji neraca massa matematis lolos).

---

## ⚙️ Variabel Lingkungan (.env)

Buat berkas `.env` dari `.env.example`:

```env
# URL dan Kunci Publik Supabase
VITE_SUPABASE_URL="https://<YOUR_PROJECT_ID>.supabase.co"
VITE_SUPABASE_ANON_KEY="<YOUR_ANON_PUBLIC_KEY>"

# Lingkungan: "demo" atau "production"
VITE_APP_ENV="production"

# Alamat Aplikasi (untuk pembuatan tautan konfirmasi)
APP_BASE_URL="https://sirkula.id"
```

### Rahasia Supabase Edge Functions (Secrets):
```bash
TOKEN_PEPPER="kunci_rahasia_acak_minimal_32_karakter_sirkula"
APP_BASE_URL="https://sirkula.id"
```

---

## 📦 Panduan Instalasi & Menjalankan Lokal

```bash
# 1. Pasang dependensi
npm install

# 2. Jalankan pengetesan matematis neraca massa
npm run test

# 3. Jalankan server pengembangan
npm run dev
```

Server pengembangan akan aktif pada `http://localhost:3000`.

---

## 🗄️ Menyiapkan Database Supabase

Jalankan berkas migrasi SQL secara berurutan di **Supabase SQL Editor**:
1. `supabase/migrations/0001_extensions_and_enums.sql`
2. `supabase/migrations/0002_core_tables.sql`
3. `supabase/migrations/0003_audit_trail_and_hash_chain.sql`
4. `supabase/migrations/0004_row_level_security.sql`
5. `supabase/migrations/0005_rpc_apply_op.sql`
6. `supabase/migrations/0006_initial_thresholds_seed.sql`
7. `supabase/migrations/0007_apply_op_role_checks.sql`
8. `supabase/migrations/0008_fix_correct_audit.sql`
9. `supabase/migrations/0009_blind_confirmation_and_functions.sql`

Untuk mengisikan data simulasi lengkap (1 dinas, 6 fasilitas, mitra, batch riil, dan anomali):
- Jalankan `supabase/seed/demo_seed.sql`.

---

## 🔒 Kebijakan Hak Akses (RBAC Matrix)

| Peran | Ruang Lingkup | Hak Akses |
|---|---|---|
| `petugas_tps3r` | Fasilitas sendiri | Catat batch masuk, pilah material, tutup batch, buat pengiriman mitra |
| `pengelola` | Fasilitas sendiri | Seluruh hak petugas + tinjau anomali, tutup periode verifikasi, batalkan (void) batch |
| `dinas` | Seluruh wilayah | Akses baca (*read-only*), peta pengawasan, grafik tren, daftar prioritas audit |
| `admin` | Seluruh sistem | Hak penuh lintas organisasi, riset perbandingan, dan manajemen parameter global |

---

## 📄 Lisensi

Hak Cipta © 2026 Tim Peneliti SIRKULA. Seluruh hak cipta dilindungi undang-undang.
