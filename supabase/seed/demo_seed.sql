-- ============================================================================
-- supabase/seed/demo_seed.sql
-- Seed Tenant Demo SIRKULA (Bagian 18 & 13.2 Dokumen Induk SIRKULA)
-- File ini aman dijalankan berulang kali (Idempoten via ON CONFLICT DO NOTHING / UPDATE)
-- Semua data demo terikat pada fasilitas berstatus is_demo = true.
-- ============================================================================

-- 1. Kategori Material Standar
insert into public.material_categories (id, code, name, default_tolerance_pct, sort_order, is_active) values
('00000000-0000-0000-0000-000000000101', 'organik', 'Organik (Sisa Makanan & Daun)', 5.0, 1, true),
('00000000-0000-0000-0000-000000000102', 'plastik', 'Plastik (PET, HDPE, Film)', 3.0, 2, true),
('00000000-0000-0000-0000-000000000103', 'kertas', 'Kertas & Karton / Kardus', 4.0, 3, true),
('00000000-0000-0000-0000-000000000104', 'logam', 'Logam (Aluminium, Besi, Seng)', 2.0, 4, true),
('00000000-0000-0000-0000-000000000105', 'kaca', 'Kaca / Botol', 3.0, 5, true),
('00000000-0000-0000-0000-000000000106', 'residu', 'Residu (Tidak Dapat Didaur Ulang)', 5.0, 6, true)
on conflict (code) do update set
  name = excluded.name,
  default_tolerance_pct = excluded.default_tolerance_pct,
  sort_order = excluded.sort_order,
  is_active = true;

-- 2. Organisasi Demo
insert into public.organizations (id, name, region_code, org_type) values
('00000000-0000-0000-0000-000000000001', 'Dinas Lingkungan Hidup Kota Semarang (Tenant Demo)', '33.74', 'dinas')
on conflict (id) do update set
  name = excluded.name,
  region_code = excluded.region_code,
  org_type = excluded.org_type;

