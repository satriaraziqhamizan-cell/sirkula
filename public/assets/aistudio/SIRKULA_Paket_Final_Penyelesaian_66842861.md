# SIRKULA: Paket Final Penyelesaian

Kondisi zip terakhir (`...__7_.zip`): isinya **identik** dengan zip sebelumnya, jadi tahap D belum diterapkan.
Yang sudah terverifikasi: tahap A, B, perbaikan 0007 (cek peran) dan 0008 (audit trail). `tsc`, build, dan 10 tes Vitest lolos.

Urutan kerja (hemat kuota): **D → E → C-lite → F**. Setelah tiap prompt: unduh zip baru, unggah ke Claude, cek, baru lanjut.

---

## Bagian 1. Sisa pekerjaan kode (urut prioritas)

| # | Pekerjaan | Mengapa penting | Prompt |
|---|---|---|---|
| 1 | Token konfirmasi penerima sekali pakai (F06) | Inti pembeda SIRKULA; halaman `/k/:token` masih placeholder | D |
| 2 | Hasil resmi di server: tutup periode, anomali idempoten, VRR/Gap (F08 sampai F10) | Angka resmi tidak boleh dihitung di klien | E |
| 3 | Verifikasi rantai hash lewat `verify_chain` di database, jangkar hash mingguan (F13) | Klien masih memakai `hashChain.ts`; jangkar belum ada | E |
| 4 | Dasbor dinas: grafik tren, peta fasilitas, daftar prioritas audit (F11, tertulis Must di dokumen induk) | Belum ada pustaka grafik maupun peta | E |
| 5 | Offline-first sederhana (F07, N01, N03; tertulis Must di dokumen induk) | Belum ada Dexie, service worker, maupun manifest | C-lite |
| 6 | Ekspor CSV dan cetak laporan periode (F14), notifikasi lewat batas waktu (F16) | Fitur Should/Could, murah dikerjakan | F |
| 7 | Perapian: logo 1,3 MB, bentrok versi `esbuild`/`vite`, dokumentasi, tes e2e ringan | Kesiapan rilis | F |

## Bagian 2. Yang harus kamu kerjakan sendiri (bukan kode)

1. **Supabase:** jalankan migrasi `0001` sampai `0008` berurutan, lalu `demo_seed.sql`.
2. **Matikan sign-up publik** (Authentication). Buat akun admin lewat Users, lalu tambahkan barisnya di tabel `profiles` dengan `role = 'admin'`.
3. **Edge Function** (setelah prompt D dan E): deploy semuanya dan isi secret `TOKEN_PEPPER`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`. Jadwalkan `cron-daily` (01:00 WIB) dan `anchor-hash` (Senin 02:00 WIB) bila dibuat.
4. **Hosting** build produksi di Cloudflare Pages, Vercel, atau Netlify. Isi `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV` di pengaturan hosting (bukan hanya di AI Studio). Tambahkan alamat situs ke Supabase **Authentication → URL Configuration** dan isi `APP_BASE_URL` dengan alamat yang sama.
5. **Peringatan Supabase gratis:** project dijeda bila lama tidak dipakai. Buka dan pakai aplikasinya beberapa hari sebelum penilaian, lalu uji ulang login.
6. **Uji dengan akun berbeda peran** (petugas, pengelola, dinas, admin): data tidak bocor antar fasilitas, petugas tidak bisa tutup periode, koreksi bobot lalu `verify_chain` bernilai utuh.
7. **Data demo:** pastikan seed menghasilkan cerita yang menarik untuk juri (ada batch normal, anomali R1 sampai R6, satu pengiriman menunggu konfirmasi, satu periode ditutup).
8. **Di luar aplikasi:** data pilot nyata dari TPS3R mitra, skor SUS, video prototype, PPT, dan poster A3. Jika pilot belum dilakukan, tulis jujur sebagai keterbatasan dan sebut data aplikasi sebagai data contoh.

---

## Prompt D: Token konfirmasi penerima

```
Kerjakan TAHAP D SIRKULA: konfirmasi penerima lewat token sekali pakai (konfirmasi buta). Acuan: docs/SIRKULA_Spesifikasi_Aplikasi_Web_*.md bagian 5, keputusan D3 dan D4, Lampiran C. Jangan ubah rumus di packages/engine/.

KONDISI SAAT INI: tabel confirmation_tokens (token_hash, expires_at, used_at, revoked_at, failed_attempts) dan confirmations sudah ada di migrasi 0002 tanpa policy RLS (hanya service role). ShipmentCreateModal.tsx membuat tautan dengan token kosong (`?token=${createdShipment?.token || ''}`) dan RecipientConfirmPage.tsx masih placeholder.

