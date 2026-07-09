-- AIS ingestor Silver wiring: vessel_positions was defined (0001) before any
-- ingestor existed, keyed on IMO — but AIS position reports always carry MMSI
-- and only sometimes carry IMO. Relax the key to MMSI and add the fields the
-- AISHub/Spire-normalised payload actually produces.

alter table vessel_positions drop constraint vessel_positions_pkey;
alter table vessel_positions alter column imo drop not null;
alter table vessel_positions add column if not exists mmsi text not null default '';
alter table vessel_positions add column if not exists name text;
alter table vessel_positions add column if not exists vessel_type text;
alter table vessel_positions add column if not exists destination_port_id text references ont_port(id);
alter table vessel_positions add column if not exists destination_raw text;
alter table vessel_positions add column if not exists eta timestamptz;
alter table vessel_positions add column if not exists lineage_ref text;

-- Propagates to all existing + future partitions of this partitioned parent.
create unique index if not exists vessel_positions_mmsi_ts_idx
  on vessel_positions (mmsi, ts);

comment on column vessel_positions.mmsi is 'Idempotency key (with ts) — AIS MMSI is always present, IMO is not.';
