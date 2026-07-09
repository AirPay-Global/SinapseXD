-- Silver: UN Comtrade bilateral trade flows, ontology-keyed on ISO3.
-- Gold: attributes each corridor's coastal-gateway/inland country pair to
-- its most recent bilateral trade value (both directions, latest period).

create table trade_flows (
  reporter_iso3   text not null references ont_country(id),
  partner_iso3    text not null references ont_country(id),
  flow_code       text not null,             -- 'X' export | 'M' import
  cmd_code        text not null default 'TOTAL',
  period          text not null,             -- Comtrade annual period, e.g. '2025'
  trade_value_usd numeric not null default 0,
  net_weight_kg   numeric not null default 0,
  source          text not null default 'comtrade',
  as_of           timestamptz not null default now(),
  lineage_ref     text,
  primary key (reporter_iso3, partner_iso3, flow_code, cmd_code, period, source)
);

create index trade_flows_pair on trade_flows (reporter_iso3, partner_iso3, period);

alter table trade_flows enable row level security;
create policy shared_read_trade_flows on trade_flows for select using (auth.role() = 'authenticated');

-- Honest scope: bilateral country-to-country trade value, not verified
-- physical corridor throughput (no customs/rail data product yet — see
-- CLAUDE.md "deferred data products"). Dashboards label it as such.
create view gold_corridor_trade_flows
with (security_invoker = true) as
select
  c.id                                                as corridor_id,
  c.name                                               as corridor_name,
  c.country_iso3s[1]                                   as gateway_country,
  c.country_iso3s[2]                                   as partner_country,
  max(tf.period)                                       as latest_period,
  sum(tf.trade_value_usd) filter (
    where tf.period = (select max(period) from trade_flows tf2
                        where tf2.reporter_iso3 in (c.country_iso3s[1], c.country_iso3s[2])
                          and tf2.partner_iso3 in (c.country_iso3s[1], c.country_iso3s[2]))
  )                                                     as trade_value_usd_latest,
  max(tf.as_of)                                         as as_of
from ont_corridor c
join trade_flows tf
  on tf.reporter_iso3 in (c.country_iso3s[1], c.country_iso3s[2])
 and tf.partner_iso3  in (c.country_iso3s[1], c.country_iso3s[2])
 and tf.reporter_iso3 <> tf.partner_iso3
group by c.id, c.name, c.country_iso3s;
