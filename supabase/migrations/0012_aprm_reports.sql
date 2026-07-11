-- APRM report generation. aprm_reports (0001) requires a real org_id and
-- Clerk auth/multi-tenancy isn't wired yet (CLAUDE.md Phase 1 item, still
-- open) — seed one placeholder AfCFTA organisation so the feature has
-- something real to attach reports to today. This is exactly the row real
-- AfCFTA-org signup will create later; nothing here needs to change when
-- auth lands, only the seed becomes redundant.

insert into organisations (id, name, type, country, plan)
values ('00000000-0000-0000-0000-00000000afcf', 'AfCFTA Secretariat (Demo)', 'AFCFTA', null, 'trial')
on conflict (id) do nothing;

-- Idempotent regeneration: generating the same period again updates the one
-- row rather than accumulating duplicates (same pattern as ai_briefings'
-- one-per-corridor-per-day cache).
alter table aprm_reports add column if not exists title text;
create unique index if not exists aprm_reports_org_period_idx on aprm_reports (org_id, period);