TUGAS:
1. Edge Function (Deno) di supabase/functions/:
   - shipment-token: untuk pengguna login yang berhak atas fasilitas pengiriman. Buat token acak 32 byte (base64url), simpan HANYA SHA-256(token + TOKEN_PEPPER) di confirmation_tokens, expires_at = now + ack_timeout_hours fasilitas (bawaan 72). Kembalikan { url: `${APP_BASE_URL}/k/<token>`, expires_at } sekali. Panggilan ulang untuk pengiriman yang sama mencabut token lama.
   - confirm-get (publik): terima token, cari lewat hash. Kembalikan HANYA nama fasilitas, tanggal kirim, nama material, batas waktu. JANGAN pernah mengembalikan berat kirim. Tidak ada → 404; kedaluwarsa, terpakai, atau dicabut → 410. Naikkan failed_attempts untuk token salah dan batasi laju (429) per IP.
   - confirm-submit (publik): terima token, weight_received_kg (>=0), status ('diterima' | 'ditolak_tidak_sesuai'), catatan opsional. Dalam satu transaksi: validasi token, tulis confirmations, ubah status pengiriman, isi used_at. Konfirmasi ganda → 410. Respons tidak boleh membocorkan berat kirim.
   Gunakan SUPABASE_SERVICE_ROLE_KEY dari secret fungsi, tidak pernah dari frontend. CORS dibatasi ke APP_BASE_URL.
2. Konfirmasi yang masuk memicu R3/R4 untuk pengiriman itu dengan fungsi di packages/engine/; tulis anomali lewat jalur yang sudah ada. Jangan menulis event_log langsung (audit tetap lewat trigger).
3. Frontend: tulis ulang RecipientConfirmPage.tsx untuk rute /k/:token (publik): panggil confirm-get, tampilkan form berat terima + status + foto opsional (kompres di klien), kirim ke confirm-submit, tampilkan pesan jelas untuk 404/410/429. Bahasa Indonesia awam, ramah ponsel, tanpa login.
4. ShipmentCreateModal.tsx: setelah pengiriman dibuat, panggil shipment-token dan buat tautan WhatsApp dari url yang dikembalikan (token mentah tidak disimpan di klien setelah modal ditutup). Tambah tombol "Terbitkan ulang tautan".
5. Buat supabase/functions/README.md: cara deploy dan daftar secret (TOKEN_PEPPER, SUPABASE_SERVICE_ROLE_KEY, APP_BASE_URL).
6. Jangan membuat token demo tertanam di frontend.

CEK SELESAI (daftar centang): grep "tok_demo" dan "service_role" di src/ kosong; respons confirm-get tidak memuat weight_kg; membuka /k/<token> dua kali menghasilkan 410; token_hash di database bukan teks token; tsc, test, build lolos.
```

---

## Prompt E: Hasil resmi di server, audit, dan dasbor dinas

```
Kerjakan TAHAP E SIRKULA (acuan: docs/SIRKULA_Spesifikasi_Aplikasi_Web_*.md bagian 6, 7 (M5 sampai M11), 9, Lampiran A.3 dan C). Jangan ubah rumus di packages/engine/.

KONDISI SAAT INI: semua perhitungan angka masih di klien; tidak ada Edge Function engine; verifikasi rantai memakai src/crypto/hashChain.ts di klien; dasbor dinas belum memakai pustaka grafik maupun peta.

