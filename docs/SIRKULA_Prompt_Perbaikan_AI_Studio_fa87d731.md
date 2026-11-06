# SIRKULA: Prompt Perbaikan untuk Google AI Studio

Hasil cek zip `sirkula-_-verifikasi-daur-ulang-riil` terhadap `SIRKULA_Spesifikasi_Aplikasi_Web.md`.
Kirim prompt **satu per satu, berurutan** (A → F). Jangan lanjut ke prompt berikutnya sebelum yang sebelumnya lolos "Cek selesai"-nya. Setelah semua selesai (atau setelah tiap tahap), unggah zip baru ke Claude untuk dicek ulang.

---

## Yang harus kamu kerjakan sendiri (AI Studio tidak bisa)

1. Buat project **Supabase** (region Singapore). Catat `Project URL` dan `anon key`.
2. Di AI Studio, buka panel **Secrets**, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Jangan tempel `service_role` key di AI Studio.
3. Di Supabase: **Authentication → matikan "Allow new users to sign up"**, kata sandi minimal 10 karakter.
4. Setelah prompt A menghasilkan file `supabase/migrations/*.sql`, **jalankan isinya sendiri di Supabase SQL Editor** (urut nomor).
5. Setelah prompt D menghasilkan `supabase/functions/*`, deploy lewat Supabase CLI atau dashboard, lalu isi secrets fungsi: `TOKEN_PEPPER`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`, `RESEND_API_KEY`, `MAIL_FROM`.
6. Buat akun admin pertama lewat dashboard Supabase (Auth → Add user), lalu tambahkan barisnya di tabel profil sesuai skema.

Catatan: file spesifikasi lengkap sudah ada di project pada `public/assets/aistudio/SIRKULA_Spesifikasi_Aplikasi_Web_3df95c5c.md`. Prompt di bawah merujuk ke file itu (Lampiran A sampai C), jadi AI tidak perlu kamu tempelkan ulang SQL-nya. Kalau file itu sudah dipindah, unggah ulang spesifikasinya ke folder `docs/`.

---

## Prompt A: Fondasi backend, login, dan hak akses (RBAC + RLS)

```
Kamu sedang memperbaiki aplikasi SIRKULA yang sudah ada. Dokumen acuan: file SIRKULA_Spesifikasi_Aplikasi_Web (ada di public/assets/aistudio/). Baca bagian 0, 3, 4, 10, 16 dan Lampiran A, C sebelum mulai. Jika konflik, dokumen spesifikasi menang untuk detail rekayasa.

MASALAH SAAT INI (hasil audit):
- Aplikasi hanya prototype tampilan: semua data disimpan di localStorage (src/store/index.ts) dan data seed hardcode (src/data/seedData.ts). Ini melanggar Aturan Wajib 0.1 dan 0.2.
- Tidak ada login. Peran diganti lewat "Role Switcher" di src/components/Header.tsx, sehingga siapa pun bisa menjadi admin/dinas. Ini melanggar bagian 3 dan Aturan 0.5 dan 0.11.

TUGAS (kerjakan hanya ini, jangan ubah mesin neraca massa di src/engine/ dan src/crypto/ selain yang disebut):

1. Tambahkan dependensi: @supabase/supabase-js, @tanstack/react-query, react-router-dom (v6), zustand, zod, react-hook-form. Buat src/lib/supabase.ts yang membaca HANYA VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY dari import.meta.env. Jangan pernah menaruh service_role key atau GEMINI_API_KEY di kode frontend. Hapus @google/genai dan express dari dependensi jika tidak dipakai.

2. Buat folder supabase/migrations/ berisi SQL berurutan yang disalin PERSIS dari Lampiran A spesifikasi (A.1 ekstensi/enum/fungsi bantu, A.2 tabel inti, A.3 trigger audit trail berantai hash, A.4 Row Level Security di SEMUA tabel, A.5 RPC apply_op, A.6 seed ambang awal). Pecah menjadi beberapa file bernomor (0001_..., 0002_...). Jangan menyederhanakan RLS. Tambahkan file supabase/seed/ untuk kategori material dan tenant demo (bagian 18) dengan semua baris bertanda is_demo = true.

