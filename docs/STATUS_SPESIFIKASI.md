# Status Implementasi Spesifikasi SIRKULA

Dokumen ini melacak status kesiapan teknis setiap modul (M1 s.d. M14) dan butir kesiapan operasional (*go-live*) sesuai Dokumen Induk Spesifikasi Aplikasi Web SIRKULA.

---

## 1. Status Modul Fungsional (M1 s.d. M14)

| Kode Modul | Nama Modul | Status | Catatan / Hasil Pengujian |
|---|---|---|---|
| **M1** | Autentikasi Pengguna & RBAC | **SELESAI** | Otentikasi Supabase Auth dengan 5 peran (`petugas_tps3r`, `petugas_angkut`, `pengelola`, `dinas`, `admin`). RLS aktif pada seluruh tabel. |
| **M2** | Manajemen Fasilitas Multi-Tenant | **SELESAI** | Isolasi data antar fasilitas teruji. Filter RLS mencegah kebocoran data. Pengelola hanya dapat mengakses fasilitas yang ditugaskan. |
| **M3** | Mesin Neraca Massa Murni | **SELESAI** | Dipisahkan sebagai modul murni (`src/engine/index.ts`). 10/10 vektor uji Vitest lolos 100%. |
| **M4** | Deteksi Anomali Aturan R1 s.d. R6 | **SELESAI** | Evaluasi anomali berjalan otomatis saat penutupan batch dan penerimaan konfirmasi mitra. Anomali terbuka mengunci perhitungan VRR ketat. |
| **M5** | Pencatatan Batch Masuk ($M_{\text{in}}$) | **SELESAI** | Alur stepper responsif ponsel, kompresi foto timbangan di klien, pembuatan kode batch otomatis dan QR code. |
| **M6** | Pemilahan & Pengolahan Organik Onsite | **SELESAI** | Pencatatan per kategori material dan pencatatan konversi kompos/maggot BSF ($M_{\text{org}}$). |
| **M7** | Penutupan Batch & Stok Sisa ($\Delta S$) | **SELESAI** | Input wajib $\Delta S \ge 0$, perhitungan closure error otomatis, evaluasi batas toleransi $\tau_{\text{neg}}$. |
| **M8** | Koreksi Bobot & Pembatalan Void | **SELESAI** | Tanpa hapus keras (*zero hard-delete*). Koreksi dan void wajib alasan, mencatat `old_weight` & `new_weight` di audit trail via trigger `app.log_event()`. |
| **M9** | Konfirmasi Penerima Buta (*Blind Confirmation*) | **SELESAI** | Token acak 32-byte bergaram (SHA-256), tautan WhatsApp `/k/:token`, formulir publik tanpa login, tanpa membocorkan bobot pengirim ($W_k$). |
| **M10** | Audit Trail Kriptografis Berantai | **SELESAI** | Tabel append-only `event_log` dengan hash berantai SHA-256. Fungsi `public.verify_chain()` memverifikasi keutuhan rantai langsung di basis data. |
| **M11** | Penutupan Periode & Pelaporan VRR | **SELESAI** | Perhitungan resmi RR, VRR, dan Gap dengan snapshot hash permanen. Proteksi penutupan ganda (HTTP 409). |
| **M12** | Portal Pengawasan Dinas LH | **SELESAI** | Peta interaktif Leaflet + OpenStreetMap dengan titik koordinat fasilitas, grafik tren Recharts, dan tabel prioritas audit otomatis. |
| **M13** | Offline-First & Antrean Sinkronisasi | **SELESAI** | Penyimpanan lokal IndexedDB menggunakan Dexie, antrean outbox dengan UUID v4 & `seq_local`, Service Worker `sw.js`, Web App Manifest. |
| **M14** | Portal Verifikasi Publik Terbuka | **SELESAI** | Halaman `/verifikasi/:reportId` publik dapat diakses tanpa login untuk memvalidasi keaslian laporan periodik masyarakat. |

---

## 2. Status Kesiapan Operasional (Bagian 21 Dokumen Induk)

| Butir Kesiapan | Status | Penjelasan & Rencana Tindak Lanjut |
|---|---|---|
| **Skema Basis Data & RLS** | **SELESAI** | Migrasi `0001` sampai `0009` siap dijalankan, RLS terverifikasi, fungsi RPC teruji. |
| **Perlindungan Keamanan Peran** | **SELESAI** | Matriks peran pada RPC `apply_op` mengunci wewenang per jenis operasi. Tombol antarmuka terlindungi secara bersyarat. |
| **Integritas Rantai Audit** | **SELESAI** | Uji `verify_chain` mengembalikan `ok = true` dan mendeteksi pemutusan rantai jika ada manipulasi baris langsung. |
| **Pengujian Pilot Fisik di Lokasi Riil** | **SEBAGIAN** | Arsitektur perangkat lunak telah selesai diuji dengan dataset simulasi 6 fasilitas fiktif. Pelaksanaan penimbangan riil di TPS 3R mitra direncanakan pada tahap implementasi lapangan. |
| **Kuesioner Skor SUS Pengguna** | **SEBAGIAN** | Modul formulir SUS telah terpasang di antarmuka riset (`/admin/riset`). Pengumpulan sampel responden riil dilakukan saat pelatihan petugas lapangan. |
| **Materi Presentasi & Video Demo** | **BELUM** | Disiapkan oleh tim penyusun naskah lomba di luar repositori kode aplikasi. |
