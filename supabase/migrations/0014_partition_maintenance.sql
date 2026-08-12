-- Partition maintenance (code review finding: time-series ingestion has a
-- fixed expiration date). 0001 seeded monthly partitions for
-- vessel_positions/freight_rates/marine_conditions through October 2026 and
-- 0003 seeded yearly partitions for port_activity_daily through 2027, both
-- with a comment promising "a cron creates them forward" — no such cron
-- existed anywhere in the repo. Past those dates, every insert into an
-- unpartitioned range fails outright ("no partition found for row"), and
-- (pre-migration-0013-consumer-fix) that failure would have permanently
-- dropped the record rather than retrying it.
--
-- Two independent safety nets, deliberately both:
--   1. ensure_future_partitions() — idempotent, checked-in, callable by hand
--      or by a scheduler — creates partitions far enough ahead that the
--      schedule alone should never actually matter.
--   2. A DEFAULT partition on every one of these tables — Postgres's own
--      catch-all for rows that don't match any explicit range. If the
--      schedule is ever late or misconfigured, inserts degrade to "landed
--      in the default partition" (monitorable, queryable, fixable) instead
--      of "insert failed, job dead-lettered".

create or replace function ensure_future_partitions(months_ahead int default 6, years_ahead int default 3)
returns void
language plpgsql
as $$
declare
  t text;
  m date;
  y int;
  part_name text;
  exists_already boolean;
begin
  -- Monthly-partitioned tables.
  foreach t in array array['vessel_positions', 'freight_rates', 'marine_conditions'] loop
    for i in 0..months_ahead loop
      m := date_trunc('month', now()) + (i || ' month')::interval;
      part_name := format('%s_%s', t, to_char(m, 'YYYYMM'));
      select exists (
        select 1 from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relname = part_name and n.nspname = 'public'
      ) into exists_already;
      if not exists_already then
        -- A per-partition exception guard, not a bare EXECUTE: if rows have
        -- already landed in the DEFAULT partition for this exact range (the
        -- safety net caught something before this ran), Postgres refuses to
        -- attach a new overlapping partition until those rows are moved out
        -- by hand. One such conflict must not abort every other partition
        -- this call would otherwise create.
        begin
          execute format(
            'create table %I partition of %I for values from (%L) to (%L)',
            part_name, t, m, m + interval '1 month'
          );
          raise notice 'created partition %', part_name;
        exception when others then
          raise warning 'could not create partition % (%) — likely conflicting rows in %_default; move them out and retry', part_name, sqlerrm, t;
        end;
      end if;
    end loop;
  end loop;

  -- Yearly-partitioned tables.
  for i in 0..years_ahead loop
    y := extract(year from now())::int + i;
    part_name := format('port_activity_daily_%s', y);
    select exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relname = part_name and n.nspname = 'public'
    ) into exists_already;
    if not exists_already then
      begin
        execute format(
          'create table %I partition of port_activity_daily for values from (%L) to (%L)',
          part_name, format('%s-01-01', y), format('%s-01-01', y + 1)
        );
        raise notice 'created partition %', part_name;
      exception when others then
        raise warning 'could not create partition % (%) — likely conflicting rows in port_activity_daily_default; move them out and retry', part_name, sqlerrm;
      end;
    end if;
  end loop;
end;
$$;

comment on function ensure_future_partitions is
  'Idempotent — safe to call repeatedly (on a schedule or by hand). Creates any monthly/yearly partition that does not yet exist, months_ahead/years_ahead into the future. See migration 0014 for why this exists: two prior migrations promised a cron that was never built.';

-- Run it now so partitions extend immediately from whenever this migration
-- is applied, not just from the next scheduled run.
select ensure_future_partitions();

-- Schedule it monthly via pg_cron when the extension is available (Supabase
-- projects have it; a bare Postgres in CI/tests may not). Never let a
-- missing extension fail this migration — the DEFAULT partitions below are
-- the safety net either way.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'ensure-future-partitions',
    '0 3 1 * *',  -- 03:00 UTC on the 1st of every month
    $cron$select ensure_future_partitions()$cron$
  );
exception when others then
  raise notice 'pg_cron unavailable or scheduling failed (%). ensure_future_partitions() must be scheduled another way (Render cron, Supabase dashboard) or called manually.', sqlerrm;
end $$;

-- DEFAULT partitions: Postgres routes any row outside every explicit range
-- into this one instead of rejecting the insert. This is the belt-and-
-- suspenders half of the fix — it must never be relied on as the primary
-- mechanism (a default partition isn't indexed/pruned the way a dated one
-- is), only as protection against a missed maintenance cycle.
do $$
declare
  t text;
begin
  foreach t in array array['vessel_positions', 'freight_rates', 'marine_conditions', 'port_activity_daily'] loop
    execute format('create table if not exists %I_default partition of %I default', t, t);
  end loop;
end $$;

-- Make a row landing in a default partition easy to spot rather than a
-- silent surprise months from now.
comment on table vessel_positions_default is 'Safety-net partition — rows here mean ensure_future_partitions() fell behind. Investigate and re-run it.';
comment on table freight_rates_default is 'Safety-net partition — rows here mean ensure_future_partitions() fell behind. Investigate and re-run it.';
comment on table marine_conditions_default is 'Safety-net partition — rows here mean ensure_future_partitions() fell behind. Investigate and re-run it.';
comment on table port_activity_daily_default is 'Safety-net partition — rows here mean ensure_future_partitions() fell behind. Investigate and re-run it.';
