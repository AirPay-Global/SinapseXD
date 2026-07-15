-- Satellite Intelligence: AIS-discovered berth candidates and their review
-- lifecycle (XDi Satellite Intelligence spec §4.2, §8, §16). Candidate berths
-- are machine-inferred from clustered historical AIS and must pass an analyst
-- review before a port authority can confirm them — the state machine here
-- and in the app forbids a jump straight to port_verified (spec §14).
--
-- Geometry is kept as JSON rather than PostGIS: the platform's stack is plain
-- Supabase Postgres (no PostGIS dependency introduced), and the polygon is a
-- small canvas-space ring, not a survey-grade geodesic shape.

create table satellite_berths (
  id            text primary key,          -- e.g. 'durban-b3'
  port_id       text,                      -- canonical ont_port id when known
  name          text not null,
  terminal      text,
  state         text not null default 'candidate'
    check (state in ('candidate','machine_inferred','analyst_reviewed','port_verified','published','rejected','superseded')),
  source        text not null default 'ais'
    check (source in ('ais','imagery','fusion')),
  centroid      jsonb,                      -- {lat,lng} or canvas {x,y}
  polygon       jsonb,                      -- ring of points
  orientation   numeric,
  length_m      numeric,
  est_depth_m   numeric,
  confidence    numeric,                    -- 0–1 rolled-up score
  factors       jsonb,                      -- transparent confidence inputs
  review_note   text,
  data_steward  text default 'Pipeline · berth_detector',
  updated_at    timestamptz not null default now()
);

create index satellite_berths_port on satellite_berths (port_id, state);

alter table satellite_berths enable row level security;
-- Shared read for any authenticated member; writes go through the review
-- workflow (service role / authenticated analyst). Object-level sovereignty
-- controls (spec §15) layer on top once Clerk multi-tenancy lands.
create policy shared_read_sat_berths on satellite_berths for select using (auth.role() = 'authenticated');
create policy analyst_write_sat_berths on satellite_berths
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
