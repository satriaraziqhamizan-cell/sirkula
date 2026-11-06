-- ============================================================================
-- supabase/migrations/0008_fix_correct_audit.sql
-- Perbaikan Audit Trail & Otomatisasi Pencatatan Koreksi/Void SIRKULA
-- Menggantikan (CREATE OR REPLACE) app.log_event() dan public.apply_op
-- ============================================================================
-- 1. Menghapus seluruh INSERT manual ke event_log dari RPC apply_op.
--    Pencatatan audit HANYA dilakukan oleh trigger app.log_event() pada tabel.
-- 2. Alasan koreksi ('reason') dan pembatalan ('void_reason') disalurkan
--    melalui set_config('app.op_reason', ..., true) dan disisipkan secara
--    otomatis oleh app.log_event() ke dalam new_value['_reason'] SEBELUM
--    hash dihitung, sehingga konsisten 100% dengan public.verify_chain().
-- 3. Hasil RPC batch.correct tetap mengembalikan old_weight dan new_weight.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Perbarui Trigger Function app.log_event()
-- ----------------------------------------------------------------------------
create or replace function app.log_event() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_fac uuid;
  v_prev_hash text;
  v_prev_seq bigint;
  v_old jsonb;
  v_new jsonb;
  v_action text;
  v_now timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
  v_payload text;
  v_op text;
  v_reason text;
