-- Sinapse ontology core (Master Build Plan v2 §0, Principle #1: ontology-first).
--
-- Canonical objects with stable, meaningful keys (ISO3 countries, port slugs)
-- plus a crosswalk that resolves each data product's native identifier to a
-- canonical object. This is the cross-reference spine: every pillar joins
-- through these keys instead of ad-hoc matching. Additive to 0001 — the
-- Silver time-series tables reference these canonical ids going forward.

-- ── Countries ───────────────────────────────────────────
create table ont_country (
  id               text primary key,          -- ISO 3166-1 alpha-3
  name             text not null,
  iso2             text not null,
  rec              text,                       -- Regional Economic Community
  is_afcfta_member boolean not null default true
);

-- ── Commodity / vessel-class taxonomy ───────────────────
-- Reconciles PortWatch vessel classes with dashboard commodity buckets.
create table ont_commodity (
  id           text primary key,              -- aligned to vessel class
  label        text not null,
  vessel_class text not null,
  hs_chapter   text
);

-- ── Shipping lines ──────────────────────────────────────
create table ont_shipping_line (
  id      text primary key,
  name    text not null,
  aliases text[] not null default '{}'
);

-- ── Ports ───────────────────────────────────────────────
create table ont_port (
  id            text primary key,             -- canonical slug
  name          text not null,
  country_iso3  text not null references ont_country(id),
  lat           double precision not null,
  lng           double precision not null,
  unlocode      text unique
);

-- ── Corridors ───────────────────────────────────────────
create table ont_corridor (
  id                  text primary key,       -- canonical slug
  name                text not null,
  origin_port_id      text not null references ont_port(id),
  destination_port_id text references ont_port(id),
  destination_name    text,                   -- inland hub when no dest port
  country_iso3s       text[] not null
);

-- ── Source crosswalk ────────────────────────────────────
-- Resolves (source, native_id) → a canonical object. Populated by seeds below
-- and appended by the pipeline resolver as new native ids are observed.
create table ont_source_map (
  source      text not null,                  -- 'portwatch' | 'ais' | ...
  native_id   text not null,                  -- e.g. 'port1411', 'DURBAN'
  object_type text not null,                  -- 'country'|'port'|'corridor'|'commodity'|'shippingLine'
  object_id   text not null,
  primary key (source, native_id, object_type)
);

create index ont_source_map_object on ont_source_map (object_type, object_id);

-- ── Seed: countries (7 pilot + corridor destinations) ───
insert into ont_country (id, name, iso2, rec, is_afcfta_member) values
  ('ZAF', 'South Africa', 'ZA', 'SADC',   true),
  ('KEN', 'Kenya',        'KE', 'EAC',    true),
  ('NGA', 'Nigeria',      'NG', 'ECOWAS', true),
  ('TGO', 'Togo',         'TG', 'ECOWAS', true),
  ('DJI', 'Djibouti',     'DJ', 'COMESA', true),
  ('TZA', 'Tanzania',     'TZ', 'EAC',    true),
  ('GHA', 'Ghana',        'GH', 'ECOWAS', true),
  ('ZMB', 'Zambia',       'ZM', 'SADC',   true),
  ('UGA', 'Uganda',       'UG', 'EAC',    true),
  ('RWA', 'Rwanda',       'RW', 'EAC',    true),
  ('ETH', 'Ethiopia',     'ET', 'COMESA', true),
  ('BFA', 'Burkina Faso', 'BF', 'ECOWAS', true),
  ('MLI', 'Mali',         'ML', 'ECOWAS', true),
  ('NER', 'Niger',        'NE', 'ECOWAS', true);

-- ── Seed: commodity / vessel-class taxonomy ─────────────
insert into ont_commodity (id, label, vessel_class, hs_chapter) values
  ('container',     'Containers',        'container',     null),
  ('dry_bulk',      'Dry bulk',          'dryBulk',       null),
  ('tanker',        'Tankers / liquids', 'tanker',        '27'),
  ('roro',          'Ro-Ro / vehicles',  'roro',          '87'),
  ('general_cargo', 'General cargo',     'generalCargo',  null);

-- ── Seed: ports (7 pilot ports) ─────────────────────────
insert into ont_port (id, name, country_iso3, lat, lng, unlocode) values
  ('durban',   'Durban',         'ZAF', -29.87, 31.03, 'ZADUR'),
  ('mombasa',  'Mombasa',        'KEN',  -4.06, 39.65, 'KEMBA'),
  ('lagos',    'Lagos (Apapa)',  'NGA',   6.44,  3.36, 'NGLOS'),
  ('lome',     'Lomé',           'TGO',   6.13,  1.29, 'TGLFW'),
  ('djibouti', 'Djibouti',       'DJI',  11.60, 43.15, 'DJJIB'),
  ('dar',      'Dar es Salaam',  'TZA',  -6.82, 39.29, 'TZDAR'),
  ('tema',     'Tema',           'GHA',   5.63,  0.01, 'GHTEM');

-- ── Seed: corridors (coastal gateway → inland hub) ──────
insert into ont_corridor (id, name, origin_port_id, destination_port_id, destination_name, country_iso3s) values
  ('durban-lusaka',      'Durban–Lusaka (North-South)', 'durban',   null, 'Lusaka',       array['ZAF','ZMB']),
  ('mombasa-kampala',    'Mombasa–Kampala (Northern)',  'mombasa',  null, 'Kampala',      array['KEN','UGA']),
  ('dar-kigali',         'Dar–Kigali (Central)',        'dar',      null, 'Kigali',       array['TZA','RWA']),
  ('djibouti-addis',     'Djibouti–Addis Ababa',        'djibouti', null, 'Addis Ababa',  array['DJI','ETH']),
  ('lome-ouagadougou',   'Lomé–Ouagadougou',            'lome',     null, 'Ouagadougou',  array['TGO','BFA']),
  ('tema-bamako',        'Tema–Bamako',                 'tema',     null, 'Bamako',       array['GHA','MLI']),
  ('lagos-niamey',       'Lagos–Niamey',                'lagos',    null, 'Niamey',       array['NGA','NER']);

-- ── Seed: crosswalk ─────────────────────────────────────
-- Commodity: PortWatch vessel-class field suffix → canonical commodity.
insert into ont_source_map (source, native_id, object_type, object_id) values
  ('portwatch', 'container',     'commodity', 'container'),
  ('portwatch', 'dry_bulk',      'commodity', 'dry_bulk'),
  ('portwatch', 'tanker',        'commodity', 'tanker'),
  ('portwatch', 'roro',          'commodity', 'roro'),
  ('portwatch', 'general_cargo', 'commodity', 'general_cargo'),
-- AIS free-text destination strings → canonical port (extend as observed).
  ('ais', 'DURBAN',        'port', 'durban'),
  ('ais', 'MOMBASA',       'port', 'mombasa'),
  ('ais', 'LAGOS',         'port', 'lagos'),
  ('ais', 'APAPA',         'port', 'lagos'),
  ('ais', 'LOME',          'port', 'lome'),
  ('ais', 'DJIBOUTI',      'port', 'djibouti'),
  ('ais', 'DAR ES SALAAM', 'port', 'dar'),
  ('ais', 'TEMA',          'port', 'tema');

-- ── Row Level Security ──────────────────────────────────
-- Reference/ontology data is shared: readable by any authenticated member,
-- written only by the pipeline service role.
alter table ont_country       enable row level security;
alter table ont_commodity     enable row level security;
alter table ont_shipping_line enable row level security;
alter table ont_port          enable row level security;
alter table ont_corridor      enable row level security;
alter table ont_source_map    enable row level security;

create policy shared_read_ont_country on ont_country for select using (auth.role() = 'authenticated');
create policy shared_read_ont_commodity on ont_commodity for select using (auth.role() = 'authenticated');
create policy shared_read_ont_shipping_line on ont_shipping_line for select using (auth.role() = 'authenticated');
create policy shared_read_ont_port on ont_port for select using (auth.role() = 'authenticated');
create policy shared_read_ont_corridor on ont_corridor for select using (auth.role() = 'authenticated');
create policy shared_read_ont_source_map on ont_source_map for select using (auth.role() = 'authenticated');
