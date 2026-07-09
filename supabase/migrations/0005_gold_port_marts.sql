-- Gold: decision marts for the Port dashboard (Master Build Plan v2 §0.3).
-- Pre-aggregated, ontology-joined reads over the Silver port_activity_daily
-- table. Regular views with security_invoker = true so the querying user's
-- RLS on the base table carries through (Supabase default privileges grant
-- anon/authenticated SELECT on public objects). Only resolved ports appear —
-- the ontology join drops unmapped rows.

-- 30-day rolling activity per port → "Port calls (30 days)" KPI + throughput.
create view gold_port_activity_30d
with (security_invoker = true) as
select
  pad.canonical_port_id,
  p.name           as port_name,
  pad.country_iso3,
  sum(pad.port_calls)::int      as port_calls_30d,
  sum(pad.import_tons)::numeric as import_tons_30d,
  sum(pad.export_tons)::numeric as export_tons_30d,
  max(pad.as_of)                as as_of
from port_activity_daily pad
join ont_port p on p.id = pad.canonical_port_id
where pad.activity_date >= current_date - interval '30 days'
group by pad.canonical_port_id, p.name, pad.country_iso3;

-- Daily port calls per port → the port-call trend chart.
create view gold_port_calls_daily
with (security_invoker = true) as
select
  canonical_port_id,
  activity_date,
  sum(port_calls)::int as port_calls,
  max(as_of)           as as_of
from port_activity_daily
where canonical_port_id is not null
group by canonical_port_id, activity_date;

-- Monthly throughput by vessel class (import + export tons) → the
-- "throughput by commodity" chart, labelled via the ontology commodity taxonomy.
create view gold_port_throughput_monthly
with (security_invoker = true) as
with unified as (
  select canonical_port_id,
         date_trunc('month', activity_date)::date as month,
         key   as vessel_class,
         value::numeric as tons
  from port_activity_daily, jsonb_each_text(import_by_class)
  where canonical_port_id is not null
  union all
  select canonical_port_id,
         date_trunc('month', activity_date)::date,
         key,
         value::numeric
  from port_activity_daily, jsonb_each_text(export_by_class)
  where canonical_port_id is not null
)
select canonical_port_id, month, vessel_class, sum(tons)::numeric as tons
from unified
group by canonical_port_id, month, vessel_class;
