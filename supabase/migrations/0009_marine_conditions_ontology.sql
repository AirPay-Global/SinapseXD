-- marine_conditions (0001) was keyed on the uuid `ports` table, which is
-- never seeded — the app is ontology-first and reads ont_port everywhere
-- else (see 0007's identical fix for vessel_positions). Re-key on ont_port.

alter table marine_conditions drop constraint marine_conditions_pkey;
alter table marine_conditions alter column port_id drop not null;
alter table marine_conditions add column if not exists ont_port_id text references ont_port(id);

create unique index if not exists marine_conditions_port_ts_idx
  on marine_conditions (ont_port_id, ts);

comment on column marine_conditions.ont_port_id is 'Idempotency key (with ts) — canonical ont_port id, not the unseeded uuid ports table.';