3. Autentikasi: buat halaman /masuk (email + kata sandi, bahasa Indonesia baku). Tidak ada halaman daftar publik. Tambahkan alur "ganti kata sandi pertama" untuk akun dengan must_change_password. Sesi diambil dari Supabase Auth. Peran dan fasilitas dibaca dari tabel profil, bukan dari state klien.

4. HAPUS Role Switcher dari Header.tsx dan semua pemanggilan store.setCurrentUser. Menu navigasi hanya menampilkan item sesuai peran dari sesi. Buat komponen RequireRole dan pakai di semua rute: /petugas (petugas_tps3r, pengelola, admin), /kelola (pengelola, admin), /dinas (dinas, admin), /admin/riset (admin; pengelola hanya baca hasil fasilitasnya). Rute publik (/, /metode, /verifikasi, /k/:token, halaman legal) tetap terbuka. Gunakan React Router v6 dengan lazy() per peran.

5. Buat docs/ASSUMPTIONS.md berisi asumsi bawaan Lampiran D.

JANGAN: memakai data hardcode di komponen, menulis kebijakan keamanan hanya di UI, menyimpan secret di frontend.

CEK SELESAI (tulis hasilnya di akhir jawabanmu sebagai daftar centang):
- [ ] Tidak ada "Role Switcher" dan tidak ada setCurrentUser di kode
- [ ] Mengakses /kelola tanpa login diarahkan ke /masuk
- [ ] Semua tabel di migrasi memiliki ALTER TABLE ... ENABLE ROW LEVEL SECURITY dan policy sesuai matriks bagian 3.2
- [ ] grep "service_role" dan "GEMINI" di src/ tidak menemukan apa pun
- [ ] npm run lint (tsc --noEmit) lulus
```

**Cek selesai (untuk kamu):** coba buka `/kelola` dalam mode incognito, harus mental ke login. File migrasi SQL ada dan sudah kamu jalankan di Supabase.

---

## Prompt B: Hubungkan semua layar ke database (buang localStorage dan seed hardcode)

```
Lanjutkan perbaikan SIRKULA. Tahap A (Supabase, login, RBAC) sudah selesai. Sekarang hubungkan semua layar ke database sungguhan sesuai bagian 7 (modul M2, M5 sampai M11) dan Aturan Wajib 0.1.

TUGAS:

1. Hapus ketergantungan pada src/store/index.ts versi lama: tidak ada lagi localStorage (STORAGE_KEY), tidak ada resetDemoData di mode produksi, tidak ada import dari src/data/seedData.ts di komponen. seedData.ts hanya boleh dipakai oleh skrip seed Supabase untuk tenant demo.

2. Buat lapisan data per fitur di src/features/<fitur>/ memakai TanStack Query + supabase-js: batch, shipment, partners, anomalies, periods, dashboard, audit, thresholds, users, research. Setiap komponen yang sekarang menerima data lewat props dari App.tsx harus mengambil datanya sendiri lewat hook, dan semua penulisan lewat RPC apply_op atau Edge Function yang sudah ditentukan Lampiran C (bukan UPDATE langsung ke tabel bobot). Koreksi data bobot WAJIB lewat operasi koreksi dengan alasan; tidak ada hapus keras, pembatalan = status void + alasan (D12).

3. Mesin neraca massa tetap di src/engine/index.ts sebagai fungsi murni. Pindahkan ke packages/engine/ (atau src/engine/ yang diekspor sebagai paket bersama) agar bisa dipakai klien dan Edge Function. Pindahkan juga vektor uji src/engine/verifyTestVectors.ts menjadi tes Vitest sungguhan (npm run test), mencakup SELURUH vektor di bagian 6.7: tambahkan yang belum ada, yaitu "Konfirmasi tanpa batch lolos" dan "Idempoten".

