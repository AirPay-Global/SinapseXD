-- ai_briefings (0001) was keyed on the never-seeded uuid `corridors` table —
-- same bug 0007/0009 fixed for vessel_positions/marine_conditions. Re-key on
-- ont_corridor so the AI Briefings feature (Claude corridor analyst) can
-- actually attach a briefing to a real corridor.

alter table ai_briefings drop constraint ai_briefings_corridor_id_fkey;
alter table ai_briefings alter column corridor_id type text using corridor_id::text;
alter table ai_briefings add constraint ai_briefings_corridor_id_fkey
  foreign key (corridor_id) references ont_corridor(id);

-- One cached briefing per corridor per UTC day — regenerating within the
-- same day updates it rather than accumulating duplicates.
alter table ai_briefings add column if not exists briefing_date date not null default current_date;
create unique index if not exists ai_briefings_corridor_date_idx
  on ai_briefings (corridor_id, briefing_date);

comment on column ai_briefings.corridor_id is 'Canonical ont_corridor id, not the unseeded uuid corridors table.';