TUGAS:
1. Edge Function engine-run (scope: batch | shipment | daily | all): impor paket engine yang sama dengan klien, hitung R1 sampai R6 (R1 hanya pada batch ditutup; basis ambang per kategori dominan dengan fallback gabungan bila n kecil dan lencana "belum terkalibrasi"). Idempoten: dijalankan dua kali pada data yang sama tidak membuat anomali ganda (anomali lama ditandai superseded). Simpan engine_version.
2. Edge Function report-close: hitung RR, VRR, Gap dengan periodMetrics dari paket engine, simpan period_reports beserta report_hash (SHA-256 payload kanonik). Periode yang sudah ditutup → 409. Hanya pengelola/admin. Angka VRR di dasbor harus sama dengan hasil ini.
3. Edge Function cron-daily (tandai pengiriman kedaluwarsa, jalankan R4/R5, buat notifikasi/ surel pengingat untuk pengiriman melewati batas waktu) dan anchor-hash (kirim hash terakhir per fasilitas lewat surel dan isi tabel hash_anchors). Tulis jadwalnya di docs/RUNBOOK.md (cron-daily 01:00 WIB, anchor-hash Senin 02:00 WIB).
4. Hapus pemakaian src/crypto/hashChain.ts untuk verifikasi. Layar audit memanggil fungsi database verify_chain(facility_id) dan menampilkan hasil (utuh / putus pada seq N). Halaman publik /verifikasi memverifikasi report_hash tanpa login.
5. Dasbor dinas (F11): tambahkan recharts untuk grafik tren RR/VRR/Gap per periode, peta fasilitas dengan leaflet + react-leaflet + tile OpenStreetMap (butuh kolom lat/lng di facilities: buat migrasi baru dan isi seed), dan tabel daftar prioritas audit (urut Gap besar dan anomali open). Tetap ramah layar ponsel.
6. Pastikan tidak ada kata "curang", "fraud", "korupsi", "bohong", "100% akurat", "blockchain", "AI" sebagai klaim di UI atau laporan (kalimat penolakan di halaman Metode boleh).
7. Tampilkan badge "ambang sementara" pada hasil bila threshold_sets aktif belum dibekukan.

CEK SELESAI (daftar centang): engine-run dua kali tidak menambah anomali; report-close dua kali → 409; mengubah satu baris langsung di SQL Editor membuat verify_chain menunjukkan rantai putus; grep "hashChain" di src/ untuk verifikasi kosong; tsc, test, build lolos.
```

---

## Prompt C-lite: Offline-first yang jujur dan cukup

```
Kerjakan TAHAP C-LITE SIRKULA (offline-first sederhana; acuan bagian 8 spesifikasi, versi dipangkas). apply_op sudah idempoten lewat client_op_id, jadi TIDAK perlu Edge Function sync-push: klien mengirim operasi antrean ke apply_op satu per satu, berurutan.

TUGAS:
1. Tambah dexie dan vite-plugin-pwa. Buat src/lib/db.ts (tabel: outbox, cache_batches, cache_shipments, cache_partners, cache_categories, kv), src/lib/outbox.ts, src/lib/sync.ts.
2. Penulisan petugas (batch.create, batch.update_items, batch.close, batch.correct, shipment.create, partner.upsert) ditulis LEBIH DULU ke Dexie dan outbox (optimistic), lalu dikirim ke apply_op saat online. Semua id UUID v4 dibuat di perangkat; setiap operasi punya client_op_id, device_id, client_time, seq_local.
3. Sinkron: jalankan saat aplikasi dibuka, saat online kembali, dan tiap 30 detik bila ada antrean (backoff sampai 5 menit). Hasil 'ok' atau 'duplicate' menghapus dari antrean; 'rejected' dipindah ke daftar "Perlu ditinjau" dengan alasan; galat jaringan menjaga antrean. Konflik koreksi dilaporkan, tidak ada "terakhir menang" untuk bobot.
4. Cache baca: simpan hasil query terakhir fasilitas aktif (batch aktif 30 hari, mitra, kategori) ke Dexie agar daftar tetap tampil offline.
5. Halaman /app/sinkron sederhana: jumlah menunggu, gagal, perlu ditinjau, tombol coba ulang. Indikator di header: hijau tersinkron, kuning "N menunggu", merah gagal, abu-abu offline. Status berasal dari kondisi nyata, bukan toggle.
6. PWA: precache shell dan aset, offline.html, manifest (name SIRKULA, display standalone, ikon 192/512 dan maskable), tombol "Pasang aplikasi", prompt "Versi baru tersedia". JANGAN cache respons apply_op. Panggil navigator.storage.persist().
7. Foto bukti: simpan blob di Dexie, unggah ke bucket privat evidence setelah operasi induk berhasil, dapat dilanjutkan bila terputus (jika bucket/policy belum ada, buat migrasi 0009 untuk bucket dan policy). Tanda "foto menunggu" pada batch.
8. Dokumentasikan keterbatasan di docs/ASSUMPTIONS.md (mis. konfirmasi penerima tetap butuh online karena dilakukan penerima lewat web).

CEK SELESAI (uji manual, tulis hasil): mode pesawat → buat 10 batch → online → semua muncul tepat satu kali; putus di tengah sinkron → lanjut tanpa duplikat; tutup paksa browser saat antrean berisi → antrean utuh; manifest dan service worker terdaftar; tsc, test, build lolos.
```

---

## Prompt F: Perapian dan siap rilis

```
Kerjakan TAHAP F SIRKULA (perapian akhir).