4. Mode demo (bagian 13.2): semua data tenant demo punya is_demo = true. Tampilkan banner kuning "DATA CONTOH" hanya saat sesi berada di tenant demo (VITE_APP_ENV=demo atau organisasi demo). Data demo tidak boleh bercampur dengan data produksi. Tombol Reset demo hanya untuk admin dan hanya menyentuh baris is_demo.

5. Pastikan angka di dasbor dinas dan di halaman publik /verifikasi dihitung dengan fungsi periodMetrics yang sama dengan hasil resmi di server (rekonsiliasi dasbor = engine).

CEK SELESAI:
- [ ] grep "localStorage" dan "seedData" di src/components dan src/features tidak menemukan apa pun
- [ ] npm run test menjalankan semua 10 vektor bagian 6.7 dan lulus
- [ ] Login sebagai petugas fasilitas X tidak bisa melihat batch fasilitas Y (uji lewat dua akun)
- [ ] Mengubah bobot batch tanpa alasan ditolak
```

---

## Prompt C: Offline-first dan PWA yang asli

```
Lanjutkan perbaikan SIRKULA. Tahap A dan B selesai. Sekarang implementasikan offline-first sesungguhnya sesuai bagian 8 dan Aturan Wajib 0.3.

MASALAH SAAT INI: UI menulis "Operasi disimpan di IndexedDB" (PetugasConsole.tsx) dan "MODE OFFLINE: ... (IndexedDB)" (Header.tsx), padahal tidak ada IndexedDB, Dexie, service worker, maupun manifest. Klaim itu harus menjadi benar.

TUGAS:

1. Tambahkan dexie dan vite-plugin-pwa (strategi injectManifest). Buat src/lib/db.ts (skema Dexie bagian 8.2: outbox, cache_*, kv, blobs), src/lib/outbox.ts, src/lib/sync.ts.

2. Semua penulisan petugas (batch.create, batch.update_items, batch.close, batch.correct, batch.void, shipment.create, partner.upsert, stock.snapshot) menulis LEBIH DULU ke IndexedDB + outbox (optimistic), tidak menunggu jaringan. Semua id UUID v4 dibuat di perangkat. Setiap operasi punya client_op_id, device_id, client_time, seq_local.

3. Deteksi online = navigator.onLine DAN ping ke endpoint kesehatan. Kirim operasi queued terurut seq_local dalam kelompok maks 25 ke Edge Function sync-push; ambil perubahan lewat sync-pull?since=cursor (bagian 8.4 dan 8.5). Coba ulang saat aplikasi dibuka, fokus ulang, dan tiap 30 detik bila ada antrean (backoff eksponensial sampai 5 menit). Kegagalan sementara tidak boleh menghapus antrean.

4. Konflik (bagian 8.6): operasi koreksi memuat base_version; jika berbeda dengan versi server, simpan kedua nilai sebagai event, tandai needs_review, dan pengelola memilih nilai yang berlaku dengan alasan. Bobot TIDAK PERNAH memakai "terakhir menang".

5. Foto bukti disimpan di tabel blobs, diunggah terpisah ke bucket privat evidence setelah operasi induk berstatus ok, bisa dilanjutkan bila terputus. Kompres foto di klien sebelum simpan. Batch tanpa foto tertunda diberi tanda "foto menunggu".

6. Buat halaman Pusat Sinkron /app/sinkron (jumlah menunggu, gagal, konflik, tombol coba ulang, galat berbahasa awam) dan indikator global di header: hijau tersinkron, kuning menunggu N, merah gagal, abu-abu offline. Hapus toggle "online/offline" buatan dari Header; status harus berasal dari kondisi jaringan nyata.

7. PWA: service worker (precache shell, stale-while-revalidate untuk aset, network-first dengan fallback cache untuk data baca, JANGAN cache respons sync-push), halaman offline.html, manifest (name SIRKULA, display standalone, orientation portrait, ikon 192/512 dan maskable, theme color sesuai merek), tombol "Pasang aplikasi" di Beranda, prompt "Versi baru tersedia, muat ulang" (jangan paksa reload saat ada form terbuka), dan navigator.storage.persist().

