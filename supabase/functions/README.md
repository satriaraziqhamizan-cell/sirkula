# Supabase Edge Functions SIRKULA

Koleksi Edge Functions (Deno / TypeScript) untuk sistem neraca massa dan ketertelusuran material SIRKULA.

## Daftar Fungsi

| Direktori | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| `shipment-token` | `/functions/v1/shipment-token` | Terotentikasi (JWT) | Menerbitkan token konfirmasi 32-byte acak sekali pakai. Menyimpan hanya hash SHA-256(token + pepper) di database. |
| `confirm-get` | `/functions/v1/confirm-get` | Publik | Mengambil metadata pengiriman untuk form konfirmasi buta. **TIDAK PERNAH membocorkan angka berat kirim**. |
| `confirm-submit` | `/functions/v1/confirm-submit` | Publik | Menerima berat timbangan mitra ($W'_k$), mencatat konfirmasi secara atomik, dan mengevaluasi selisih (R3/R4). |
| `engine-run` | `/functions/v1/engine-run` | Service Role / Cron | Menjalankan perhitungan aturan anomali (R1 s.d. R6) di server secara idempoten. |
| `report-close` | `/functions/v1/report-close` | Pengelola / Admin | Menghitung RR, VRR, Gap dan membekukan snapshot hash laporan periode secara resmi di server. |
| `cron-daily` | `/functions/v1/cron-daily` | Terjadwal (01:00 WIB) | Menandai pengiriman kedaluwarsa jika melewati batas toleransi `ack_timeout_hours` fasilitas. |
| `anchor-hash` | `/functions/v1/anchor-hash` | Terjadwal (Senin 02:00 WIB) | Menjangkarkan hash audit trail terakhir ke tabel `hash_anchors` untuk bukti audit eksternal. |

---

## Secret yang Wajib Dikonfigurasi

Atur di Supabase Dashboard: **Project Settings → Edge Functions → Secrets** atau lewat CLI:

```bash
supabase secrets set TOKEN_PEPPER="kunci_rahasia_acak_minimal_32_karakter_sirkula"
supabase secrets set APP_BASE_URL="https://sirkula.id"
```

Catatan: `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` disuntikkan secara otomatis oleh Supabase runtime.

---

## Cara Deploy ke Supabase Cloud

```bash
# Login ke Supabase CLI
supabase login

# Tautkan proyek
supabase link --project-ref <PROJECT_ID>

# Deploy seluruh fungsi
supabase functions deploy shipment-token --no-verify-jwt
supabase functions deploy confirm-get --no-verify-jwt
supabase functions deploy confirm-submit --no-verify-jwt
supabase functions deploy engine-run
supabase functions deploy report-close
supabase functions deploy cron-daily
supabase functions deploy anchor-hash
```

---

## Penjadwalan Cron (pg_cron)

Dapat dipasang melalui ekstensi `pg_cron` di Supabase SQL Editor:

```sql
-- Cron harian pukul 01:00 WIB (18:00 UTC)
select cron.schedule(
  'sirkula-cron-daily',
  '0 18 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_ID>.supabase.co/functions/v1/cron-daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true))
  );
  $$
);

-- Penjangkaran mingguan Senin pukul 02:00 WIB (Minggu 19:00 UTC)
select cron.schedule(
  'sirkula-anchor-weekly',
  '0 19 * * 0',
  $$
  select net.http_post(
    url := 'https://<PROJECT_ID>.supabase.co/functions/v1/anchor-hash',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key', true))
  );
  $$
);
```
