-- ============================================================================
-- supabase/migrations/0009_blind_confirmation_and_functions.sql
-- SIRKULA: Protokol Konfirmasi Penerima Buta (F06) & Verifikasi Resmi Server
-- ============================================================================

-- 1. Tabel hash_anchors untuk penjangkaran berkala (Senin 02:00 WIB)
create table if not exists public.hash_anchors (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  seq_end bigint not null,
  hash text not null,
  anchor_type text not null default 'weekly_digest' check (anchor_type in ('weekly_digest','monthly_close','external_tx')),
  reference_info text,
  anchored_at timestamptz not null default now()
);
create index if not exists idx_hash_anchors_fac_date on hash_anchors (facility_id, anchored_at desc);

-- 2. Fungsi Pembantu: Pembuatan Token Pengiriman Sekali Pakai (Security Definer)
create or replace function public.create_shipment_token(p_shipment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_fac uuid;
  v_shipment record;
  v_timeout_hours int;
  v_raw_token text;
  v_token_hash text;
  v_pepper text := coalesce(nullif(current_setting('app.token_pepper', true), ''), 'sirkula-salt-2026');
  v_expires_at timestamptz;
begin
  -- 1. Validasi keberadaan pengiriman
  select s.*, f.ack_timeout_hours
  into v_shipment
  from shipments s
  join facilities f on f.id = s.facility_id
  where s.id = p_shipment_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Pengiriman tidak ditemukan.');
  end if;

  v_fac := v_shipment.facility_id;

  -- 2. Otorisasi: Pengguna harus berhak menulis ke fasilitas ini
  if auth.uid() is not null and app.my_role() <> 'admin' and not app.can_write_facility(v_fac) then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'Anda tidak memiliki hak akses atas pengiriman ini.');
  end if;

  -- 3. Batalkan token lama yang masih aktif untuk pengiriman ini
  update confirmation_tokens
  set revoked_at = now()
  where shipment_id = p_shipment_id and used_at is null and revoked_at is null;

  -- 4. Buat token acak 32 byte (base64url)
  v_raw_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_token_hash := encode(digest(convert_to(v_raw_token || v_pepper, 'utf8'), 'sha256'), 'hex');

  v_timeout_hours := coalesce(v_shipment.ack_timeout_hours, 72);
  v_expires_at := now() + (v_timeout_hours || ' hours')::interval;

  -- 5. Simpan HANYA hash di database
  insert into confirmation_tokens (
    shipment_id, token_hash, expires_at, created_by, created_at
  )
  values (
    p_shipment_id, v_token_hash, v_expires_at, auth.uid(), now()
  );

  return jsonb_build_object(
    'ok', true,
    'token', v_raw_token,
    'expires_at', v_expires_at,
    'timeout_hours', v_timeout_hours
  );
end $$;

grant execute on function public.create_shipment_token(uuid) to authenticated;

