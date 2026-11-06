-- 0006_initial_thresholds_seed.sql
-- Basis: Lampiran A.6 Dokumen Induk SIRKULA

insert into public.threshold_sets (facility_id, version, status, provisional, params, note) values
(null, 1, 'draft', true,
 '{"tau_neg":0.02,"tau_d":0.05,"z_cutoff":3.5,"min_n":20,"ack_timeout_hours":72,
   "gap_small":0.05,"coverage_low":0.6,"r7_enabled":false}'::jsonb,
 'NILAI SEMENTARA untuk pengembangan. Wajib diganti dengan hasil kalibrasi data pilot sebelum dibekukan.')
on conflict do nothing;

insert into public.material_categories (code, name, sort_order) values
 ('organik','Organik',1),
 ('plastik','Plastik',2),
 ('kertas','Kertas',3),
 ('logam','Logam',4),
 ('kaca','Kaca',5),
 ('residu','Residu',6)
on conflict (code) do nothing;
