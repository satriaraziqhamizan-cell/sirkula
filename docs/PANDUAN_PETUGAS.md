# Panduan Ringkas Operasional Petugas TPS 3R (SIRKULA)

Dokumen ini merupakan panduan satu halaman untuk petugas timbangan dan pemilahan di lapangan.

---

## 1. Memulai Hari & Pencatatan Batch Masuk ($M_{\text{in}}$)

1. **Masuk ke Aplikasi:** Buka aplikasi SIRKULA di peramban ponsel. Masukkan nama pengguna dan kata sandi petugas Anda.
2. **Pencatatan Masuk:** Klik tombol **"+ Batch Baru"**:
   - Pilih sumber timbulan sampah (contoh: *Gerobak RW 03* atau *Truk TPS*).
   - Masukkan total berat kotor timbangan timbulan sampah ($kg$).
   - Ambil foto timbangan sebagai bukti (pastikan angka timbangan terlihat jelas).
   - Klik **"Lanjut ke Pemilahan"**. Sistem akan otomatis menghasilkan Kode Batch dan stiker QR Code.

---

## 2. Pemilahan Material & Pengolahan di Tempat ($M_{\text{org}}$)

1. **Input Material Terpilah:** Timbang dan masukkan berat per kategori yang dipilah:
   - Plastik PET / Campur
   - Kertas / Kardus
   - Logam / Besi
   - Kaca / Botol
   - Residu yang tidak dapat didaur ulang
2. **Pengolahan Organik:** Jika ada sampah organik yang diolah di TPS 3R (misalnya pembuatan kompos atau bio-konversi maggot BSF), masukkan berat yang diproses.

---

## 3. Menutup Batch & Memeriksa Neraca ($e$)

1. Saat batch selesai dipilah, klik tombol **"Tutup Batch Sekarang"**.
2. **Masukkan Stok Sisa ($\Delta S$):** Masukkan sisa material yang belum sempat dipilah atau masih tertinggal di lantai pemilahan.
3. **Pemeriksaan Neraca Otomatis:** Sistem akan langsung menghitung selisih neraca massa ($e = M_{\text{in}} - M_{\text{out}} - \Delta S$):
   - **Lolos (Hijau):** Neraca seimbang dan sesuai batas toleransi.
   - **Perlu Tinjauan (Kuning/Merah):** Ada selisih timbangan yang tidak wajar. Berikan keterangan jika diminta oleh pengelola.

---

## 4. Serah Terima Keluar ke Mitra Daur Ulang ($W_k$)

1. Buka tab **"Serah Terima Keluar"**, lalu klik **"+ Kirim Muatan"**.
2. Pilih nama mitra penerima resmi (misalnya *Lapak Sejahtera* atau *Bank Sampah Induk*).
3. Pilih batch asal dan masukkan berat material yang dikirimkan ($kg$).
4. Klik **"Kirim Muatan"**.
5. Sistem akan menampilkan tombol **"Kirim Tautan via WhatsApp"**:
   - Klik tombol tersebut untuk membuka WhatsApp dan mengirimkan tautan konfirmasi ke nomor mitra.
   - Mitra akan menginput hasil timbangannya sendiri secara independen (*Konfirmasi Buta*).

---

## 5. Operasi Saat Tidak Ada Internet (Offline)

- Aplikasi SIRKULA dirancang tetap dapat mencatat data penimbangan meskipun koneksi internet terputus di lokasi TPS 3R.
- Indikator di bagian atas akan berubah menjadi **"Offline"** atau **"N Menunggu"**.
- Data Anda tersimpan aman di memori perangkat. Saat Anda mendapatkan sinyal internet kembali, sistem akan otomatis mengirimkan antrean data ke server.