8. Perbaiki teks UI agar jujur: hanya sebut IndexedDB/offline jika fiturnya benar-benar bekerja.

CEK SELESAI (uji manual dan tulis hasilnya):
- [ ] Mode pesawat → buat 10 batch lengkap → nyalakan jaringan → semua muncul di server tepat satu kali (8.8 butir 1)
- [ ] Putuskan jaringan di tengah sinkron → lanjut tanpa duplikat (butir 2)
- [ ] Tutup paksa browser saat antrean berisi → buka lagi → antrean utuh (butir 3)
- [ ] manifest.webmanifest dan service worker terdaftar (DevTools → Application)
- [ ] Lighthouse PWA lulus
```

---

## Prompt D: Konfirmasi penerima lewat token sekali pakai (konfirmasi buta)

```
Lanjutkan perbaikan SIRKULA. Tahap A sampai C selesai. Perbaiki alur konfirmasi penerima sesuai keputusan D3 dan D4 dan Lampiran C.

MASALAH SAAT INI: src/components/public/RecipientConfirmPage.tsx memakai token demo tertanam (tok_demo_waiting_x9y8) yang bisa dipilih manual dari daftar pengiriman. Itu bukan tautan sekali pakai.

TUGAS:

1. Buat Edge Function (Deno, folder supabase/functions/) sesuai Lampiran C: shipment-token, confirm-get, confirm-submit. Token mentah dibuat acak kuat, HANYA ditampilkan sekali ke pembuat; di database disimpan HASIL HASH (SHA-256 dengan TOKEN_PEPPER). Token punya masa berlaku (ack_timeout_hours, bawaan 72 jam), sekali pakai, dan dibatasi laju (429).

2. Halaman /k/:token: memanggil confirm-get. Halaman TIDAK BOLEH menampilkan berat kirim (konfirmasi buta, D3). Hanya tampilkan nama fasilitas, tanggal kirim, nama material, dan batas waktu. Penerima mengisi berat terima (atau status: diterima / ditolak / berbeda) dan opsional foto, lalu confirm-submit. Setelah terpakai atau kedaluwarsa tampilkan pesan jelas (410).

3. Hapus daftar pilihan token demo dan semua token hardcode dari frontend. Halaman tanpa token valid menampilkan pesan "Tautan tidak valid".

4. Di layar pembuatan pengiriman (ShipmentCreateModal.tsx), tautan WhatsApp dibuat dari hasil shipment-token (url + expires_at). Tombol "terbitkan ulang tautan" (shipment.reissue_token) membatalkan token lama.

5. Konfirmasi yang masuk memicu engine-run untuk pengiriman tersebut (R3 dan R4) dan penulisan event_log lewat trigger database.

CEK SELESAI:
- [ ] grep "tok_demo" di seluruh repo tidak menemukan apa pun
- [ ] Membuka /k/<token> dua kali: kali kedua mendapat 410
- [ ] Respons confirm-get tidak mengandung berat kirim (cek tab Network)
- [ ] Token di tabel database tersimpan sebagai hash, bukan teks asli
```

---

## Prompt E: Mesin resmi di server, periode, dan integritas audit

```
Lanjutkan perbaikan SIRKULA. Tahap A sampai D selesai. Implementasikan hasil resmi di server dan integritas audit sesuai bagian 6, 7 (M5 sampai M9), 9 dan Lampiran A.3, C.

MASALAH SAAT INI: rantai hash (src/crypto/hashChain.ts) dihitung di sisi klien, sedangkan Aturan Wajib 0.4 dan keputusan D6 mengharuskan trigger database. Jangkar hash mingguan dan verifikasi rantai belum ada.

TUGAS:

