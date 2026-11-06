# Catatan Perubahan SIRKULA (CHANGELOG)

Semua perubahan penting pada sistem verifikasi neraca massa SIRKULA didokumentasikan dalam berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

---

## [1.0.0] - 2026-11-06 (Rilis Final Paket Penyelesaian)

### Ditambahkan
- **Tahap D - Blind Confirmation F06:**
  - Migrasi skema `supabase/migrations/0009_blind_confirmation_and_functions.sql` dengan tabel `hash_anchors`, RPC `create_shipment_token`, `get_confirmation_details`, dan `submit_blind_confirmation`.
  - Halaman publik `/k/:token` (`src/components/public/RecipientConfirmPage.tsx`) dengan alur konfirmasi tanpa membocorkan bobot timbangan awal TPS3R.
  - Kompresi foto bukti timbangan di sisi klien berbasis Canvas HTML5 ($\le 250\text{ KB}$).
  - Integrasi pembagian tautan instan via WhatsApp dan salin tautan di `ShipmentCreateModal.tsx`.
  - Tombol penerbitan ulang tautan token yang kedaluwarsa atau hilang.
  - Penanganan batas laju panggilan (*rate limiting*) dan kode galat HTTP 400, 404, 410, 429.

- **Tahap E - Perhitungan Resmi & Audit Sisi Server:**
  - Supabase Edge Functions:
    - `engine-run`: Eksekusi perhitungan neraca massa resmi di server.
    - `report-close`: Penutupan buku periode neraca massa dengan hash status terkunci.
    - `cron-daily`: Pemeriksaan otomatis anomali harian.
    - `anchor-hash`: Perekaman jangkar hash audit harian.
    - `shipment-token`, `confirm-get`, `confirm-submit`: Peladen perantara konfirmasi mitra.
  - Migrasi verifikasi rantai audit `verify_chain(p_facility)` dari klien ke fungsi basis data PostgreSQL terisolasi.
  - Dasbor Dinas Lingkungan Hidup (`src/components/dinas/DinasDashboard.tsx`):
    - Visualisasi tren *Recovery Rate* (RR), *Verified Recovery Rate* (VRR), dan *Traceability Gap* dengan Recharts.
    - Peta interaktif Leaflet + OpenStreetMap menampilkan status fasilitas berdasarkan indikator warna.
    - Tabel prioritas audit (*Priority Audit Queue*) mengurutkan fasilitas berdasarkan rasio anomali terbuka dan besaran gap.
  - Lencana ambang batas provisori (*provisional badge*) di seluruh tampilan terkait metrik neraca massa.

- **Tahap C-lite - Offline-First & Sinkronisasi:**
  - Basis data lokal IndexedDB dengan Dexie (`src/lib/db.ts`) untuk tabel antrean keluar (`outbox`) dan tembolok fasilitas.
  - Manajemen antrean asinkron sequential (`src/lib/outbox.ts` & `src/lib/sync.ts`) dengan mekanisme coba ulang eksponensial.
  - Penulisan transaksi lokal melalui pembungkus `applyOp` yang transparan terhadap status koneksi jaringan.
  - Halaman antrean sinkronisasi `/app/sinkron` (`src/components/public/SyncStatusPage.tsx`) dengan detail operasi tertunda dan tombol sinkronisasi manual.
  - Indikator status koneksi dan jumlah antrean langsung di bilah atas aplikasi (`src/components/Header.tsx`).
  - Berkas Progressive Web App (PWA): `manifest.json`, `sw.js` (dengan *bypass* rute `apply_op`), dan `offline.html`.

- **Tahap F - Penyempurnaan & Kesiapan Produksi:**
  - Penggantian aset logo raster PNG berukuran 1.3 MB dengan berkas vektor SVG ringan `< 10 KB` (`public/sirkula-logo.svg` dan `public/favicon.svg`).
  - Fitur ekspor CSV untuk data kumpulan batch, pengiriman off-taker, dan laporan neraca massa.
  - Lembar gaya cetak `@media print` untuk mencetak formulir laporan resmi secara bersih tanpa bilah navigasi dan elemen interaktif.
  - Konfigurasi header keamanan HTTP produksi (`public/_headers` dan `vercel.json`) mencakup Content Security Policy (CSP), HSTS, anti-clickjacking, dan pencegahan *MIME sniffing*.
  - Dokumentasi komprehensif: `README.md`, `docs/RUNBOOK.md`, `docs/PANDUAN_PETUGAS.md`, `docs/SECURITY_CHECKLIST.md`, `docs/STATUS_SPESIFIKASI.md`, dan `docs/ASSUMPTIONS.md`.

### Diubah
- Mengganti seluruh ketergantungan `localStorage` dengan penanganan sesi otentikasi Supabase Auth murni.
- Memperbarui `src/components/Logo.tsx` agar menggunakan logo SVG vektor modern bertema hijau daun dan panah sirkular.
- Memperbarui konfigurasi Vite dan TypeScript untuk kompatibilitas pustaka pemetaan dan grafik.

### Dihapus
- Menghapus berkas gambar biner raster berukuran besar `ChatGPT_Image_*.png` dari direktori aset publik.
- Menghapus fungsi verifikasi hash di sisi peramban (`hashChain.ts`) untuk mencegah potensi manipulasi di lingkungan klien.
- Menghapus fallback kredensial demo hardcode di halaman masuk.
