-- 0005_rpc_apply_op.sql
-- Basis: Lampiran A.5 Dokumen Induk SIRKULA & Spesifikasi Tahap B

create or replace function public.apply_op(p_op jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := (p_op->>'client_op_id')::uuid;
  v_type text := p_op->>'op_type';
  v_pl jsonb := p_op->'payload';
  v_fac uuid := coalesce((v_pl->>'facility_id')::uuid, app.my_facility());
  v_prev jsonb;
  v_res jsonb;
  v_item jsonb;
  v_line jsonb;
  v_onsite jsonb;
  v_user_role text := app.my_role();
begin
  if auth.uid() is null then
    return jsonb_build_object('status','rejected','code','unauthenticated',
                              'message','Pengguna tidak terautentikasi.');
  end if;

  -- 1. Idempoten: periksa apakah client_op_id sudah pernah diproses
  select result into v_prev from sync_ops where client_op_id = v_id;
  if found then return v_prev; end if;

  -- 2. Hak akses fasilitas
  if v_fac is not null and not app.can_write_facility(v_fac) and v_user_role <> 'admin' then
    v_res := jsonb_build_object('status','rejected','code','forbidden',
                                'message','Anda tidak memiliki izin penulisan pada fasilitas ini.');
    insert into sync_ops (client_op_id, user_id, facility_id, device_id, op_type, status, result)
    values (v_id, auth.uid(), v_fac, p_op->>'device_id', v_type, 'rejected', v_res);
    return v_res;
  end if;

  perform set_config('app.client_op_id', v_id::text, true);

  -- 3. Routing per jenis operasi
  case v_type
    when 'batch.create' then
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

      -- Items pemilahan awal jika disertakan
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

      -- Onsite processing jika ada
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

    when 'batch.update_items' then
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

    when 'batch.close' then
      -- Menutup batch dengan stok sisa ΔS wajib
      update batches set
        status = 'ditutup',
        remaining_stock_kg = (v_pl->>'remaining_stock_kg')::numeric,
        closed_at = coalesce((v_pl->>'closed_at')::timestamptz, now()),
        e_kg = (v_pl->>'e_kg')::numeric,
        e_rel = (v_pl->>'e_rel')::numeric,
        balance_status = coalesce(v_pl->>'balance_status', 'lolos'),
        needs_review = coalesce((v_pl->>'needs_review')::boolean, false),
        updated_at = now()
      where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac;
      v_res := jsonb_build_object('status','ok');

    when 'batch.correct' then
      -- Koreksi bobot dengan alasan WAJIB
      if coalesce(trim(v_pl->>'reason'), '') = '' then
        v_res := jsonb_build_object('status','rejected','code','reason_required',
                                    'message','Alasan koreksi bobot batch wajib diisi.');
      else
        update batches set
          weight_in_total_kg = (v_pl->>'weight_in_total_kg')::numeric,
          version = version + 1,
          updated_at = now()
        where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac;

        insert into event_log (facility_id, event_type, target_table, target_id, payload, actor_id)
        values (v_fac, 'batch_corrected', 'batches', (v_pl->>'batch_id')::uuid,
                jsonb_build_object('reason', v_pl->>'reason', 'weight', v_pl->>'weight_in_total_kg'), auth.uid());

        v_res := jsonb_build_object('status','ok');
      end if;

    when 'batch.void' then
      -- Pembatalan batch dengan alasan WAJIB
      if coalesce(trim(v_pl->>'void_reason'), '') = '' then
        v_res := jsonb_build_object('status','rejected','code','reason_required',
                                    'message','Alasan pembatalan (void) wajib diisi.');
      else
        update batches set
          status = 'void',
          void_reason = v_pl->>'void_reason',
          updated_at = now()
        where id = (v_pl->>'batch_id')::uuid and facility_id = v_fac;

        insert into event_log (facility_id, event_type, target_table, target_id, payload, actor_id)
        values (v_fac, 'batch_voided', 'batches', (v_pl->>'batch_id')::uuid,
                jsonb_build_object('void_reason', v_pl->>'void_reason'), auth.uid());

        v_res := jsonb_build_object('status','ok');
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
        update shipments set
          status = 'void',
          void_reason = v_pl->>'void_reason',
          updated_at = now()
        where id = (v_pl->>'shipment_id')::uuid and facility_id = v_fac;

        insert into event_log (facility_id, event_type, target_table, target_id, payload, actor_id)
        values (v_fac, 'shipment_voided', 'shipments', (v_pl->>'shipment_id')::uuid,
                jsonb_build_object('void_reason', v_pl->>'void_reason'), auth.uid());

        v_res := jsonb_build_object('status','ok');
      end if;

    when 'partner.upsert' then
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

    when 'anomaly.review' then
      update anomalies set
        status = v_pl->>'status',
        cause = v_pl->>'cause',
        review_note = v_pl->>'review_note',
        reviewed_by = auth.uid(),
        reviewed_at = now()
      where id = (v_pl->>'anomaly_id')::uuid and facility_id = v_fac;

      insert into event_log (facility_id, event_type, target_table, target_id, payload, actor_id)
      values (v_fac, 'anomaly_reviewed', 'anomalies', (v_pl->>'anomaly_id')::uuid,
              jsonb_build_object('status', v_pl->>'status', 'cause', v_pl->>'cause', 'review_note', v_pl->>'review_note'), auth.uid());

      v_res := jsonb_build_object('status','ok');

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

      insert into event_log (facility_id, event_type, target_table, payload, actor_id)
      values (v_fac, 'period_closed', 'period_reports',
              jsonb_build_object('period_start', v_pl->>'period_start', 'period_end', v_pl->>'period_end', 'gap', v_pl->>'gap'), auth.uid());

      v_res := jsonb_build_object('status','ok');

    when 'threshold.freeze' then
      update threshold_sets set
        status = 'beku',
        frozen_at = now(),
        frozen_by = auth.uid(),
        note = coalesce(v_pl->>'note', note)
      where id = (v_pl->>'threshold_id')::uuid;

      insert into event_log (facility_id, event_type, target_table, target_id, payload, actor_id)
      values (v_fac, 'threshold_frozen', 'threshold_sets', (v_pl->>'threshold_id')::uuid,
              jsonb_build_object('note', v_pl->>'note'), auth.uid());

      v_res := jsonb_build_object('status','ok');

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
      if v_user_role <> 'admin' then
        v_res := jsonb_build_object('status','rejected','code','forbidden',
                                    'message','Hanya admin yang berhak mereset data demo.');
      else
        -- Hanya sentuh baris is_demo = true
        delete from batches where facility_id in (select id from facilities where is_demo = true);
        delete from shipments where facility_id in (select id from facilities where is_demo = true);
        delete from anomalies where facility_id in (select id from facilities where is_demo = true);
        delete from period_reports where facility_id in (select id from facilities where is_demo = true);
        v_res := jsonb_build_object('status','ok');
      end if;

    else
      v_res := jsonb_build_object('status','rejected','code','unknown_op',
                                  'message','Jenis operasi tidak dikenal: ' || coalesce(v_type, 'null'));
  end case;

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