1. Edge Function engine-run: impor paket engine yang sama dengan klien, jalankan untuk scope batch / shipment / daily / all, hasilnya idempoten (menjalankan dua kali pada data sama tidak membuat anomali ganda; anomali lama ditandai superseded). Simpan engine_version. R1 hanya pada batch ditutup (D10); basis ambang R1 per kategori dominan dengan fallback gabungan bila n kecil (D11), dengan lencana "belum terkalibrasi".

2. Edge Function review-anomaly (catatan minimal 10 karakter bila penyebab "lainnya"), report-close (409 bila periode sudah ditutup), threshold-freeze, cron-daily (tandai pengiriman kedaluwarsa, jalankan R4/R5, email pengingat) dan anchor-hash (email hash terakhir per fasilitas dan isi tabel hash_anchors). Sertakan cara menjadwalkan (Senin 02:00 WIB untuk anchor-hash, 01:00 WIB untuk cron-daily) di docs/RUNBOOK.md.

3. Pastikan audit trail dihitung oleh TRIGGER DATABASE (Lampiran A.3), bukan kode klien. Hapus pembuatan event berantai di klien (createChainedEvent) dari alur penulisan; klien hanya MEMBACA event_log dan memverifikasi rantainya.

4. UI audit (M9): daftar event per fasilitas dan tombol "Verifikasi rantai" yang memanggil fungsi verify_chain di database dan menampilkan hasil (utuh / putus pada seq N). Halaman publik /verifikasi memverifikasi hash laporan periode tanpa login.

5. Layar kalibrasi dan pembekuan ambang /kelola/ambang (bagian 6.8): ambang berversi (threshold_sets), draft → beku, ambang bawaan ditandai "sementara" sampai dikalibrasi dengan data timbangan referensi.

6. Kata terlarang: pastikan tidak ada "curang", "fraud", "korupsi", "bohong", "anti-kecurangan", "100% akurat", "blockchain", "AI" sebagai klaim di UI, laporan, notifikasi (kalimat penolakan seperti "bukan blockchain" di halaman Metode boleh tetap).

CEK SELESAI:
- [ ] Mengubah satu baris data langsung di SQL Editor membuat "Verifikasi rantai" menunjukkan rantai putus
- [ ] Menjalankan engine-run dua kali tidak menambah jumlah anomali
- [ ] Menutup periode yang sama dua kali menghasilkan 409
- [ ] Angka VRR di dasbor sama dengan hasil report-close
```

---

## Prompt F: Pengerasan, kebersihan, dan siap rilis

```
Lanjutkan perbaikan SIRKULA. Tahap A sampai E selesai. Kerjakan pengerasan dan kebersihan sesuai bagian 10, 12, 14, 15, 16, 21.

TUGAS:

1. Perbaiki dependensi agar npm install bersih tanpa --legacy-peer-deps. Saat ini gagal ERESOLVE: esbuild@0.25 bentrok dengan peerOptional vite@8 (butuh ^0.27 atau ^0.28). Naikkan esbuild atau selaraskan versi vite, @tailwindcss/vite, dan typescript. Pastikan npm run build dan npm run lint berhasil.

2. Aset: kompres gambar logo ChatGPT_Image_*.png (saat ini sekitar 1,3 MB) menjadi logo SVG atau PNG/WebP di bawah 100 KB; buat ikon PWA 192/512/maskable dan favicon terpisah; ganti nama file menjadi sirkula-logo.*. Pindahkan file spesifikasi dari public/assets/aistudio/ ke docs/ agar tidak ikut terlayani publik.

3. Keamanan: header keamanan (CSP, X-Content-Type-Options, Referrer-Policy, HSTS lewat konfigurasi hosting: buat file _headers untuk Cloudflare Pages atau vercel.json), CORS Edge Function dibatasi ke APP_BASE_URL, bucket evidence privat dengan signed URL pendek, tidak ada secret di bundel (periksa hasil npm run build dengan grep pada dist/).

4. Halaman legal: Kebijakan Privasi dan Syarat Penggunaan yang mencatat persetujuan; kontak dukungan WhatsApp tercantum di aplikasi (nomor diisi lewat variabel, kosongkan jika belum ada, jangan mengarang nomor).

