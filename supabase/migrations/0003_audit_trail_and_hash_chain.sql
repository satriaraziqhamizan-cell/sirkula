-- 0003_audit_trail_and_hash_chain.sql
-- Basis: Lampiran A.3 Dokumen Induk SIRKULA

create table if not exists public.event_log (
  id bigint generated always as identity primary key,
  facility_id uuid not null,
  seq bigint not null,
  entity text not null,
  entity_id text not null,
  action text not null,
  old_value jsonb, new_value jsonb,
  actor_id uuid, actor_role text,
  client_op_id uuid,
  occurred_at timestamptz not null,
  prev_hash text not null,
  hash text not null,
  unique (facility_id, seq)
);

create or replace function app.log_event() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_fac uuid; v_prev_hash text; v_prev_seq bigint;
  v_old jsonb; v_new jsonb; v_action text; v_now timestamptz := clock_timestamp();
  v_actor uuid := auth.uid(); v_payload text; v_op text;
begin
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_new := to_jsonb(new);
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

create or replace function app.block_delete() returns trigger language plpgsql as $$
begin raise exception 'Penghapusan fisik tidak diizinkan (gunakan status void)'; end $$;

create or replace function app.block_mutation() returns trigger language plpgsql as $$
begin raise exception 'event_log bersifat append-only'; end $$;

-- Pasang pada semua tabel yang diaudit
do $$
declare t text;
begin
  foreach t in array array['batches','batch_items','onsite_processing','shipments','shipment_lines',
    'confirmations','anomalies','threshold_sets','reported_figures','period_reports','profiles','partners']
  loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update on public.%1$s
                    for each row execute function app.log_event()', t);
    execute format('drop trigger if exists trg_nodelete_%1$s on public.%1$s', t);
    execute format('create trigger trg_nodelete_%1$s before delete on public.%1$s
                    for each row execute function app.block_delete()', t);
  end loop;
end $$;

drop trigger if exists trg_event_log_immutable on public.event_log;
create trigger trg_event_log_immutable before update or delete on public.event_log
  for each row execute function app.block_mutation();

drop trigger if exists trg_event_log_notruncate on public.event_log;
create trigger trg_event_log_notruncate before truncate on public.event_log
  for each statement execute function app.block_mutation();

revoke all on public.event_log from anon, authenticated;
grant select on public.event_log to authenticated;

-- Ambang beku tidak boleh diubah
create or replace function app.protect_frozen_threshold() returns trigger language plpgsql as $$
begin
  if old.status = 'beku' and (
       new.params is distinct from old.params
    or new.category_stats is distinct from old.category_stats
    or (new.status <> old.status and new.status <> 'pensiun')) then
    raise exception 'Ambang yang sudah dibekukan tidak dapat diubah. Buat versi baru.';
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_threshold on public.threshold_sets;
create trigger trg_protect_threshold before update on public.threshold_sets
  for each row execute function app.protect_frozen_threshold();

-- Verifikasi rantai
create or replace function public.verify_chain(p_facility uuid)
returns table(ok boolean, checked bigint, broken_at bigint)
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_prev text := repeat('0',64); v_expected text; v_n bigint := 0;
begin
  if not app.can_read_facility(p_facility) then raise exception 'akses ditolak'; end if;
  for r in select * from event_log where facility_id = p_facility order by seq loop
    v_n := v_n + 1;
    if r.seq <> v_n or r.prev_hash <> v_prev then
      return query select false, v_n, r.seq; return;
    end if;
    v_expected := encode(digest(convert_to(r.prev_hash || concat_ws('|', r.entity, r.entity_id, r.action,
      coalesce(r.old_value::text,''), coalesce(r.new_value::text,''), coalesce(r.actor_id::text,''),
      to_char(r.occurred_at at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.US')), 'utf8'), 'sha256'), 'hex');
    if v_expected <> r.hash then return query select false, v_n, r.seq; return; end if;
    v_prev := r.hash;
  end loop;
  return query select true, v_n, null::bigint;
end $$;
