-- 0004_row_level_security.sql
-- Basis: Lampiran A.4 Dokumen Induk SIRKULA

do $$
declare t text;
begin
  -- Tabel berfasilitas: aktifkan RLS dan hanya SELECT untuk pengguna terautentikasi
  foreach t in array array['batches','batch_items','onsite_processing','shipments','shipment_lines',
    'confirmations','stock_snapshots','anomalies','reported_figures','period_reports','partners',
    'pilot_baseline','reference_weighings','usage_metrics','hash_anchors','event_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format('create policy %I on public.%I for select to authenticated
                    using (app.can_read_facility(facility_id))', t||'_sel', t);
  end loop;
end $$;

alter table public.organizations enable row level security;
drop policy if exists org_sel on public.organizations;
create policy org_sel on public.organizations for select to authenticated
  using (app.my_role() = 'admin' or id = app.my_org()
         or id = (select org_id from facilities where id = app.my_facility()));

alter table public.facilities enable row level security;
drop policy if exists fac_sel on public.facilities;
create policy fac_sel on public.facilities for select to authenticated
  using (app.can_read_facility(id));
drop policy if exists fac_anon_sel on public.facilities;
create policy fac_anon_sel on public.facilities for select to anon
  using (is_active = true);

-- Public verification policy: anonymous users can only read closed period reports
drop policy if exists period_reports_anon_sel on public.period_reports;
create policy period_reports_anon_sel on public.period_reports for select to anon
  using (status = 'closed');

alter table public.profiles enable row level security;
drop policy if exists prof_sel on public.profiles;
create policy prof_sel on public.profiles for select to authenticated
  using (id = auth.uid() or (facility_id is not null and app.can_read_facility(facility_id))
         or app.my_role() = 'admin');

alter table public.material_categories enable row level security;
drop policy if exists cat_sel on public.material_categories;
create policy cat_sel on public.material_categories for select to authenticated using (true);

alter table public.threshold_sets enable row level security;
drop policy if exists thr_sel on public.threshold_sets;
create policy thr_sel on public.threshold_sets for select to authenticated
  using (facility_id is null or app.can_read_facility(facility_id));

alter table public.sync_ops enable row level security;
drop policy if exists sync_sel on public.sync_ops;
create policy sync_sel on public.sync_ops for select to authenticated using (user_id = auth.uid());

alter table public.sus_responses enable row level security;
drop policy if exists sus_sel on public.sus_responses;
create policy sus_sel on public.sus_responses for select to authenticated
  using (app.my_role() in ('admin','pengelola'));

alter table public.consents enable row level security;
drop policy if exists cons_sel on public.consents;
create policy cons_sel on public.consents for select to authenticated using (user_id = auth.uid());

alter table public.feature_flags enable row level security;
drop policy if exists ff_sel on public.feature_flags;
create policy ff_sel on public.feature_flags for select to authenticated using (true);

alter table public.confirmation_tokens enable row level security;   -- tanpa kebijakan = hanya service role

-- Storage (bucket privat 'evidence'; jalur: <facility_id>/<yyyy>/<mm>/<uuid>.jpg)
-- Jalankan bila bucket storage ada di supabase
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    drop policy if exists evidence_read on storage.objects;
    create policy evidence_read on storage.objects for select to authenticated
      using (bucket_id = 'evidence' and app.can_read_facility(((storage.foldername(name))[1])::uuid));

    drop policy if exists evidence_insert on storage.objects;
    create policy evidence_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'evidence' and app.can_write_facility(((storage.foldername(name))[1])::uuid));
  end if;
end $$;
