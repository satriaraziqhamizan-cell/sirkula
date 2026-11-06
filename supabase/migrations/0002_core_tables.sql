-- 0002_core_tables.sql
-- Basis: Lampiran A.2 Dokumen Induk SIRKULA

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_code text,
  org_type text not null check (org_type in ('dinas','kampus','mandiri')),
  created_at timestamptz not null default now()
);

create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  public_alias text,
  facility_type facility_type not null default 'tps3r',
  province text, city text,
  lat numeric(9,6), lng numeric(9,6),
  timezone text not null default 'Asia/Jakarta',
  scale_resolution_kg numeric(6,3) not null default 0.1,
  ack_timeout_hours int not null default 72,
  is_demo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  username text not null unique,
  display_name text not null,                    -- pseudonim, mis. 'Petugas-07'
  role public.user_role not null,
  org_id uuid references organizations(id),
  facility_id uuid references facilities(id),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  check (role in ('dinas','admin') or facility_id is not null)
);

create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_tolerance_pct numeric(5,2),
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),   -- pemilik daftar
  name text not null,
  partner_type text not null check (partner_type in ('pengepul','pengolah','tpa','lainnya')),
  phone text,                                            -- hanya untuk tautan WhatsApp
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.batches (
  id uuid primary key,                                   -- UUID dibuat klien
  facility_id uuid not null references facilities(id),
  code text not null,
  source_type text not null,
  source_name text,
  weight_in_total_kg numeric(12,3) not null check (weight_in_total_kg > 0),   -- M_in
  weigh_photo_path text,
  received_at timestamptz not null,
  status text not null default 'masuk' check (status in ('masuk','dipilah','ditutup','void')),
  remaining_stock_kg numeric(12,3) check (remaining_stock_kg >= 0),           -- ΔS
  closed_at timestamptz,
  void_reason text,
  officer_id uuid not null references profiles(id),
  e_kg numeric(12,3), e_rel numeric(9,6),
  balance_status text not null default 'belum_dievaluasi'
    check (balance_status in ('belum_dievaluasi','lolos','ditandai')),
  needs_review boolean not null default false,
  version int not null default 1,
  client_created_at timestamptz,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, code)
);
create index if not exists idx_batches_facility_received on batches (facility_id, received_at desc);

create table if not exists public.batch_items (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  batch_id uuid not null references batches(id),
  category_id uuid not null references material_categories(id),
  weight_sorted_kg numeric(12,3) not null check (weight_sorted_kg >= 0),
  weight_in_est_kg numeric(12,3),
  unique (batch_id, category_id)
);

create table if not exists public.onsite_processing (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  batch_id uuid not null references batches(id),
  method text not null check (method in ('kompos','maggot','lainnya')),
  weight_kg numeric(12,3) not null check (weight_kg >= 0)
);

