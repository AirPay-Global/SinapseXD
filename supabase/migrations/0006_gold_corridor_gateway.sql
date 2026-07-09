-- Gold: corridor gateway activity (Master Build Plan v2 §0.3).
-- Composes on gold_port_activity_30d: attributes each corridor's coastal
-- gateway (origin) port's real 30-day PortWatch activity to the corridor.
--
-- Honest scope: this is the GATEWAY PORT's throughput, not true end-to-end
-- corridor flow (a port serves multiple corridors + domestic traffic). The
-- dashboards label it as gateway throughput, not corridor trade value.

create view gold_corridor_gateway_activity
with (security_invoker = true) as
select
  c.id                                         as corridor_id,
  c.name                                       as corridor_name,
  c.origin_port_id,
  a.port_name                                  as gateway_port,
  c.country_iso3s,
  a.port_calls_30d,
  (a.import_tons_30d + a.export_tons_30d)::numeric as throughput_tons_30d,
  a.as_of
from ont_corridor c
join gold_port_activity_30d a on a.canonical_port_id = c.origin_port_id;
