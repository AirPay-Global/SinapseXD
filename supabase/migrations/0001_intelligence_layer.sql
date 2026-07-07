-- Sinapse XD — intelligence layer schema (standalone, external pillars only).
-- Sinapse CRM tables are deferred; the pillar/source column keeps ingestion
-- pluggable so CRM can register as a 7th source later without migration churn.

-- ── Multi-tenancy ───────────────────────────────────────
create type org_type as enum ('PORT', 'GOVERNMENT', 'DFI', 'AFCFTA');

create table organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        org_type not null,
  country     text,
  plan        text not null default 'trial',
  created_at  timestamptz not null default now()
);

create table users (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id),
  clerk_id    text unique not null,
  role        text not null default 'viewer',
  permissions jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ── Reference data ──────────────────────────────────────
create table ports (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text not null,
  coordinates point,
  unlocode    text unique
);

create table corridors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  countries      text[] not null,
  start_port_id  uuid references ports(id),
  end_port_id    uuid references ports(id),
  distance_km    numeric
);

-- ── Time-series (partitioned by month) ──────────────────
create table vessel_positions (
  imo        text not null,
  ts         timestamptz not null,
  lat        double precision not null,
  lng        double precision not null,
  speed_kn   numeric,
  heading    smallint,
  status     text,
  source     text not null default 'ais',  -- pillar/source tag (pluggable)
  primary key (imo, ts)
) partition by range (ts);

create table freight_rates (
  route        text not null,
  ts           timestamptz not null,
  rate_usd     numeric not null,
  index_source text not null,
  primary key (route, ts, index_source)
) partition by range (ts);

create table marine_conditions (
  port_id         uuid not null references ports(id),
  ts              timestamptz not null,
  wave_height_m   numeric,
  wind_speed_kn   numeric,
  disruption_risk text,
  source          text not null default 'weather',
  primary key (port_id, ts)
) partition by range (ts);

-- Initial monthly partitions (July–October 2026); a cron creates them forward
do $$
declare
  t text;
  m date;
begin
  foreach t in array array['vessel_positions', 'freight_rates', 'marine_conditions'] loop
    for i in 0..3 loop
      m := date_trunc('month', date '2026-07-01') + (i || ' month')::interval;
      execute format(
        'create table %I_%s partition of %I for values from (%L) to (%L)',
        t, to_char(m, 'YYYYMM'), t, m, m + interval '1 month'
      );
    end loop;
  end loop;
end $$;

-- ── Aggregates & intelligence ───────────────────────────
create table corridor_metrics (
  id               uuid primary key default gen_random_uuid(),
  corridor_id      uuid not null references corridors(id),
  period           date not null,
  throughput_teu   integer,
  avg_transit_days numeric,
  trade_value_usd  numeric,
  unique (corridor_id, period)
);

create table sdg_indicators (
  id             uuid primary key default gen_random_uuid(),
  country        text not null,
  goal           smallint not null check (goal in (8, 9, 10, 17)),
  indicator_code text not null,
  value          numeric not null,
  target         numeric,
  year           smallint not null,
  source         text not null,
  unique (country, indicator_code, year)
);

create table economic_indicators (
  id        uuid primary key default gen_random_uuid(),
  country   text not null,
  indicator text not null,
  value     numeric not null,
  unit      text,
  year      smallint not null,
  source    text not null,
  unique (country, indicator, year, source)
);

create table ai_briefings (
  id           uuid primary key default gen_random_uuid(),
  corridor_id  uuid references corridors(id),
  generated_at timestamptz not null default now(),
  model        text not null,
  content      text not null,
  tokens_used  integer
);

-- ── Reporting & API product ─────────────────────────────
create table aprm_reports (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id),
  period       text not null,
  status       text not null default 'draft',
  content_json jsonb,
  generated_at timestamptz not null default now()
);

create table api_keys (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  key_hash   text unique not null,
  name       text not null,
  rate_limit integer not null default 1000,
  last_used  timestamptz
);

-- ── Row Level Security ──────────────────────────────────
-- Tenant-scoped tables: rows visible only inside the caller's org.
-- Shared intelligence tables (positions, rates, indicators, corridors) are
-- readable by any authenticated member — they hold aggregated external data,
-- not raw tenant data. Writes come only through the service role (pipeline).
alter table organisations       enable row level security;
alter table users               enable row level security;
alter table aprm_reports        enable row level security;
alter table api_keys            enable row level security;
alter table ports               enable row level security;
alter table corridors           enable row level security;
alter table vessel_positions    enable row level security;
alter table freight_rates       enable row level security;
alter table marine_conditions   enable row level security;
alter table corridor_metrics    enable row level security;
alter table sdg_indicators      enable row level security;
alter table economic_indicators enable row level security;
alter table ai_briefings        enable row level security;

create or replace function current_org_id() returns uuid
language sql stable as $$
  select org_id from users where clerk_id = auth.jwt() ->> 'sub'
$$;

create policy org_isolation_orgs on organisations
  for select using (id = current_org_id());
create policy org_isolation_users on users
  for select using (org_id = current_org_id());
create policy org_isolation_reports on aprm_reports
  for all using (org_id = current_org_id());
create policy org_isolation_keys on api_keys
  for all using (org_id = current_org_id());

create policy shared_read_ports on ports for select using (auth.role() = 'authenticated');
create policy shared_read_corridors on corridors for select using (auth.role() = 'authenticated');
create policy shared_read_positions on vessel_positions for select using (auth.role() = 'authenticated');
create policy shared_read_rates on freight_rates for select using (auth.role() = 'authenticated');
create policy shared_read_weather on marine_conditions for select using (auth.role() = 'authenticated');
create policy shared_read_metrics on corridor_metrics for select using (auth.role() = 'authenticated');
create policy shared_read_sdg on sdg_indicators for select using (auth.role() = 'authenticated');
create policy shared_read_econ on economic_indicators for select using (auth.role() = 'authenticated');
create policy shared_read_briefings on ai_briefings for select using (auth.role() = 'authenticated');
