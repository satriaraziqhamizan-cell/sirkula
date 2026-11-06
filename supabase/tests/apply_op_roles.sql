-- ============================================================================
-- supabase/tests/apply_op_roles.sql
-- Skenario Uji Manual & Validasi Penegakan Peran RPC public.apply_op
-- Sesuai Matriks Bagian 3.2 Spesifikasi SIRKULA & Migrasi 0007 / 0008
-- ============================================================================
-- Petunjuk Eksekusi:
-- File ini dapat dijalankan langsung di Supabase SQL Editor atau melalui psql.
-- Seluruh output menggunakan RAISE NOTICE standar di dalam blok DO $$ sehingga
-- kompatibel 100% tanpa error meta-command psql (\echo).
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_fac_a uuid := '00000000-0000-0000-0000-000000000011';
  v_fac_b uuid := '00000000-0000-0000-0000-000000000012';

  v_user_petugas uuid := '00000000-0000-0000-0000-000000000021';
  v_user_pengelola_a uuid := '00000000-0000-0000-0000-000000000022';
  v_user_pengelola_b uuid := '00000000-0000-0000-0000-000000000023';
  v_user_dinas uuid := '00000000-0000-0000-0000-000000000024';
  v_user_admin uuid := '00000000-0000-0000-0000-000000000025';

  v_res jsonb;
  v_test_op_id uuid;
  v_batch_id uuid;
  v_chain_ok boolean;
  v_chain_checked bigint;
  v_chain_broken bigint;
  v_audit_reason text;
  v_audit_weight numeric;