-- 3. Enam (6) Fasilitas Fiktif Demo (is_demo = true)
insert into public.facilities (id, org_id, name, public_alias, facility_type, province, city, lat, lng, timezone, scale_resolution_kg, ack_timeout_hours, is_demo, is_active) values
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'TPS3R Mulyo Asri — Banyumanik (Demo)', 'TPS3R Mulyo Asri', 'tps3r', 'Jawa Tengah', 'Kota Semarang', -7.0652, 110.4187, 'Asia/Jakarta', 0.1, 72, true, true),
('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'TPS3R Resik Tembalang Mandiri (Demo)', 'TPS3R Resik Tembalang', 'tps3r', 'Jawa Tengah', 'Kota Semarang', -7.0518, 110.4392, 'Asia/Jakarta', 0.1, 72, true, true),
('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'TPS3R Berkah Pedurungan Sejahtera (Demo)', 'TPS3R Berkah Pedurungan', 'tps3r', 'Jawa Tengah', 'Kota Semarang', -7.0094, 110.4721, 'Asia/Jakarta', 0.5, 72, true, true),
('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'TPS3R Hijau Lestari — Ngaliyan (Demo Pilot)', 'TPS3R Hijau Ngaliyan', 'tps3r', 'Jawa Tengah', 'Kota Semarang', -6.9942, 110.3411, 'Asia/Jakarta', 0.2, 72, true, true),
('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'TPS3R Sendangguwo Bersih (Demo)', 'TPS3R Sendangguwo', 'tps3r', 'Jawa Tengah', 'Kota Semarang', -7.0189, 110.4532, 'Asia/Jakarta', 0.1, 72, true, true),
('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'TPS3R Candisari Makmur (Demo)', 'TPS3R Candisari', 'tps3r', 'Jawa Tengah', 'Kota Semarang', -7.0254, 110.4289, 'Asia/Jakarta', 0.1, 72, true, true)
on conflict (id) do update set
  name = excluded.name,
  public_alias = excluded.public_alias,
  is_demo = true,
  is_active = true;

-- 4. Tiga (3) Mitra per Fasilitas (18 mitra demo)
insert into public.partners (id, facility_id, name, partner_type, phone, is_active) values
-- Fac 11
('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011', 'UD Berkah Plastik Lestari (Demo)', 'pengepul', '6281234567890', true),
('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011', 'Koperasi Daur Logam Nusantara (Demo)', 'pengolah', '6285678901234', true),
('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000011', 'UPTD TPA Jatibarang Semarang (Demo)', 'tpa', '6282134567890', true),
-- Fac 12
('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000012', 'Pengepul Daur Tembalang Mandiri (Demo)', 'pengepul', '6281234567891', true),
('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000012', 'Pusat Kompos Tembalang Asri (Demo)', 'pengolah', '6285678901235', true),
('00000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000012', 'UPTD TPA Jatibarang Semarang (Demo)', 'tpa', '6282134567890', true),
-- Fac 13
('00000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000013', 'Lapak Plastik Pedurungan Jaya (Demo)', 'pengepul', '6281234567892', true),
('00000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000013', 'Pabrik Penggilingan Plastik Semarang (Demo)', 'pengolah', '6285678901236', true),
('00000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000013', 'UPTD TPA Jatibarang Semarang (Demo)', 'tpa', '6282134567890', true),
-- Fac 14
('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000014', 'Sentra Kardus Ngaliyan (Demo)', 'pengepul', '6281234567893', true),
('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000014', 'Bio-Organik Maggot Ngaliyan (Demo)', 'pengolah', '6285678901237', true),
('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000014', 'UPTD TPA Jatibarang Semarang (Demo)', 'tpa', '6282134567890', true),
-- Fac 15
('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000015', 'UD Sukses Logam Sendangguwo (Demo)', 'pengepul', '6281234567894', true),
('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000015', 'Koperasi Olah Resik Sendangguwo (Demo)', 'pengolah', '6285678901238', true),
('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000015', 'UPTD TPA Jatibarang Semarang (Demo)', 'tpa', '6282134567890', true),
-- Fac 16
('00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000016', 'Bank Sampah Induk Candisari (Demo)', 'pengepul', '6281234567895', true),
('00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-000000000016', 'Pusat Pengolahan Hijau Candisari (Demo)', 'pengolah', '6285678901239', true),
('00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-000000000016', 'UPTD TPA Jatibarang Semarang (Demo)', 'tpa', '6282134567890', true)
on conflict (id) do update set
  name = excluded.name,
  partner_type = excluded.partner_type,
  phone = excluded.phone,
  is_active = true;

-- 5. Profil Akun Demo (Auth Profiles)
-- Catatan: UUID auth.users dibuat oleh Supabase Auth saat admin/petugas didaftarkan.
-- Seed profile di sini menyediakan placeholder bagi user demo.
insert into public.profiles (id, username, display_name, role, org_id, facility_id, is_active, must_change_password) values
('00000000-0000-0000-0000-000000000041', 'petugas1', 'Petugas-01 (Joko Widodo P.)', 'petugas_tps3r', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', true, false),
('00000000-0000-0000-0000-000000000042', 'petugas2', 'Petugas-02 (Agus Salim)', 'petugas_tps3r', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', true, false),
('00000000-0000-0000-0000-000000000043', 'pengelola1', 'Budi Santoso, S.T. (Ketua KSM)', 'pengelola', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', true, false),
('00000000-0000-0000-0000-000000000044', 'dinas1', 'Ir. Hendro Wijaya, M.Env (Dinas LH)', 'dinas', '00000000-0000-0000-0000-000000000001', null, true, false),
('00000000-0000-0000-0000-000000000045', 'admin1', 'Dr. Satria Raziq (Tim Ahli SIRKULA)', 'admin', '00000000-0000-0000-0000-000000000001', null, true, false)
on conflict (id) do update set
  display_name = excluded.display_name,
  role = excluded.role,
  is_active = true;

-- 6. Ambang Batas Demo (Threshold Set Beku & Draft)
insert into public.threshold_sets (id, facility_id, version, status, provisional, params, category_stats, calibration_from, calibration_to, frozen_at, frozen_by, note) values
('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000011', 1, 'beku', false,
 '{"tau_neg": 0.02, "tau_d": 0.05, "z_cutoff": 3.5, "min_n": 15, "ack_timeout_hours": 72, "gap_small": 0.05, "coverage_low": 0.6}'::jsonb,
 '{"plastik": {"n": 24, "mad": 0.012, "median": 0.038, "meanAd": 0.014}, "kertas": {"n": 18, "mad": 0.015, "median": 0.042, "meanAd": 0.017}, "organik": {"n": 30, "mad": 0.021, "median": 0.065, "meanAd": 0.023}, "pooled": {"n": 72, "mad": 0.018, "median": 0.048, "meanAd": 0.020}}'::jsonb,
 '2026-09-01', '2026-09-30', '2026-10-01T10:00:00Z', '00000000-0000-0000-0000-000000000043',
 'Hasil kalibrasi fase baseline 72 batch di TPS3R Mulyo Asri, diverifikasi dengan timbangan Tera Metrologi.')
on conflict (id) do nothing;

-- 7. Batch Demo Selama ~60 Hari (September - Oktober 2026) dengan Kasus R1 & R2
insert into public.batches (
  id, facility_id, code, source_type, source_name,
  weight_in_total_kg, received_at, status, remaining_stock_kg, closed_at,
  officer_id, e_kg, e_rel, balance_status, needs_review, version
) values
-- Kasus Normal Lolos
('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000011', 'B-7A2X', 'Permukiman', 'RW 04 Kel. Padangsari', 240.0, '2026-10-28 07:15:00+07', 'ditutup', 10.0, '2026-10-28 14:30:00+07', '00000000-0000-0000-0000-000000000041', 8.5, 0.0354, 'lolos', false, 1),
('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000011', 'B-8K9M', 'Pasar', 'Pasar Rasamala Banyumanik', 310.0, '2026-10-29 06:45:00+07', 'ditutup', 12.0, '2026-10-29 15:00:00+07', '00000000-0000-0000-0000-000000000041', 14.0, 0.0452, 'lolos', false, 1),
-- Kasus R1: Penutupan Outlier (e_rel tinggi karena air susut cepat)
('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000011', 'B-3P4Q', 'Permukiman', 'RW 02 Kel. Banyumanik', 180.0, '2026-10-30 07:30:00+07', 'ditutup', 5.0, '2026-10-30 13:45:00+07', '00000000-0000-0000-0000-000000000041', 16.5, 0.0917, 'ditandai', true, 1),
-- Kasus R2: Neraca Negatif (Massa keluar > Masuk di luar toleransi)
('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000011', 'B-2N8Y', 'Permukiman', 'RW 06 Kel. Pudakpayung', 200.0, '2026-10-31 08:00:00+07', 'ditutup', 0.0, '2026-10-31 14:00:00+07', '00000000-0000-0000-0000-000000000041', -16.0, -0.0800, 'ditandai', true, 1),
-- Kasus R6: Data Belum Lengkap (Masih Dipilah)
('00000000-0000-0000-0000-000000000065', '00000000-0000-0000-0000-000000000011', 'B-4W2N', 'Permukiman', 'RW 07 Kel. Padangsari', 195.0, '2026-11-02 07:40:00+07', 'dipilah', null, null, '00000000-0000-0000-0000-000000000041', null, null, 'belum_dievaluasi', false, 1)
on conflict (id) do nothing;

-- Item Pemilahan Batch Demo
insert into public.batch_items (id, facility_id, batch_id, category_id, weight_sorted_kg) values
('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000102', 42.0),
('00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000103', 28.5),
('00000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000104', 8.0),
('00000000-0000-0000-0000-000000000074', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000101', 95.0),
('00000000-0000-0000-0000-000000000075', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000106', 48.0)
on conflict (id) do nothing;

-- 8. Pengiriman Demo (Shipments & Confirmations) dengan Kasus R3 & R4
insert into public.shipments (
  id, facility_id, partner_id, purpose, shipped_at, officer_id, status, needs_review
) values
-- Pengiriman Sukses Terverifikasi (Selisih 1.6% <= tau_d 5%)
('00000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'daur_ulang', '2026-10-28 16:00:00+07', '00000000-0000-0000-0000-000000000041', 'dikonfirmasi', false),
-- Kasus R3: Selisih Berat > 5% (Kirim 69.0 vs Terima 64.0 = 7.24%)
('00000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'daur_ulang', '2026-10-30 15:00:00+07', '00000000-0000-0000-0000-000000000041', 'dikonfirmasi', true),
-- Kasus R4: Belum Dikonfirmasi Lewat Batas Waktu 72 Jam
('00000000-0000-0000-0000-000000000083', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000021', 'daur_ulang', '2026-10-24 10:00:00+07', '00000000-0000-0000-0000-000000000041', 'kedaluwarsa', true)
on conflict (id) do nothing;

insert into public.confirmations (id, facility_id, shipment_id, weight_received_kg, status, method, note, confirmed_at) values
('00000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000081', 77.2, 'diterima', 'token_link', 'Diterima dalam kondisi terikat rapi.', '2026-10-28 17:15:00+07'),
('00000000-0000-0000-0000-000000000092', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000082', 64.0, 'diterima', 'token_link', 'Plastik basah dan kotor berpasir setelah hujan.', '2026-10-30 16:45:00+07')
on conflict (id) do nothing;

-- 9. Anomali Demo Terdaftar (R1, R2, R3, R4)
insert into public.anomalies (
  id, facility_id, batch_id, shipment_id, rule_code, severity, score, measured, threshold,
  reason_text, engine_version, status, cause, review_note, reviewed_by, reviewed_at
) values
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000063', null, 'R1', 'tinggi', 3.82, 0.0917, 3.50,
 'Selisih penutupan batch 9,2% (16,5 kg dari 180,0 kg) berada di luar rentang wajar untuk kategori dominan Plastik (skor z 3,82, batas 3,50). Ambang v1, beku.', '1.0.0',
 'dijelaskan', 'kadar_air', 'Sampah basah kuyup akibat hujan deras saat pengangkutan pagi. Terjadi penguapan kadar air signifikan.', '00000000-0000-0000-0000-000000000043', '2026-10-31 09:00:00+07'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000011', null, '00000000-0000-0000-0000-000000000082', 'R3', 'tinggi', 0.0724, 0.0724, 0.05,
 'Berat kirim 69,0 kg berbeda 7,2% dari berat terima 64,0 kg. Batas toleransi selisih 5,0%.', '1.0.0',
 'open', null, null, null, null)
on conflict (id) do nothing;

-- 10. Laporan Periode Resmi Tertutup Demo (Dapat Dibaca Publik /verifikasi)
insert into public.period_reports (
  id, facility_id, period_start, period_end, status,
  total_in_kg, verified_kg, verified_p_kg,
  rr, vrr, vrr_p, gap,
  coverage, blockers, threshold_set_id, engine_version, snapshot_hash,
  closed_by, closed_at
) values
('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000011', '2026-10-01', '2026-10-31', 'closed',
 5240.0, 1385.0, 1540.0, 0.3282, 0.2643, 0.2939, 0.0639,
 '{"batchesClosed": 26, "totalBatches": 26, "traceablePct": 1.0, "shipmentsConfirmedPct": 0.94}'::jsonb,
 '{"openAnomalies": 0, "unclosedBatches": 0, "unconfirmedShipments": 0}'::jsonb,
 '00000000-0000-0000-0000-000000000051', '1.0.0',
 '9f83a4b2c1d0e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
 '00000000-0000-0000-0000-000000000043', '2026-11-01 10:00:00+07'),
('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000012', '2026-10-01', '2026-10-31', 'closed',
 4850.0, 1420.0, 1420.0, 0.3051, 0.2928, 0.2928, 0.0123,
 '{"batchesClosed": 24, "totalBatches": 24, "traceablePct": 1.0, "shipmentsConfirmedPct": 1.0}'::jsonb,
 '{"openAnomalies": 0, "unclosedBatches": 0, "unconfirmedShipments": 0}'::jsonb,
 null, '1.0.0',
 '3a1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
 '00000000-0000-0000-0000-000000000042', '2026-11-01 11:00:00+07'),
('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000013', '2026-10-01', '2026-10-31', 'closed',
 6100.0, 1050.0, 1120.0, 0.3098, 0.1721, 0.1836, 0.1377,
 '{"batchesClosed": 28, "totalBatches": 30, "traceablePct": 0.88, "shipmentsConfirmedPct": 0.65}'::jsonb,
 '{"openAnomalies": 2, "unclosedBatches": 2, "unconfirmedShipments": 1}'::jsonb,
 null, '1.0.0',
 '7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d',
 '00000000-0000-0000-0000-000000000045', '2026-11-01 12:00:00+07')
on conflict (facility_id, period_start, period_end) do nothing;