create table if not exists public.shipments (
  id uuid primary key,
  facility_id uuid not null references facilities(id),
  partner_id uuid not null references partners(id),
  purpose public.outbound_purpose not null,
  shipped_at timestamptz not null,
  photo_path text,
  officer_id uuid not null references profiles(id),
  status text not null default 'dikirim'
    check (status in ('dikirim','dikonfirmasi','ditolak','kedaluwarsa','void')),
  void_reason text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_shipments_facility_shipped on shipments (facility_id, shipped_at desc);

create table if not exists public.shipment_lines (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  shipment_id uuid not null references shipments(id),
  batch_id uuid not null references batches(id),
  category_id uuid not null references material_categories(id),
  weight_kg numeric(12,3) not null check (weight_kg > 0)
);
create index if not exists idx_shipment_lines_batch on shipment_lines (batch_id);
create index if not exists idx_shipment_lines_shipment on shipment_lines (shipment_id);

create table if not exists public.confirmation_tokens (        -- tanpa kebijakan RLS: hanya service role
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  failed_attempts int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.confirmations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  shipment_id uuid not null unique references shipments(id),
  weight_received_kg numeric(12,3) check (weight_received_kg >= 0),   -- W'_k
  status text not null check (status in ('diterima','ditolak_tidak_sesuai')),
  method text not null default 'token_link',
  photo_path text,
  note text,
  device_info jsonb,                                  -- user agent kasar + hash IP
  confirmed_at timestamptz not null default now()
);

create table if not exists public.stock_snapshots (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  snapshot_date date not null,
  category_id uuid not null references material_categories(id),
  weight_kg numeric(12,3) not null check (weight_kg >= 0),
  unique (facility_id, snapshot_date, category_id)
);

create table if not exists public.threshold_sets (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id),          -- null = global
  version int not null,
  status text not null default 'draft' check (status in ('draft','beku','pensiun')),
  provisional boolean not null default true,
  params jsonb not null,
  category_stats jsonb not null default '{}'::jsonb,   -- {plastik:{n,median,mad,meanAd}, pooled:{...}}
  calibration_from date, calibration_to date,
  frozen_at timestamptz, frozen_by uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists threshold_sets_ver_uq on threshold_sets (coalesce(facility_id::text,'global'), version);

create table if not exists public.anomalies (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  batch_id uuid references batches(id),
  shipment_id uuid references shipments(id),
  target_date date,                                    -- untuk R5
  rule_code text not null check (rule_code in ('R1','R2','R3','R4','R5','R6','R7')),
  severity text not null check (severity in ('tinggi','sedang','rendah','info')),
  score numeric, measured numeric, threshold numeric,
  detail jsonb not null default '{}'::jsonb,
  reason_text text not null,
  threshold_set_id uuid references threshold_sets(id),
  provisional boolean not null default false,
  engine_version text not null,
  status text not null default 'open'
    check (status in ('open','dikoreksi','dijelaskan','tidak_terjelaskan')),
  cause text check (cause in ('salah_timbang','susut_alami','kadar_air','salah_input','kesalahan_alat','lainnya')),
  review_note text,
  reviewed_by uuid references profiles(id), reviewed_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  check (batch_id is not null or shipment_id is not null or target_date is not null)
);
create unique index if not exists anomalies_active_uq on anomalies
  (facility_id, coalesce(batch_id::text, shipment_id::text, target_date::text), rule_code)
  where superseded_at is null;

create table if not exists public.reported_figures (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  period_start date not null, period_end date not null,
  reported_recycled_kg numeric(14,3) not null check (reported_recycled_kg >= 0),
  source_note text,
  unique (facility_id, period_start, period_end)
);

create table if not exists public.period_reports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  period_start date not null, period_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  total_in_kg numeric(14,3), verified_kg numeric(14,3), verified_p_kg numeric(14,3),
  rr numeric(9,6), vrr numeric(9,6), vrr_p numeric(9,6), gap numeric(9,6),
  coverage jsonb, blockers jsonb,
  threshold_set_id uuid references threshold_sets(id),
  engine_version text,
  snapshot_hash text,
  closed_by uuid references profiles(id), closed_at timestamptz,
  unique (facility_id, period_start, period_end)
);

create table if not exists public.hash_anchors (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  seq_upto bigint not null, hash text not null,
  channel text not null, anchored_at timestamptz not null default now()
);

-- Riset dan evaluasi
create table if not exists public.pilot_baseline (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  record_date date not null, category_id uuid references material_categories(id),
  weight_kg numeric(12,3) not null, source text, photo_path text
);

create table if not exists public.reference_weighings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  batch_id uuid references batches(id),
  facility_scale_kg numeric(12,3) not null, reference_scale_kg numeric(12,3) not null,
  weighed_by uuid references profiles(id), weighed_at timestamptz not null default now()
);

create table if not exists public.sus_responses (
  id uuid primary key default gen_random_uuid(),
  participant_code text not null, role text,
  answers int[] not null check (array_length(answers,1) = 10),
  score numeric(5,2) not null, consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_metrics (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  user_id uuid not null references profiles(id),
  action text not null, started_at timestamptz not null, ended_at timestamptz not null,
  taps int, device text
);

create table if not exists public.sync_ops (
  client_op_id uuid primary key,
  user_id uuid not null,
  facility_id uuid,
  device_id text,
  op_type text not null,
  status text not null check (status in ('ok','rejected','conflict')),
  result jsonb,
  received_at timestamptz not null default now()
);

create table if not exists public.consents (
  user_id uuid not null references profiles(id),
  doc_version text not null, accepted_at timestamptz not null default now(),
  primary key (user_id, doc_version)
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  note text
);
