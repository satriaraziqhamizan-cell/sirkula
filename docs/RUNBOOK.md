# SIRKULA: Operational Runbook

Dokumen ini berisi prosedur operasional rutin, pemeliharaan terjadwal, dan penanganan insiden untuk sistem SIRKULA di lingkungan produksi.

---

## 1. Jadwal Pemeliharaan Otomatis (Cron Jobs)

### A. Cron Harian (`cron-daily`)
- **Jadwal:** Setiap hari pukul **01:00 WIB** (18:00 UTC).
- **Endpoint:** `supabase/functions/cron-daily`
- **Fungsi:**
  1. Memeriksa pengiriman berstatus `'dikirim'` yang melewati batas toleransi waktu konfirmasi fasilitas (`ack_timeout_hours`, default 72 jam).
  2. Mengubah status pengiriman menjadi `'kedaluwarsa'`.
  3. Memicu pembentukan anomali aturan $R_4$ (*Acknowledgement Timeout*).
  4. Mengirimkan notifikasi ringkasan kepada pengelola fasilitas.

### B. Penjangkaran Hash Mingguan (`anchor-hash`)
- **Jadwal:** Setiap hari **Senin pukul 02:00 WIB** (Minggu 19:00 UTC).
- **Endpoint:** `supabase/functions/anchor-hash`
- **Fungsi:**
  1. Mengambil nomor urut (`seq`) dan hash SHA-256 terakhir dari tabel `event_log` untuk setiap fasilitas aktif.
  2. Menyimpan rekam jejak ke dalam tabel `hash_anchors` dengan tipe `'weekly_digest'`.
  3. Memberikan bukti audit independen (*proof-of-existence*) bahwa data tidak dimanipulasi setelah tanggal penjangkaran.

---

## 2. Prosedur Penanganan Insiden

### A. Anomali Integritas Rantai Hash Terputus (`verify_chain` mengembalikan `ok = false`)
1. **Identifikasi:** Buka konsol pengelola atau jalankan query di Supabase SQL Editor:
   ```sql
   select * from public.verify_chain('<FACILITY_UUID>');
   ```
2. **Diagnosa:** Catat nilai kolom `broken_at` (nomor urut baris di mana hash tidak cocok).
3. **Pemeriksaan Forensik:**
   ```sql
   select * from event_log 
   where facility_id = '<FACILITY_UUID>' 
     and seq between (<broken_seq> - 1) and (<broken_seq> + 1);
   ```
4. **Tindakan:** Jika ketidakcocokan disebabkan oleh mutasi manual di luar fungsi resmi `apply_op` atau kegagalan transaksi, catat insiden pada berita acara audit dinas. Sistem append-only SIRKULA dirancang untuk mendeteksi manipulasi ini secara permanen.

### B. Mitra Melaporkan Tautan Konfirmasi Kedaluwarsa
1. Petugas fasilitas membuka menu pencatatan serah terima keluar.
2. Temukan pengiriman yang bersangkutan.
3. Klik tombol **"Terbitkan Ulang Tautan"**.
4. Sistem akan otomatis mencabut (*revoke*) token lama dan menerbitkan token acak baru dengan masa kedaluwarsa 72 jam berikutnya.
5. Kirimkan tautan baru kepada mitra via WhatsApp resmi.

---

## 3. Cadangan Basis Data (Database Backups)

- Supabase otomatis melakukan Daily Logical Backup.
- Sebelum melakukan migrasi skema baru, unduh dump skema secara manual via Supabase CLI:
  ```bash
  supabase db dump --data-only -f sirkula_backup_$(date +%F).sql
  ```