begin
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_new := to_jsonb(new);

  -- Sisipkan alasan operasi dari sesi (jika ada) ke dalam new_value['_reason']
  -- SEBELUM payload string dan hash kriptografis SHA-256 dihitung.
  v_reason := nullif(current_setting('app.op_reason', true), '');
  if v_reason is not null then
    v_new := jsonb_set(v_new, '{_reason}', to_jsonb(v_reason), true);
  end if;

  v_fac := coalesce((v_new->>'facility_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
  v_action := lower(tg_op);

  perform pg_advisory_xact_lock(hashtextextended(v_fac::text, 0));
  select seq, hash into v_prev_seq, v_prev_hash
    from event_log where facility_id = v_fac order by seq desc limit 1;
  if not found then v_prev_seq := 0; v_prev_hash := repeat('0', 64); end if;

  v_payload := concat_ws('|', tg_table_name, coalesce(v_new->>'id',''), v_action,
    coalesce(v_old::text,''), coalesce(v_new::text,''), coalesce(v_actor::text,''),
    to_char(v_now at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US'));
  v_op := nullif(current_setting('app.client_op_id', true), '');

  insert into event_log (facility_id, seq, entity, entity_id, action, old_value, new_value,
                         actor_id, actor_role, client_op_id, occurred_at, prev_hash, hash)
  values (v_fac, v_prev_seq + 1, tg_table_name, coalesce(v_new->>'id',''), v_action, v_old, v_new,
          v_actor, app.my_role()::text, v_op::uuid, v_now, v_prev_hash,
          encode(digest(convert_to(v_prev_hash || v_payload, 'utf8'), 'sha256'), 'hex'));
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Perbarui RPC public.apply_op (Tanpa Manual Insert ke event_log)
-- ----------------------------------------------------------------------------
create or replace function public.apply_op(p_op jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := (p_op->>'client_op_id')::uuid;
  v_type text := p_op->>'op_type';
  v_pl jsonb := p_op->'payload';
  v_fac uuid := coalesce((v_pl->>'facility_id')::uuid, app.my_facility());
  v_user_role public.user_role := app.my_role();
  v_prev jsonb;
  v_res jsonb;
  v_item jsonb;
  v_line jsonb;
  v_onsite jsonb;
  v_old_weight numeric;
  v_new_weight numeric;
  v_thr_fac uuid;
  v_thr_status text;
begin
  -- 1. Pemeriksaan Autentikasi
  if auth.uid() is null or v_user_role is null then
    return jsonb_build_object('status','rejected','code','unauthenticated',
                              'message','Pengguna tidak terautentikasi atau akun pengguna tidak aktif.');
  end if;

  -- 2. Idempoten: periksa apakah client_op_id sudah pernah diproses
  select result into v_prev from sync_ops where client_op_id = v_id;
  if found then return v_prev; end if;

  -- 3. Matriks Peran per op_type (Bagian 3.2 Dokumen Induk SIRKULA)
  case
    -- Kelompok A: Pencatatan operasional harian (petugas_tps3r, pengelola, admin)
    when v_type in ('batch.create', 'batch.update_items', 'batch.close', 'batch.correct', 'shipment.create', 'partner.upsert') then
      if v_user_role not in ('petugas_tps3r', 'pengelola', 'admin') then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Peran ' || v_user_role::text || ' tidak diizinkan melakukan operasi ' || v_type || '.');
        insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
        values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected', v_res);
        return v_res;
      end if;

    -- Kelompok B: Otoritas manajerial (pengelola, admin - Petugas DITOLAK)
    when v_type in ('batch.void', 'shipment.void', 'anomaly.review', 'period.close') then
      if v_user_role not in ('pengelola', 'admin') then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Hanya pengelola atau admin yang berhak melakukan ' || v_type || '. Petugas tidak memiliki izin.');
        insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
        values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected', v_res);
        return v_res;
      end if;

    -- Kelompok C: Pembekuan ambang batas (admin untuk global & fasilitas, pengelola HANYA fasilitas sendiri)
    when v_type = 'threshold.freeze' then
      if v_user_role not in ('pengelola', 'admin') then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Hanya pengelola atau admin yang berhak membekukan ambang batas.');
        insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
        values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected', v_res);
        return v_res;
      end if;

    -- Kelompok D: Riset dan evaluasi (pengelola, admin)
    when v_type like 'research.%' then
      if v_user_role not in ('pengelola', 'admin') then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Operasi riset hanya dapat dijalankan oleh pengelola atau admin.');
        insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
        values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected', v_res);
        return v_res;
      end if;

    -- Kelompok E: Reset demo (hanya admin)
    when v_type = 'demo.reset' then
      if v_user_role <> 'admin' then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Hanya admin yang berhak mereset data demo.');
        insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
        values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected', v_res);
        return v_res;
      end if;

    else
      v_res := jsonb_build_object('status','rejected','code','unknown_op',
                                  'message','Jenis operasi tidak dikenal: ' || coalesce(v_type, 'null'));
      insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
      values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected', v_res);
      return v_res;
  end case;

  -- 4. Validasi Keharusan Fasilitas (facility_required)
  if v_fac is null then
    if v_type in ('demo.reset', 'research.sus_submit') then
      null;
    elsif v_type = 'threshold.freeze' then
      select facility_id into v_thr_fac from threshold_sets where id = (v_pl->>'threshold_id')::uuid;
      if v_thr_fac is not null then
        v_fac := v_thr_fac;
      elsif v_user_role <> 'admin' then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Hanya admin yang berhak membekukan ambang batas global.');
        insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
        values (v_id, auth.uid(), null, p_op->>'device_id', v_type, 'rejected', v_res);
        return v_res;
      end if;
    else
      v_res := jsonb_build_object('status','rejected','code','facility_required',
                                  'message','Fasilitas aktif wajib ditentukan untuk operasi ' || v_type || '.');
      insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
      values (v_id, auth.uid(), null, p_op->>'device_id', v_type, 'rejected', v_res);
      return v_res;
    end if;
  end if;

  -- 5. Hak Akses Penulisan Fasilitas (Kecuali Admin)
  if v_fac is not null and v_user_role <> 'admin' and not app.can_write_facility(v_fac) then
    v_res := jsonb_build_object('status','rejected','code','forbidden',
                                'message','Anda tidak memiliki izin penulisan pada fasilitas ini.');
    insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
    values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected', v_res);
    return v_res;
  end if;

  perform set_config('app.client_op_id', v_id::text, true);

  -- 6. Eksekusi Operasi dengan Verifikasi Baris Sasaran (FOUND check)
  case v_type
    when 'batch.create' then
      if coalesce((v_pl->>'weight_in_total_kg')::numeric, 0) <= 0 then
        v_res := jsonb_build_object('status','rejected','code','invalid_weight',
                                    'message','Berat masuk batch harus lebih besar dari 0 kg.');
      else
        insert into batches (
          id, facility_id, code, source_type, source_name,
          weight_in_total_kg, weigh_photo_path, received_at,
          officer_id, client_created_at, device_id, status
        )
        values (
          (v_pl->>'id')::uuid,
          v_fac,
          v_pl->>'code',
          v_pl->>'source_type',
          v_pl->>'source_name',
          (v_pl->>'weight_in_total_kg')::numeric,
          v_pl->>'weigh_photo_path',
          coalesce((v_pl->>'received_at')::timestamptz, now()),
          auth.uid(),
          (p_op->>'client_time')::timestamptz,
          p_op->>'device_id',
          'masuk'
        )
        on conflict (id) do nothing;

        -- Items pemilahan awal
        if jsonb_typeof(v_pl->'items') = 'array' then
          for v_item in select * from jsonb_array_elements(v_pl->'items') loop
            insert into batch_items (id, facility_id, batch_id, category_id, weight_sorted_kg)
            values (
              coalesce((v_item->>'id')::uuid, gen_random_uuid()),
              v_fac,
              (v_pl->>'id')::uuid,
              (v_item->>'category_id')::uuid,
              (v_item->>'weight_sorted_kg')::numeric
            )
            on conflict (batch_id, category_id) do update set
              weight_sorted_kg = excluded.weight_sorted_kg;
          end loop;
        end if;

        -- Onsite processing
        if jsonb_typeof(v_pl->'onsite') = 'array' then
          for v_onsite in select * from jsonb_array_elements(v_pl->'onsite') loop
            insert into onsite_processing (id, facility_id, batch_id, method, weight_kg)
            values (
              coalesce((v_onsite->>'id')::uuid, gen_random_uuid()),
              v_fac,
              (v_pl->>'id')::uuid,
              v_onsite->>'method',
              (v_onsite->>'weight_kg')::numeric
            );
          end loop;
        end if;

        v_res := jsonb_build_object('status','ok');
      end if;

    when 'batch.update_items' then
      perform 1 from batches
      where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac and status <> 'void';

      if not found then
        v_res := jsonb_build_object('status','rejected','code','not_found',
                                    'message','Batch tidak ditemukan atau sudah dibatalkan.');
      else
        if jsonb_typeof(v_pl->'items') = 'array' then
          for v_item in select * from jsonb_array_elements(v_pl->'items') loop
            insert into batch_items (id, facility_id, batch_id, category_id, weight_sorted_kg)
            values (
              coalesce((v_item->>'id')::uuid, gen_random_uuid()),
              v_fac,
              (v_pl->>'batch_id')::uuid,
              (v_item->>'category_id')::uuid,
              (v_item->>'weight_sorted_kg')::numeric
            )
            on conflict (batch_id, category_id) do update set
              weight_sorted_kg = excluded.weight_sorted_kg;
          end loop;
        end if;

        update batches set status = 'dipilah', updated_at = now()
        where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac;

        v_res := jsonb_build_object('status','ok');
      end if;

    when 'batch.close' then
      if (v_pl->>'remaining_stock_kg') is null or (v_pl->>'remaining_stock_kg')::numeric < 0 then
        v_res := jsonb_build_object('status','rejected','code','reason_required',
                                    'message','Stok sisa (ΔS) wajib diisi dengan angka non-negatif.');
      else
        update batches set
          status = 'ditutup',
          remaining_stock_kg = (v_pl->>'remaining_stock_kg')::numeric,
          closed_at = coalesce((v_pl->>'closed_at')::timestamptz, now()),
          e_kg = (v_pl->>'e_kg')::numeric,
          e_rel = (v_pl->>'e_rel')::numeric,
          balance_status = coalesce(v_pl->>'balance_status', 'lolos'),
          needs_review = coalesce((v_pl->>'needs_review')::boolean, false),
          updated_at = now()
        where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac and status <> 'void';

        if not found then
          v_res := jsonb_build_object('status','rejected','code','not_found',
                                      'message','Batch tidak ditemukan atau sudah berstatus void.');
        else
          v_res := jsonb_build_object('status','ok');
        end if;
      end if;

    when 'batch.correct' then
      -- Koreksi bobot wajib menyertakan alasan
      if coalesce(trim(v_pl->>'reason'), '') = '' then
        v_res := jsonb_build_object('status','rejected','code','reason_required',
                                    'message','Alasan koreksi bobot batch wajib diisi.');
      elsif coalesce((v_pl->>'weight_in_total_kg')::numeric, 0) <= 0 then
        v_res := jsonb_build_object('status','rejected','code','invalid_weight',
                                    'message','Bobot koreksi batch harus lebih besar dari 0 kg.');
      else
        -- Ambil nilai bobot lama untuk verifikasi dan payload respons
        select weight_in_total_kg into v_old_weight
        from batches
        where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac and status <> 'void';

        if not found then
          v_res := jsonb_build_object('status','rejected','code','not_found',
                                      'message','Batch tidak ditemukan pada fasilitas ini atau sudah berstatus void.');
        else
          v_new_weight := (v_pl->>'weight_in_total_kg')::numeric;

          -- Set config app.op_reason agar trigger app.log_event() menyisipkan alasan ke _reason di new_value
          perform set_config('app.op_reason', v_pl->>'reason', true);

          update batches set
            weight_in_total_kg = v_new_weight,
            version = version + 1,
            updated_at = now()
          where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac;

          -- Catatan: TIDAK ADA insert manual ke event_log.
          -- Pencatatan audit dilakukan secara otomatis oleh trigger trg_audit_batches (AFTER UPDATE).
          v_res := jsonb_build_object('status','ok', 'old_weight', v_old_weight, 'new_weight', v_new_weight);
        end if;
      end if;

    when 'batch.void' then
      -- Pembatalan batch wajib menyertakan alasan
      if coalesce(trim(v_pl->>'void_reason'), '') = '' then
        v_res := jsonb_build_object('status','rejected','code','reason_required',
                                    'message','Alasan pembatalan (void) wajib diisi.');
      else
        -- Set config app.op_reason agar trigger app.log_event() menyisipkan alasan void ke _reason di new_value
        perform set_config('app.op_reason', v_pl->>'void_reason', true);

        update batches set
          status = 'void',
          void_reason = v_pl->>'void_reason',
          updated_at = now()
        where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac and status <> 'void';

        if not found then
          v_res := jsonb_build_object('status','rejected','code','not_found',
                                      'message','Batch tidak ditemukan atau sudah dibatalkan sebelumnya.');
        else
          v_res := jsonb_build_object('status','ok');
        end if;
      end if;

    when 'shipment.create' then
      insert into shipments (
        id, facility_id, partner_id, purpose,
        shipped_at, photo_path, officer_id, status
      )
      values (
        (v_pl->>'id')::uuid,
        v_fac,
        (v_pl->>'partner_id')::uuid,
        (v_pl->>'purpose')::public.outbound_purpose,
        coalesce((v_pl->>'shipped_at')::timestamptz, now()),
        v_pl->>'photo_path',
        auth.uid(),
        'dikirim'
      )
      on conflict (id) do nothing;

      if jsonb_typeof(v_pl->'lines') = 'array' then
        for v_line in select * from jsonb_array_elements(v_pl->'lines') loop
          insert into shipment_lines (id, facility_id, shipment_id, batch_id, category_id, weight_kg)
          values (
            coalesce((v_line->>'id')::uuid, gen_random_uuid()),
            v_fac,
            (v_pl->>'id')::uuid,
            (v_line->>'batch_id')::uuid,
            (v_line->>'category_id')::uuid,
            (v_line->>'weight_kg')::numeric
          );
        end loop;
      end if;

      v_res := jsonb_build_object('status','ok');

    when 'shipment.void' then
      if coalesce(trim(v_pl->>'void_reason'), '') = '' then
        v_res := jsonb_build_object('status','rejected','code','reason_required',
                                    'message','Alasan pembatalan pengiriman wajib diisi.');
      else
        perform set_config('app.op_reason', v_pl->>'void_reason', true);

        update shipments set
          status = 'void',
          void_reason = v_pl->>'void_reason',
          updated_at = now()
        where id = (v_pl->>'shipment_id')::uuid and facility_id = v_fac and status <> 'void';

        if not found then
          v_res := jsonb_build_object('status','rejected','code','not_found',
                                      'message','Pengiriman tidak ditemukan atau sudah dibatalkan sebelumnya.');
        else
          v_res := jsonb_build_object('status','ok');
        end if;
      end if;

    when 'partner.upsert' then
      if coalesce(trim(v_pl->>'name'), '') = '' then
        v_res := jsonb_build_object('status','rejected','code','invalid_name',
                                    'message','Nama mitra wajib diisi.');
      else
        insert into partners (id, facility_id, name, partner_type, phone, is_active)
        values (
          coalesce((v_pl->>'id')::uuid, gen_random_uuid()),
          v_fac,
          v_pl->>'name',
          v_pl->>'partner_type',
          v_pl->>'phone',
          coalesce((v_pl->>'is_active')::boolean, true)
        )
        on conflict (id) do update set
          name = excluded.name,
          partner_type = excluded.partner_type,
          phone = excluded.phone,
          is_active = excluded.is_active;

        v_res := jsonb_build_object('status','ok');
      end if;

    when 'anomaly.review' then
      update anomalies set
        status = v_pl->>'status',
        cause = v_pl->>'cause',
        review_note = v_pl->>'review_note',
        reviewed_by = auth.uid(),
        reviewed_at = now()
      where id = (v_pl->>'anomaly_id')::uuid and facility_id = v_fac;

      if not found then
        v_res := jsonb_build_object('status','rejected','code','not_found',
                                    'message','Anomali tidak ditemukan pada fasilitas ini.');
      else
        v_res := jsonb_build_object('status','ok');
      end if;

    when 'period.close' then
      insert into period_reports (
        id, facility_id, period_start, period_end, status,
        total_in_kg, verified_kg, verified_p_kg,
        rr, vrr, vrr_p, gap, coverage, blockers,
        threshold_set_id, engine_version, snapshot_hash,
        closed_by, closed_at
      )
      values (
        coalesce((v_pl->>'id')::uuid, gen_random_uuid()),
        v_fac,
        (v_pl->>'period_start')::date,
        (v_pl->>'period_end')::date,
        'closed',
        (v_pl->>'total_in_kg')::numeric,
        (v_pl->>'verified_kg')::numeric,
        (v_pl->>'verified_p_kg')::numeric,
        (v_pl->>'rr')::numeric,
        (v_pl->>'vrr')::numeric,
        (v_pl->>'vrr_p')::numeric,
        (v_pl->>'gap')::numeric,
        v_pl->'coverage',
        v_pl->'blockers',
        (v_pl->>'threshold_set_id')::uuid,
        v_pl->>'engine_version',
        v_pl->>'snapshot_hash',
        auth.uid(),
        now()
      )
      on conflict (facility_id, period_start, period_end) do update set
        status = 'closed',
        total_in_kg = excluded.total_in_kg,
        verified_kg = excluded.verified_kg,
        verified_p_kg = excluded.verified_p_kg,
        rr = excluded.rr,
        vrr = excluded.vrr,
        vrr_p = excluded.vrr_p,
        gap = excluded.gap,
        coverage = excluded.coverage,
        blockers = excluded.blockers,
        threshold_set_id = excluded.threshold_set_id,
        engine_version = excluded.engine_version,
        snapshot_hash = excluded.snapshot_hash,
        closed_by = auth.uid(),
        closed_at = now();

      v_res := jsonb_build_object('status','ok');

    when 'threshold.freeze' then
      select facility_id, status into v_thr_fac, v_thr_status
      from threshold_sets
      where id = (v_pl->>'threshold_id')::uuid;

      if not found then
        v_res := jsonb_build_object('status','rejected','code','not_found',
                                    'message','Ambang batas tidak ditemukan.');
      elsif v_thr_fac is null and v_user_role <> 'admin' then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Hanya admin yang berhak membekukan ambang batas global.');
      elsif v_thr_fac is not null and v_user_role <> 'admin' and v_thr_fac <> v_fac then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Pengelola hanya berhak membekukan ambang batas fasilitasnya sendiri.');
      elsif v_thr_status = 'beku' then
        v_res := jsonb_build_object('status','rejected','code','conflict',
                                    'message','Ambang batas ini sudah berstatus beku.');
      else
        update threshold_sets set
          status = 'beku',
          frozen_at = now(),
          frozen_by = auth.uid(),
          note = coalesce(v_pl->>'note', note)
        where id = (v_pl->>'threshold_id')::uuid
          and (facility_id is null or facility_id = v_fac);

        if not found then
          v_res := jsonb_build_object('status','rejected','code','not_found',
                                      'message','Ambang batas tidak ditemukan atau tidak sesuai cakupan fasilitas.');
        else
          v_res := jsonb_build_object('status','ok');
        end if;
      end if;

    when 'research.weighing_create' then
      insert into reference_weighings (
        id, facility_id, batch_id,
        facility_scale_kg, reference_scale_kg,
        weighed_by, weighed_at
      )
      values (
        coalesce((v_pl->>'id')::uuid, gen_random_uuid()),
        v_fac,
        (v_pl->>'batch_id')::uuid,
        (v_pl->>'facility_scale_kg')::numeric,
        (v_pl->>'reference_scale_kg')::numeric,
        auth.uid(),
        now()
      );
      v_res := jsonb_build_object('status','ok');

    when 'research.sus_submit' then
      insert into sus_responses (
        participant_code, role, answers, score, consent
      )
      values (
        v_pl->>'participant_code',
        v_pl->>'role',
        ARRAY(select jsonb_array_elements_text(v_pl->'answers'))::int[],
        (v_pl->>'score')::numeric,
        coalesce((v_pl->>'consent')::boolean, true)
      );
      v_res := jsonb_build_object('status','ok');

    when 'demo.reset' then
      -- Hanya admin yang dapat mereset data demo
      -- Catatan: Pengisian ulang data demo dilakukan dengan menjalankan supabase/seed/demo_seed.sql
      delete from batches where facility_id in (select id from facilities where is_demo = true);
      delete from shipments where facility_id in (select id from facilities where is_demo = true);
      delete from anomalies where facility_id in (select id from facilities where is_demo = true);
      delete from period_reports where facility_id in (select id from facilities where is_demo = true);
      v_res := jsonb_build_object('status','ok');

    else
      v_res := jsonb_build_object('status','rejected','code','unknown_op',
                                  'message','Jenis operasi tidak dikenal.');
  end case;

  -- 7. Catat Hasil di sync_ops untuk Idempotensi
  insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
  values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, v_res->>'status', v_res);
  return v_res;
exception when others then
  insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
  values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected',
          jsonb_build_object('status','rejected','code','error','message', sqlerrm))
  on conflict do nothing;
  return jsonb_build_object('status','rejected','code','error','message', sqlerrm);
end $$;

revoke all on function public.apply_op(jsonb) from anon;
grant execute on function public.apply_op(jsonb) to authenticated;
