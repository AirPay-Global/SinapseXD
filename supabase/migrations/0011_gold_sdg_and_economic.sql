-- Gold: latest reading per country/indicator for SDG and economic data.
-- Both Silver tables (sdg_indicators, economic_indicators) already exist
-- from 0001 and are loosely ontology-keyed (country = ISO3 text, matching
-- ont_country.id, but not FK-enforced — both pillars' source APIs cover
-- more countries than our pilot registry, so a hard FK would reject valid
-- non-pilot rows instead of just not joining them).

create view gold_sdg_latest
with (security_invoker = true) as
select distinct on (country, indicator_code)
  country, goal, indicator_code, value, target, year, source
from sdg_indicators
where goal in (8, 9, 10, 17)
order by country, indicator_code, year desc;

create view gold_economic_latest
with (security_invoker = true) as
select distinct on (country, indicator)
  country, indicator, value, unit, year, source
from economic_indicators
order by country, indicator, year desc;