1. Perbaiki dependensi sehingga `npm install` tanpa flag berhasil (saat ini ERESOLVE: esbuild ^0.25 bentrok dengan peerOptional vite@8). Selaraskan versi esbuild/vite/@tailwindcss/vite/typescript. Hapus dependensi tidak terpakai (@google/genai, express bila masih ada).
2. Logo: ganti public/assets/aistudio/ChatGPT_Image_*.png (≈1,3 MB) dengan logo SVG atau WebP < 100 KB bernama sirkula-logo.*, buat ikon PWA 192/512/maskable dan favicon terpisah.
3. Ekspor (F14): tombol "Unduh CSV" untuk daftar batch, anomali, dan hasil periode (di klien), serta halaman laporan periode yang rapi untuk dicetak/disimpan sebagai PDF lewat tombol "Cetak" (stylesheet @media print).
4. Keamanan: file _headers (Cloudflare Pages) atau vercel.json berisi CSP, X-Content-Type-Options, Referrer-Policy, HSTS; pastikan grep -r "SERVICE_ROLE\|GEMINI" dist/ kosong; bucket evidence privat dengan signed URL pendek.
5. Halaman Kebijakan Privasi dan Syarat Penggunaan; nomor kontak dukungan lewat variabel (kosongkan bila belum ada, jangan mengarang).
6. Dokumentasi: README.md (variabel lingkungan, cara deploy), docs/RUNBOOK.md, docs/PANDUAN_PETUGAS.md (satu halaman), docs/SECURITY_CHECKLIST.md (OWASP Top 10 ringkas), CHANGELOG.md. Hapus teks bawaan AI Studio tentang GEMINI_API_KEY.
7. Tes: tambah 1 tes e2e Playwright ringan (login → buat batch → tutup batch) bila memungkinkan; bila tidak, tulis alasannya.
8. Buat docs/STATUS_SPESIFIKASI.md: setiap modul M1 sampai M14 dan setiap butir go-live bagian 21 ditandai SELESAI / SEBAGIAN / BELUM beserta alasan singkat. Jangan menandai SELESAI untuk yang belum diuji.

CEK SELESAI: npm install (tanpa flag), lint, test, build lolos; ukuran logo < 100 KB; STATUS_SPESIFIKASI.md ada dan jujur.
```

---

## Bagian 3. Penyesuaian dokumen induk (.docx) agar cocok dengan aplikasi

Dari yang saya baca, dokumen induk berbentuk rencana dan banyak menyatakan hal dengan kata kerja masa depan, jadi mayoritas aman. Yang perlu disamakan:

1. **Stack (bagian 10):** dokumen menyebut backend Laravel/NestJS, tetapi aplikasi memakai **Supabase (PostgreSQL + Edge Functions)** dengan frontend React/Vite. Tulis Supabase sebagai pilihan yang diambil beserta alasannya (cepat dibangun, RLS, auth bawaan) dan pindahkan Laravel/NestJS ke kolom alternatif.
2. **"Prototype PWA yang berjalan dengan data pilot nyata"** (target hasil): jangan ditulis sebagai capaian bila pilot belum jalan. Tulis "prototype dengan data contoh; pilot nyata direncanakan/sedang berjalan".
3. **Kebutuhan Must (F07 offline, F11 peta dan tren):** setelah prompt C-lite dan E selesai bisa diklaim. Sebelum itu, tandai sebagai "tahap pengembangan".
4. **Kebutuhan N01 dan N03** (offline sehari, tanpa data hilang): hanya klaim setelah dites mode pesawat.
5. **Ambang batas dan akurasi:** pertahankan kalimat bahwa ambang awal bersifat sementara sampai dikalibrasi dengan data pilot (aplikasi sudah memberi lencana "belum terkalibrasi").
6. **Bukti yang belum final** (angka SIPSN, tingkat daur ulang nasional, tabel pembanding minimal 15 studi) masih bertanda belum diverifikasi di dokumen; selesaikan sebelum naskah dikumpulkan.
7. **Tangkapan layar dan diagram** di naskah harus diambil dari versi akhir aplikasi (setelah D dan E), bukan dari versi lama.

Catatan: bagian-bagian dokumen yang tidak saya sebut di atas belum saya baca baris per baris.

---

## Definisi "selesai" untuk lomba

Layak diserahkan bila: login per peran jalan; data berasal dari Supabase; konfirmasi token jalan (D); angka resmi dari server dan `verify_chain` utuh (E); offline sederhana teruji (C-lite); build bersih dan terhosting (F); dokumen induk sejalan dengan aplikasi; dan keterbatasan (satu lokasi pilot, ambang sementara, first-hop saja) ditulis terbuka.
