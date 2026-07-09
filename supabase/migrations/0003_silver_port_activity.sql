-- Silver: daily port activity (IMF PortWatch). Ontology-keyed conformed layer
-- (Master Build Plan v2 §0.3). The Silver consumer upserts normalised records
-- here idempotently; Gold marts and the Port dashboard read from it.

create table port_activity_daily (
  source              text not null default 'portwatch',
  source_port_id      text not null,                       -- native id, e.g. PortWatch 'port1411'
  canonical_port_id   text references ont_port(id),        -- resolved ontology key (nullable on miss)
  country_iso3        text references ont_country(id),     -- resolved ISO3 (nullable on miss)
  activity_date       date not null,
  port_calls          integer not null default 0,
  port_calls_by_class jsonb   not null default '{}',       -- {container, dryBulk, tanker, roro, generalCargo}
  import_tons         numeric not null default 0,
  import_by_class     jsonb   not null default '{}',
  export_tons         numeric not null default 0,
  export_by_class     jsonb   not null default '{}',
  -- Evidence envelope (Principle #4/#7): provenance travels with the value.
  as_of               timestamptz not null default now(),
  lineage_ref         text,
  primary key (source, source_port_id, activity_date)
) partition by range (activity_date);

-- Yearly partitions; a cron extends the range forward (PortWatch is daily).
do $$
declare y int;
begin
  for y in 2024..2027 loop
    execute format(
      'create table port_activity_daily_%s partition of port_activity_daily for values from (%L) to (%L)',
      y, format('%s-01-01', y), format('%s-01-01', y + 1)
    );
  end loop;
end $$;

create index port_activity_canonical on port_activity_daily (canonical_port_id, activity_date);
create index port_activity_country on port_activity_daily (country_iso3, activity_date);

-- RLS: shared aggregated data — readable by any authenticated member, written
-- only by the pipeline service role.
alter table port_activity_daily enable row level security;
create policy shared_read_port_activity on port_activity_daily
  for select using (auth.role() = 'authenticated');