BEGIN
  RAISE NOTICE '=== MEMULAI PENGUJIAN PENGAWASAN PERAN APPLY_OP & AUDIT TRAIL ===';

  -- ----------------------------------------------------------------------------
  -- SETUP & PENGKONDISIAN PENGUJIAN
  -- ----------------------------------------------------------------------------
  INSERT INTO organizations (id, name, code, is_demo)
  VALUES (v_org_id, 'Dinas Lingkungan Hidup Uji', 'DLH-TEST', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO facilities (id, org_id, code, name, facility_type, is_demo)
  VALUES 
    (v_fac_a, v_org_id, 'TPS3R-TEST-A', 'TPS 3R Sukamaju A', 'tps3r', true),
    (v_fac_b, v_org_id, 'TPS3R-TEST-B', 'TPS 3R Sukamaju B', 'tps3r', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, org_id, facility_id, name, role, is_active)
  VALUES
    (v_user_petugas, v_org_id, v_fac_a, 'Budi Petugas A', 'petugas_tps3r', true),
    (v_user_pengelola_a, v_org_id, v_fac_a, 'Siti Pengelola A', 'pengelola', true),
    (v_user_pengelola_b, v_org_id, v_fac_b, 'Agus Pengelola B', 'pengelola', true),
    (v_user_dinas, v_org_id, NULL, 'Ir. Hendra Dinas', 'dinas', true),
    (v_user_admin, v_org_id, NULL, 'Super Admin Sistem', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    facility_id = EXCLUDED.facility_id;

  RAISE NOTICE 'Setup profil pengujian selesai.';

  -- ==========================================================================
  -- SKENARIO 1: Petugas mencoba period.close (Harus ditolak: forbidden)
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_user_petugas::text, true);
  v_test_op_id := gen_random_uuid();

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'period.close',
    'payload', jsonb_build_object(
      'facility_id', v_fac_a,
      'period_start', '2026-03-01',
      'period_end', '2026-03-31',
      'total_in_kg', 1200,
      'verified_kg', 850,
      'rr', 0.708,
      'vrr', 0.708,
      'gap', 0.0,
      'snapshot_hash', repeat('a', 64)
    )
  ));

  IF v_res->>'status' = 'rejected' AND v_res->>'code' = 'forbidden' THEN
    RAISE NOTICE '[BERHASIL] Skenario 1 Lolos: Petugas ditolak saat period.close (code: %)', v_res->>'code';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 1: Petugas seharusnya ditolak saat period.close, hasil: %', v_res;
  END IF;

  -- ==========================================================================
  -- SKENARIO 2: Petugas mencoba threshold.freeze (Harus ditolak: forbidden)
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_user_petugas::text, true);
  v_test_op_id := gen_random_uuid();

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'threshold.freeze',
    'payload', jsonb_build_object(
      'threshold_id', '00000000-0000-0000-0000-000000000001',
      'facility_id', v_fac_a,
      'note', 'Percobaan beku oleh petugas'
    )
  ));

  IF v_res->>'status' = 'rejected' AND v_res->>'code' = 'forbidden' THEN
    RAISE NOTICE '[BERHASIL] Skenario 2 Lolos: Petugas ditolak saat threshold.freeze (code: %)', v_res->>'code';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 2: Petugas seharusnya ditolak saat threshold.freeze, hasil: %', v_res;
  END IF;

  -- ==========================================================================
  -- SKENARIO 3: Pengelola Fasilitas A mencoba menulis ke Fasilitas B (Ditolak)
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_user_pengelola_a::text, true);
  v_test_op_id := gen_random_uuid();

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'batch.create',
    'payload', jsonb_build_object(
      'id', gen_random_uuid(),
      'facility_id', v_fac_b,
      'code', 'BATCH-CROSS-FAC',
      'source_type', 'truk_tps',
      'source_name', 'Wilayah B',
      'weight_in_total_kg', 450.0
    )
  ));

  IF v_res->>'status' = 'rejected' AND v_res->>'code' = 'forbidden' THEN
    RAISE NOTICE '[BERHASIL] Skenario 3 Lolos: Pengelola Fasilitas A ditolak menulis ke Fasilitas B (code: %)', v_res->>'code';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 3: Pengelola A seharusnya ditolak menulis ke Fasilitas B, hasil: %', v_res;
  END IF;

  -- ==========================================================================
  -- SKENARIO 4: Dinas mencoba batch.create (Harus ditolak: peran pengawas murni)
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_user_dinas::text, true);
  v_test_op_id := gen_random_uuid();

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'batch.create',
    'payload', jsonb_build_object(
      'id', gen_random_uuid(),
      'facility_id', v_fac_a,
      'code', 'BATCH-DINAS-ATTEMPT',
      'source_type', 'gerobak_rw',
      'source_name', 'RW 01',
      'weight_in_total_kg', 300.0
    )
  ));

  IF v_res->>'status' = 'rejected' AND v_res->>'code' = 'forbidden' THEN
    RAISE NOTICE '[BERHASIL] Skenario 4 Lolos: Dinas ditolak saat batch.create (code: %)', v_res->>'code';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 4: Dinas seharusnya tidak boleh batch.create, hasil: %', v_res;
  END IF;

  -- ==========================================================================
  -- SKENARIO 5: Petugas mencoba batch.void (Harus ditolak: wewenang pengelola/admin)
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_user_petugas::text, true);
  v_test_op_id := gen_random_uuid();

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'batch.void',
    'payload', jsonb_build_object(
      'batch_id', gen_random_uuid(),
      'facility_id', v_fac_a,
      'void_reason', 'Membatalkan batch yang salah'
    )
  ));

  IF v_res->>'status' = 'rejected' AND v_res->>'code' = 'forbidden' THEN
    RAISE NOTICE '[BERHASIL] Skenario 5 Lolos: Petugas ditolak saat batch.void (code: %)', v_res->>'code';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 5: Petugas seharusnya tidak boleh batch.void, hasil: %', v_res;
  END IF;

  -- ==========================================================================
  -- SKENARIO 6: Operasi tanpa facility_id saat wajib fasilitas (code: facility_required)
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);
  v_test_op_id := gen_random_uuid();

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'batch.create',
    'payload', jsonb_build_object(
      'id', gen_random_uuid(),
      'code', 'BATCH-NO-FACILITY',
      'weight_in_total_kg', 250.0
    )
  ));

  IF v_res->>'status' = 'rejected' AND v_res->>'code' = 'facility_required' THEN
    RAISE NOTICE '[BERHASIL] Skenario 6 Lolos: Operasi tanpa fasilitas ditolak (code: facility_required)';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 6: Operasi tanpa fasilitas harus menghasilkan code facility_required, hasil: %', v_res;
  END IF;

  -- ==========================================================================
  -- SKENARIO 7: Koreksi bobot tanpa alasan (code: reason_required)
  -- ==========================================================================
  PERFORM set_config('request.jwt.claim.sub', v_user_pengelola_a::text, true);
  v_test_op_id := gen_random_uuid();

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'batch.correct',
    'payload', jsonb_build_object(
      'batch_id', gen_random_uuid(),
      'facility_id', v_fac_a,
      'weight_in_total_kg', 400.0,
      'reason', ''
    )
  ));

  IF v_res->>'status' = 'rejected' AND v_res->>'code' = 'reason_required' THEN
    RAISE NOTICE '[BERHASIL] Skenario 7 Lolos: Koreksi bobot tanpa alasan ditolak (code: reason_required)';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 7: Koreksi tanpa alasan harus ditolak, hasil: %', v_res;
  END IF;

  -- ==========================================================================
  -- SKENARIO 8: Koreksi batch tidak ditemukan / void (code: not_found)
  -- ==========================================================================
  v_test_op_id := gen_random_uuid();

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'batch.correct',
    'payload', jsonb_build_object(
      'batch_id', gen_random_uuid(),
      'facility_id', v_fac_a,
      'weight_in_total_kg', 400.0,
      'reason', 'Koreksi kalibrasi timbangan ulang'
    )
  ));

  IF v_res->>'status' = 'rejected' AND v_res->>'code' = 'not_found' THEN
    RAISE NOTICE '[BERHASIL] Skenario 8 Lolos: Target baris tidak ditemukan ditolak (code: not_found)';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 8: Target tidak ditemukan harus menghasilkan not_found, hasil: %', v_res;
  END IF;

  -- ==========================================================================
  -- SKENARIO 9: Audit Trail Otomatis & Keutuhan Rantai verify_chain()
  -- ==========================================================================
  -- Buat batch baru di Fasilitas A
  v_batch_id := gen_random_uuid();
  v_test_op_id := gen_random_uuid();
  PERFORM set_config('request.jwt.claim.sub', v_user_pengelola_a::text, true);

  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'batch.create',
    'payload', jsonb_build_object(
      'id', v_batch_id,
      'facility_id', v_fac_a,
      'code', 'BATCH-AUDIT-TEST-01',
      'source_type', 'gerobak_rw',
      'source_name', 'RW 05 Uji',
      'weight_in_total_kg', 500.0
    )
  ));

  IF v_res->>'status' <> 'ok' THEN
    RAISE EXCEPTION '[GAGAL] Skenario 9: batch.create gagal, hasil: %', v_res;
  END IF;

  -- Koreksi bobot batch dengan alasan
  v_test_op_id := gen_random_uuid();
  v_res := public.apply_op(jsonb_build_object(
    'client_op_id', v_test_op_id,
    'op_type', 'batch.correct',
    'payload', jsonb_build_object(
      'batch_id', v_batch_id,
      'facility_id', v_fac_a,
      'weight_in_total_kg', 525.5,
      'reason', 'Penyesuaian tara timbangan setelah tera ulang'
    )
  ));

  IF v_res->>'status' = 'ok' 
     AND (v_res->>'old_weight')::numeric = 500.0 
     AND (v_res->>'new_weight')::numeric = 525.5 THEN
    RAISE NOTICE '[BERHASIL] Skenario 9A Lolos: batch.correct sukses mengembalikan old_weight: % dan new_weight: %', 
      v_res->>'old_weight', v_res->>'new_weight';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 9A: batch.correct gagal atau nilai kembalian salah: %', v_res;
  END IF;

  -- Verifikasi bahwa trigger app.log_event() menyisipkan _reason di new_value
  SELECT (new_value->>'_reason'), (new_value->>'weight_in_total_kg')::numeric 
  INTO v_audit_reason, v_audit_weight
  FROM event_log
  WHERE facility_id = v_fac_a 
    AND entity = 'batches' 
    AND entity_id = v_batch_id::text 
    AND action = 'update'
  ORDER BY seq DESC LIMIT 1;

  IF v_audit_reason = 'Penyesuaian tara timbangan setelah tera ulang' AND v_audit_weight = 525.5 THEN
    RAISE NOTICE '[BERHASIL] Skenario 9B Lolos: app.log_event() otomatis mencatat _reason di new_value event_log';
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 9B: _reason tidak ditemukan pada new_value event_log. Nilai: %', v_audit_reason;
  END IF;

  -- Panggil verify_chain(v_fac_a) untuk memastikan integritas hash SHA-256
  SELECT ok, checked, broken_at INTO v_chain_ok, v_chain_checked, v_chain_broken
  FROM public.verify_chain(v_fac_a);

  IF v_chain_ok = true THEN
    RAISE NOTICE '[BERHASIL] Skenario 9C Lolos: public.verify_chain(%) menghasilkan ok = true (checked: % event)', 
      v_fac_a, v_chain_checked;
  ELSE
    RAISE EXCEPTION '[GAGAL] Skenario 9C: verify_chain gagal pada baris seq #%, ok: %', v_chain_broken, v_chain_ok;
  END IF;

  RAISE NOTICE '=== SELURUH SKENARIO UJI KEAMANAN PERAN & AUDIT TRAIL BERHASIL 100%% ===';
END $$;