5. Aksesibilitas dan performa: target Lighthouse Performance >= 85, Accessibility >= 95; semua kontrol bisa dipakai keyboard; kontras warna cukup.

6. Dokumentasi: docs/RUNBOOK.md (setup bagian 16.1, onboarding fasilitas 16.4), docs/PANDUAN_PETUGAS.md (satu halaman), docs/SECURITY_CHECKLIST.md (OWASP), CHANGELOG.md, README.md yang menjelaskan variabel lingkungan bagian 4.4 (hapus teks bawaan AI Studio tentang GEMINI_API_KEY).

7. Tes: Vitest untuk engine (semua vektor 6.7) dan tes e2e Playwright minimal untuk alur login per peran dan alur offline 8.8 butir 1.

8. Di akhir, buat file docs/STATUS_SPESIFIKASI.md yang menandai tiap modul M1 sampai M14 dan setiap butir daftar go-live bagian 21 sebagai: SELESAI / SEBAGIAN / BELUM, dengan alasan singkat. Jangan menandai SELESAI untuk hal yang belum diuji.

CEK SELESAI:
- [ ] npm install (tanpa flag) lalu npm run lint, npm run test, npm run build semuanya lulus
- [ ] grep -r "SERVICE_ROLE\|GEMINI" dist/ tidak menemukan apa pun
- [ ] Ukuran logo < 100 KB
- [ ] docs/STATUS_SPESIFIKASI.md ada dan jujur
```

---

## Jalur singkat kalau waktu mepet (tenggat lomba)

Spesifikasi bagian 17 sendiri bilang: kalau waktu mepet, cukup **Fase 0 sampai 3 + inti Fase 4**. Artinya kerjakan **A, B, D, dan E (bagian 1, 2, 5)**; offline penuh (C) dan sisanya boleh menyusul. Kalau Supabase tidak sempat disambungkan, pakai prompt di bawah agar aplikasi **jujur sebagai prototype demo** (jangan diserahkan ke juri dengan klaim yang tidak benar).

```
Aplikasi SIRKULA ini adalah PROTOTYPE DEMO tanpa backend. Ubah agar jujur dan konsisten, tanpa menambah fitur baru:

1. Tambahkan banner tetap di bagian atas semua halaman: "PROTOTYPE DEMO: data contoh tersimpan di browser ini saja dan bukan data nyata."
2. Hapus semua klaim yang tidak benar: teks "disimpan di IndexedDB", "tersinkron otomatis", "dilindungi di level basis data", "rantai hash di level basis data", dan klaim keamanan lain. Ganti dengan teks akurat, misalnya "Pada versi produksi, ... (lihat spesifikasi)". Halaman Metode boleh menjelaskan RENCANA arsitektur dengan label jelas "rencana versi produksi".
3. Ubah "Role Switcher" menjadi "Pilih peran demo" dengan keterangan "Hanya untuk peragaan juri; versi produksi memakai login".
4. Ganti token konfirmasi demo menjadi tombol "Contoh tautan konfirmasi" yang berlabel demo.
5. Kompres gambar logo (1,3 MB) menjadi di bawah 100 KB, perbaiki dependensi agar npm install bersih (konflik esbuild dengan vite 8), dan pindahkan file spesifikasi dari public/ ke docs/.
6. Pertahankan mesin neraca massa, vektor uji, dan semua perhitungan apa adanya.
```

---

## Untuk dicek ulang bersama Claude

Setelah tiap tahap, unggah **zip baru** (dan kalau ada, `docs/STATUS_SPESIFIKASI.md`). Yang akan dicek ulang:

- semua "Cek selesai" di tiap prompt (grep, tes, build),
- kesesuaian dengan spesifikasi per modul M1 sampai M14,
- klaim di UI dan dokumen induk `.docx` (supaya naskah tidak mengklaim fitur yang belum ada),
- kesiapan go-live bagian 21.
