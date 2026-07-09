-- Bronze lineage catalog (Master Build Plan v2 §0.3 / Principle #7).
-- One row per raw object landed in Bronze (Supabase Storage). A Silver/Gold
-- value's lineage_ref resolves here to a checksummed, catalogued raw object.

create table bronze_objects (
  ref         text primary key,           -- storage key = the lineageRef
  pillar      text not null,              -- 'ais' | 'trade' | 'weather' | ...
  source      text not null,              -- provider, e.g. 'portwatch'
  row_count   integer not null,
  sha256      text not null,
  size_bytes  bigint not null,
  landed_at   timestamptz not null,
  created_at  timestamptz not null default now()
);

create index bronze_objects_pillar on bronze_objects (pillar, source, landed_at);

alter table bronze_objects enable row level security;
create policy shared_read_bronze_objects on bronze_objects
  for select using (auth.role() = 'authenticated');
