-- 0001_extensions_and_enums.sql
-- Basis: Lampiran A.1 Dokumen Induk SIRKULA

create extension if not exists pgcrypto with schema extensions;
create schema if not exists app;

create type public.user_role as enum ('petugas_tps3r','petugas_angkut','pengelola','dinas','admin');
create type public.facility_type as enum ('tps3r','bank_sampah','pengepul','pengolah','tpa');
create type public.outbound_purpose as enum ('daur_ulang','organik_olah','residu');

-- Fungsi bantu (security definer agar RLS tidak rekursif)
create or replace function app.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function app.my_facility() returns uuid
language sql stable security definer set search_path = public as $$
  select facility_id from profiles where id = auth.uid() and is_active
$$;

create or replace function app.my_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid() and is_active
$$;

create or replace function app.can_read_facility(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    left join facilities fa on fa.id = f
    where p.id = auth.uid() and p.is_active and (
      p.role = 'admin'
      or (p.role in ('petugas_tps3r','petugas_angkut','pengelola') and p.facility_id = f)
      or (p.role = 'dinas' and p.org_id = fa.org_id)
    )
  )
$$;

create or replace function app.can_write_facility(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.is_active
      and p.role in ('petugas_tps3r','petugas_angkut','pengelola')
      and p.facility_id = f
  )
$$;
