# Asumsi dan Batasan Sistem SIRKULA

Dokumen ini mencatat asumsi operasional, teknis, serta batasan implementasi sistem verifikasi neraca massa SIRKULA (Sistem Informasi dan Rekonsiliasi Neraca Sampah Terpadu).

---

## 1. Batasan Keterlacakan (Traceability Boundary)

1. **First-Hop Traceability (Cakupan Titik Pertama)**
   - SIRKULA membatasi ruang lingkup rekonsiliasi material dari penimbangan input TPS3R hingga ke **pembeli/penerima pertama** (first off-taker/recycler/TPST).
   - Sistem **tidak melacak perjalanan sekunder** (second-hop atau third-hop) setelah material masuk ke gudang pabrik daur ulang atau peleburan hilir. Penelusuran rantai pasok hilir berada di luar mandat operasional TPS3R dan dinas lingkungan hidup.

2. **Titik Verifikasi Mandiri**
   - Penerima muatan (off-taker) melakukan konfirmasi independen melalui tautan konfirmasi tanpa melihat angka timbangan awal TPS3R (*blind confirmation*).
   - Validitas transaksi diukur dari konsistensi selisih $\Delta = |W_{\text{keluar}} - W_{\text{terima}}|$, bukan dari pengawasan fisik langsung di gerbang pabrik pembeli.

---

## 2. Asumsi Teknis Konfirmasi Mitra (Blind Confirmation)

1. **Aksesibilitas Perangkat Mitra**
   - Mitra pembeli diasumsikan memiliki perangkat telepon pintar (smartphone) dengan peramban web modern (Chrome, Safari, Firefox, Edge) dan akses internet aktif saat melakukan verifikasi muatan.
   - Apabila koneksi internet mitra terputus saat armada tiba di lokasi bongkar muat, formulir konfirmasi dapat diisi dan diserahkan setelah koneksi pulih (selama masa berlaku token 72 jam belum kedaluwarsa).

2. **Ketahanan Token Sekali Pakai**
   - Setiap token `k_...` bersifat kriptografis acak (UUID v4 / 32 bytes) dengan masa berlaku 72 jam.
   - Token hanya dapat diserahkan satu kali (`status = 'submitted'`). Akses ulang setelah penyerahan hanya menampilkan tanda terima (*receipt*) tanpa membuka akses pengeditan ulang.

---

## 3. Asumsi Kalibrasi Parameter dan Ambang Batas (Thresholds)

1. **Sifat Provisori Nilai Awal**
   - Ambang batas awal yang digunakan dalam SIRKULA:
     - $\tau_{\text{neg}} = 2.0\%$ (Toleransi selisih negatif timbangan keluar vs terima).
     - $\tau_d = 5.0\%$ (Toleransi selisih mutlak muatan off-taker R3).
     - $\tau_{\text{loss}} = 5.0\%$ (Toleransi penyusutan massa terakumulasi R1).
     - $\tau_{\text{unacc}} = 10.0\%$ (Batas toleransi material tak terhitung R2).
   - Nilai-nilai di atas bersifat **provisori** (sementara) dan berstatus *provisional* sampai data empiris operasional terkumpul setidaknya selama 3 (tiga) bulan uji coba lapangan di fasilitas percontohan.

2. **Penyesuaian Ambang Batas**
   - Pengelola dan dinas berhak mengajukan penyesuaian ambang batas fasilitas berdasarkan karakteristik material dominan (misalnya kadar air tinggi pada sampah organik basah musim hujan yang meningkatkan laju susut).
   - Seluruh perubahan ambang batas dibekukan secara formal (`frozen_at`) dan tercatat dalam jejak audit `event_log`.

---

## 4. Asumsi Keandalan Lingkungan Offline (PWA & IndexedDB)

1. **Integritas Penimbangan Lapangan**
   - Petugas penimbangan TPS3R dapat beroperasi penuh tanpa koneksi internet (*offline-first*). Data penimbangan disimpan secara berurutan dalam IndexedDB lokal (`outbox`).
   - Setiap penimbangan lokal diberikan tanda waktu ISO 8601 perangkat dan nomor antrean lokal unik.
   - Sinkronisasi dilakukan secara serial (FIFO) saat koneksi terhubung kembali, dengan pemeriksaan konflik berbasis *last-write-wins* atau penolakan aturan bisnis di level RPC `apply_op`.

2. **Kapasitas Penyimpanan Perangkat**
   - Penyimpanan gambar timbangan di IndexedDB dikompresi di sisi peramban (maksimal 1200px lebar/tinggi, format JPEG dengan kualitas 0.8) sehingga ukuran per foto $\le 250\text{ KB}$.
   - Sistem meminta kuota persisten (`navigator.storage.persist()`) untuk mencegah pembersihan berkala oleh peramban di perangkat dengan memori terbatas.

---

## 5. Komitmen Bahasa dan Narasi Integritas

1. **Pendekatan Rekonsiliasi, Bukan Penuduhan**
   - Anomali yang terdeteksi (R1 hingga R4) diklasifikasikan sebagai indikasi ketidaksesuaian pengukuran atau perbedaan kalibrasi timbangan, bukan sebagai vonis kecurangan.
   - Terminologi yang digunakan dalam seluruh antarmuka dan laporan: "Perlu Tinjauan", "Selisih Pengukuran", "Rekonsiliasi Bobot", dan "Anomali Ambang Batas".