-- 3. Fungsi Publik: Ambil Informasi Ringkas Pengiriman via Token (Konfirmasi Buta)
-- CATATAN: Fungsi ini TIDAK PERNAH mengembalikan bobot kirim (weight_kg)
create or replace function public.get_confirmation_details(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pepper text := coalesce(nullif(current_setting('app.token_pepper', true), ''), 'sirkula-salt-2026');
  v_token_hash text;
  v_token_rec record;
  v_shipment record;
  v_materials text[];
begin
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('status', 400, 'code', 'token_required', 'message', 'Token konfirmasi tidak disertakan.');
  end if;

  v_token_hash := encode(digest(convert_to(trim(p_token) || v_pepper, 'utf8'), 'sha256'), 'hex');

  -- Cari token
  select * into v_token_rec
  from confirmation_tokens
  where token_hash = v_token_hash;

  if not found then
    return jsonb_build_object('status', 404, 'code', 'not_found', 'message', 'Tautan konfirmasi tidak ditemukan atau salah.');
  end if;

  -- Periksa status kedaluwarsa atau sudah terpakai (HTTP 410 Gone)
  if v_token_rec.revoked_at is not null then
    return jsonb_build_object('status', 410, 'code', 'revoked', 'message', 'Tautan konfirmasi ini telah dibatalkan oleh pihak fasilitas.');
  end if;

  if v_token_rec.used_at is not null then
    return jsonb_build_object('status', 410, 'code', 'already_used', 'message', 'Tautan konfirmasi ini sudah pernah digunakan sebelumnya.');
  end if;

  if v_token_rec.expires_at < now() then
    return jsonb_build_object('status', 410, 'code', 'expired', 'message', 'Tautan konfirmasi ini telah melewati batas waktu kedaluwarsa.');
  end if;

  -- Ambil detail pengiriman (HANYA info non-berat)
  select 
    s.id as shipment_id,
    s.shipped_at,
    s.purpose,
    f.name as facility_name,
    p.name as partner_name,
    p.partner_type
  into v_shipment
  from shipments s
  join facilities f on f.id = s.facility_id
  join partners p on p.id = s.partner_id
  where s.id = v_token_rec.shipment_id;

  -- Ambil daftar kategori material tanpa membocorkan bobot
  select array_agg(distinct mc.name order by mc.name)
  into v_materials
  from shipment_lines sl
  join material_categories mc on mc.id = sl.category_id
  where sl.shipment_id = v_shipment.shipment_id;

  return jsonb_build_object(
    'status', 200,
    'code', 'ok',
    'data', jsonb_build_object(
      'facility_name', v_shipment.facility_name,
      'partner_name', v_shipment.partner_name,
      'partner_type', v_shipment.partner_type,
      'purpose', v_shipment.purpose,
      'shipped_at', v_shipment.shipped_at,
      'materials', coalesce(v_materials, array[]::text[]),
      'expires_at', v_token_rec.expires_at
    )
  );
end $$;

grant execute on function public.get_confirmation_details(text) to anon, authenticated;

-- 4. Fungsi Publik: Kirim Konfirmasi Penerima Buta (Submit Blind Confirmation)
create or replace function public.submit_blind_confirmation(
  p_token text,
  p_weight_received numeric,
  p_status text,
  p_note text default null,
  p_photo_path text default null,
  p_device_info jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pepper text := coalesce(nullif(current_setting('app.token_pepper', true), ''), 'sirkula-salt-2026');
  v_token_hash text;
  v_token_rec record;
  v_shipment record;
  v_total_sent_kg numeric;
  v_discrepancy numeric;
  v_tau_d numeric := 0.05; -- batas toleransi default 5%
  v_thr record;
begin
  -- 1. Validasi parameter input
  if p_weight_received is null or p_weight_received < 0 then
    return jsonb_build_object('status', 400, 'code', 'invalid_weight', 'message', 'Berat yang diterima wajib diisi dengan nilai non-negatif.');
  end if;

  if p_status not in ('diterima', 'ditolak_tidak_sesuai') then
    return jsonb_build_object('status', 400, 'code', 'invalid_status', 'message', 'Status penerimaan tidak valid.');
  end if;

  v_token_hash := encode(digest(convert_to(trim(p_token) || v_pepper, 'utf8'), 'sha256'), 'hex');

  -- 2. Kunci baris token untuk menghindari konfirmasi ganda konkuren
  select * into v_token_rec
  from confirmation_tokens
  where token_hash = v_token_hash
  for update;

  if not found then
    return jsonb_build_object('status', 404, 'code', 'not_found', 'message', 'Token tidak ditemukan.');
  end if;

  if v_token_rec.used_at is not null then
    return jsonb_build_object('status', 410, 'code', 'already_used', 'message', 'Konfirmasi sudah pernah dilakukan sebelumnya.');
  end if;

  if v_token_rec.revoked_at is not null or v_token_rec.expires_at < now() then
    return jsonb_build_object('status', 410, 'code', 'expired', 'message', 'Tautan konfirmasi sudah kedaluwarsa.');
  end if;

  -- 3. Ambil data pengiriman
  select s.*, f.ack_timeout_hours
  into v_shipment
  from shipments s
  join facilities f on f.id = s.facility_id
  where s.id = v_token_rec.shipment_id;

  -- 4. Tandai token telah digunakan
  update confirmation_tokens
  set used_at = now()
  where id = v_token_rec.id;

  -- 5. Masukkan ke tabel confirmations
  insert into confirmations (
    facility_id, shipment_id, weight_received_kg, status, method, photo_path, note, device_info, confirmed_at
  )
  values (
    v_shipment.facility_id,
    v_shipment.id,
    p_weight_received,
    p_status,
    'token_link',
    p_photo_path,
    p_note,
    p_device_info,
    now()
  );

  -- 6. Ubah status pengiriman menjadi 'dikonfirmasi' atau 'ditolak'
  update shipments
  set
    status = case when p_status = 'diterima' then 'dikonfirmasi' else 'ditolak' end,
    updated_at = now()
  where id = v_shipment.id;

  -- 7. Evaluasi Anomali Dua Pihak (Aturan R3: Diskrepansi timbangan W_k vs W'_k)
  select coalesce(sum(weight_kg), 0) into v_total_sent_kg
  from shipment_lines
  where shipment_id = v_shipment.id;

  -- Ambil toleransi tau_d dari threshold_sets aktif fasilitas jika ada
  select (params->>'tau_d')::numeric into v_tau_d
  from threshold_sets
  where (facility_id = v_shipment.facility_id or facility_id is null) and status = 'beku'
  order by (facility_id is not null) desc, version desc
  limit 1;
  v_tau_d := coalesce(v_tau_d, 0.05);

  if v_total_sent_kg > 0 then
    v_discrepancy := abs(v_total_sent_kg - p_weight_received) / v_total_sent_kg;
    if v_discrepancy > v_tau_d or p_status = 'ditolak_tidak_sesuai' then
      insert into anomalies (
        facility_id, rule_code, severity, entity_type, entity_id,
        reason_text, status, detected_at
      )
      values (
        v_shipment.facility_id,
        'R3',
        case when v_discrepancy > 0.15 then 'tinggi' else 'sedang' end,
        'shipment',
        v_shipment.id::text,
        'Selisih timbangan antara fasilitas dan mitra sebesar ' || round((v_discrepancy * 100)::numeric, 1) || '% melebihi batas toleransi ' || round((v_tau_d * 100)::numeric, 1) || '%.',
        'open',
        now()
      )
      on conflict do nothing;

      update shipments set needs_review = true where id = v_shipment.id;
    end if;
  end if;

  -- CATATAN: Response tidak membocorkan angka v_total_sent_kg
  return jsonb_build_object(
    'status', 200,
    'code', 'ok',
    'message', 'Terima kasih, konfirmasi penerimaan material berhasil dicatat secara resmi di sistem SIRKULA.'
  );
end $$;

grant execute on function public.submit_blind_confirmation(text, numeric, text, text, text, jsonb) to anon, authenticated;
