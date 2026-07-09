# Sinapse XD — Technical Training Manual

**Purpose of this document:** give you (Ernest) a working mental model of how the platform is built, so you can explain it accurately to any audience — engineers, port operators, government officials, DFI analysts, or investors — without needing to read code.

**As of:** 09 July 2026, branch `claude/new-session-j2vwrq`.

---

## 1. What Sinapse XD Is, in One Paragraph

Sinapse XD is a **decision intelligence platform**, not a dashboard product. The distinction matters when you present it: a dashboard shows numbers; Sinapse shows a number, tells you where it came from, how confident you should be in it, and what to do about it. Every value on screen can be clicked to reveal its full lineage — from the raw external feed, through cleaning and cross-referencing, to the pre-aggregated metric on screen. This is deliberately modelled on Palantir Foundry's "ontology + evidence" pattern, adapted to run entirely on Render + Supabase + Upstash (no AWS/GCP/Azure — a hard constraint from the client).

---

## 2. The Five-Layer Architecture

```
Experience      → Role-based dashboards (Port, Government, DFI, AfCFTA) + Decision Centre + Ontology Explorer
Decision Intel  → Recommendation / forecasting / risk scoring     [NOT BUILT — Phase 4-5, deferred]
Ontology        → Countries, Ports, Corridors, Commodities — canonical objects everything else joins through
Data Products   → AIS, Trade, Weather, Financial, Market, SDG (+ deferred CRM)
Lakehouse       → Bronze (raw) → Silver (cleaned, ontology-keyed) → Gold (pre-aggregated marts)
```

**Why this order matters when presenting:** most audiences assume you build top-down (dashboard first). We built bottom-up — lakehouse and ontology first — because a decision platform is only as trustworthy as its lineage. A pretty dashboard on ungoverned data is a liability for a DFI or government client; a plain dashboard on governed, traceable data is fundable.

### 2.1 The Lakehouse in practice

| Zone | What lives here | Where | Analogy |
|---|---|---|---|
| **Bronze** | Raw API responses, exactly as received, checksummed | Supabase Storage (Parquet) | The evidence locker — nothing is ever cleaned or lost |
| **Silver** | Cleaned, deduplicated, resolved to canonical ontology keys | Supabase Postgres tables | The single conformed record per real-world fact |
| **Gold** | Pre-aggregated views/marts, one per KPI | Postgres materialized views | What the dashboard actually queries |

A record's journey: **ingestor fetches raw data → lands in Bronze → normalises → pushes to a queue → a Silver consumer upserts it into a Postgres table, resolving native IDs to canonical ontology keys → a Gold view aggregates it → the dashboard reads the Gold view via the Ontology SDK.**

---

## 3. The Ontology — the Part That Makes This Different From a BI Tool

Everything in Sinapse resolves to one of five canonical object types, defined once in `packages/shared/ontology/manifest.ts` and seeded in `supabase/migrations/0002_ontology_core.sql`:

| Object | Table | Example canonical ID |
|---|---|---|
| Country | `ont_country` | `ZAF`, `KEN`, `NGA` (ISO3) |
| Port | `ont_port` | `durban`, `mombasa`, `lagos` |
| Corridor | `ont_corridor` | `durban-lusaka`, `mombasa-kampala` |
| Commodity | `ont_commodity` | `container`, `tanker`, `dry_bulk` |
| Shipping line | `ont_shipping_line` | (seeded, not yet used by a pillar) |

Every external feed speaks a different dialect for the same real-world thing — PortWatch calls Durban `port1411`, AIS broadcasts the free-text destination `"DURBAN"`, Comtrade uses the numeric M49 code `710`. A **crosswalk table** (`ont_source_map`) plus a Python resolver (`packages/pipeline/ontology/resolver.py`) maps every native ID to the one canonical ID. This is what lets the platform say "here is everything we know about Durban" by joining five different data pillars on one key, instead of five disconnected tables that happen to mention the same port under different names.

**Talking point for technical audiences:** this is the same pattern Palantir Foundry calls an "ontology layer" — objects and links, not tables and joins. We built a lightweight version of it (`apps/web/lib/ontology/sdk.ts`) rather than adopting Foundry itself, because Foundry is a closed enterprise platform and this needs to run on the approved Render/Supabase stack.

**Talking point for non-technical audiences:** "Every port, country, and trade corridor in the system has one true identity. When five different data sources all mention 'Durban,' the platform already knows they're the same port — so an official gets one unified picture instead of five spreadsheets that don't line up."

Currently seeded: **7 pilot ports** (Durban, Mombasa, Lagos, Lomé, Djibouti, Dar es Salaam, Tema), their **14 countries** (7 coastal + 7 corridor-partner inland states), and **7 corridors** connecting them. This is intentionally small — the pilot scope, not the ceiling. Widening it is a seed-data exercise, not a re-architecture.

---

## 4. The Evidence Envelope — How Every Number Proves Itself

This is the platform's signature interaction and the one most worth demoing live. Any KPI card has a small "Explain →" control at the bottom. Clicking it opens a drawer showing:

1. **Bronze** — which raw feed this came from, when, with what source ID
2. **Silver** — how it was cleaned and which ontology key it resolved to
3. **Gold** — which pre-aggregated mart the number was read from
4. A **confidence score** (0–1, shown as a bar, not a red/amber/green traffic light — confidence isn't a status, it's a probability)
5. A **status tag**: `live` (real data, real pipeline), `demo` (illustrative, honestly labelled), or `planned` (feature not built yet)
6. Sometimes a **recommendation** — the "so what do I do" line

The code for this lives in `apps/web/lib/evidence/` (the data model) and `apps/web/components/evidence/` (the drawer UI). `quickEvidence()` in `lib/evidence/build.ts` is the helper that generates a standard 3-stage lineage without hand-authoring it for every single KPI.

**Why this matters commercially:** DFIs and government auditors don't trust black-box dashboards. A number that can prove its own lineage on click is a fundamentally different sales conversation than a number that just sits there. It's also honest marketing — the platform never shows a `demo` number dressed up as `live`, which matters when a DFI's own compliance team eventually audits the data.

Try it yourself: `/evidence` is a dedicated Evidence Centre page that explains the system and lets you click through three live examples (a real KPI, a demo KPI, and a fully planned one) so you can see all three states side by side.

---

## 5. What's Actually Live vs. Demo vs. Planned Today

Be precise about this with any audience — it's the platform's whole credibility model.

| Pillar | Status | Detail |
|---|---|---|
| **AIS & Vessels** | 🟡 Wired, idle by default | Full pipeline built (ingestor → Silver → Gold → dashboard). Needs `AISHUB_USERNAME` (a free reciprocal key — you feed AISHub your own receiver data to get one) to actually produce data. Until then: honest demo fallback. |
| **Port Activity (IMF PortWatch)** | 🟢 Live | No key needed — open IMF dataset. Port calls, throughput by vessel class. This is the platform's most mature live pillar. |
| **Trade Analytics (UN Comtrade)** | 🟡 Wired, idle by default | Needs `UN_COMTRADE_API_KEY` (free, self-serve registration at comtrade.un.org). Bilateral trade value between each corridor's two countries. |
| **Weather & Marine Conditions** | 🟡 Wired, idle by default | Uses Open-Meteo (free, no key needed at all — just needs the worker deployed and running). Wave height, wind speed, a simple disruption-risk flag. |
| **Market Intel (freight rates)** | 🔴 Stub | `fetch()` returns nothing yet. Needs a Freightos/Xeneta integration. |
| **Financial Data** | 🔴 Stub | Needs IMF/World Bank integration. |
| **SDG Reporting** | 🔴 Stub | Needs UN SDG API integration. |
| **Sinapse CRM (7th pillar)** | ⚪ Deliberately deferred | Not in scope per CLAUDE.md — Sinapse XD must work standalone without it. |
| **AI Copilot / Intelligence Centre / Digital Twin** | ⚪ Not built | Marked "soon" in the nav, not hidden — honest about scope. |

**"Wired, idle by default" is a specific and important state to understand**: the code path is complete and tested end-to-end (ingestor → queue → Silver table → Gold mart → dashboard), but the worker has nothing to fetch without a credential. This is different from "not built." Getting AIS, Trade, or Weather showing real numbers in production is a **credential-provisioning task, not an engineering task** at this point — literally: sign up for a free key, paste it into the Render environment group, redeploy.

---

## 6. Repository Tour

```
apps/web/                  Next.js 14 frontend — everything a user sees
  app/
    dashboard/{port,government,dfi,afcfta}/   4 live stakeholder command centres
    decision/                                  Decision Centre (landing page)
    ontology/                                  Ontology Explorer + object profile pages
    stakeholders/                              Index of all 14 stakeholder types
    evidence/                                  Evidence Centre (explains the lineage system)
  components/
    app-shell.tsx           The sidebar/nav/role-switcher shell wrapping every page
    evidence/                Evidence drawer + "Explain" button
    ontology/object-profile.tsx   Shared template for Country/Port/Corridor profile pages
    maps/vessel-map.tsx      Lightweight SVG vessel plot (swaps for Mapbox later)
  lib/
    ontology/sdk.ts          THE key file — typed, server-only reads over the ontology
    evidence/                 Evidence data model + builder
    demo-data.ts              Honest, clearly-fake fallback data

packages/pipeline/          Python data ingestion workers (one per pillar)
  ingestors/
    ais_ingestor.py, trade_ingestor.py, weather_ingestor.py, port_activity_ingestor.py, ...
    providers/                Actual API integrations (aishub.py, portwatch.py, comtrade.py, open_meteo.py)
    base_ingestor.py          fetch() → land in Bronze → normalise() → enqueue()
  consumers/
    silver_consumer.py        Drains queues, dispatches to per-queue handlers
    handlers.py                One idempotent upsert function per data type
  ontology/resolver.py         Native ID → canonical ontology key resolution
  lake/                         Bronze storage + lineage catalog

packages/shared/            TypeScript types shared between pipeline and frontend
  ontology/manifest.ts        The single source of truth for object→table mapping
  types/pillars.ts             VesselPosition, CorridorFlow, etc.

supabase/migrations/         Numbered, sequential SQL — the whole schema history
render.yaml                  Every Render service (web, API, one worker/cron per pillar)
CLAUDE.md                    The project's own constitution — read this first, always
```

**How to read a migration number:** they're applied in order and never edited after merge (only new migrations added). `0001` is the original schema, `0002` added the ontology core, `0003–0006` added Silver/Gold for port activity, `0007–0009` (this week's work) wired AIS, Trade, and Weather. If you ever need to know "what does the database actually look like," reading these files top to bottom in order is faster and more reliable than asking anyone's memory of it.

---

## 7. How Data Actually Moves — Worked Example (AIS)

This is the pattern every pillar follows; AIS is the clearest illustration because it was built most recently and most completely.

1. **`AisIngestor.fetch()`** calls AISHub's API for vessel positions in a bounding box covering the African coastline.
2. **`land_raw()`** writes the raw JSON to Bronze storage (Parquet, checksummed, immutable) and records a lineage entry.
3. **`normalise()`** maps AISHub's field names (`MMSI`, `LATITUDE`, `NAVSTAT`...) to Sinapse's schema (`mmsi`, `lat`, `status`...), including resolving the AIS navigational-status code to a human status like `"underway"` or `"moored"`.
4. **`enqueue()`** pushes each normalised record onto a Redis queue (`ais.vessel.positions`) via Upstash.
5. **`SilverConsumer`** (a separate always-on worker) drains the queue and calls **`handle_vessel_position()`**, which resolves the vessel's stated destination (e.g. `"DURBAN"`) to the canonical port ID (`durban`) via the ontology resolver, then **upserts** into the `vessel_positions` Postgres table. "Upsert" here means idempotent — if the same position report is processed twice (which at-least-once delivery guarantees will sometimes happen), it updates the same row rather than duplicating it.
6. The **Ontology SDK**'s `ports.vesselsNear()` method queries that table for the latest position per vessel destined for a given port, within the last 6 hours.
7. The **Port dashboard** (`app/dashboard/port/page.tsx`) calls that SDK method server-side, and passes the result to the client-rendered map/queue components — falling back to demo data, with an honest `demo` evidence tag, if the live query returns nothing (which is currently the common case, since `AISHUB_USERNAME` isn't provisioned yet).

Every other pillar (Trade, Weather, Port Activity) follows this exact same seven-step shape. Once you understand this one, you understand all of them.

---

## 8. The Frontend, Screen by Screen

| Screen | Route | Audience | What it's for |
|---|---|---|---|
| **Decision Centre** | `/decision` | Everyone, landing page | "Show the decision before the data" — surfaces what needs a decision today, not a wall of charts |
| **Port Authority** | `/dashboard/port` | Port operators | Berth/anchorage pressure, live vessel picture, throughput, port calls |
| **Government & Policy** | `/dashboard/government` | Trade ministries | Corridor performance, trade-cost tracking (SDG 10), APRM-relevant exports |
| **DFI Investment** | `/dashboard/dfi` | Development banks | SDG 8/9/10/17 indicators, infrastructure ROI framing |
| **AfCFTA Monitoring** | `/dashboard/afcfta` | AfCFTA Secretariat | Continental trade flow, Digital Trade Protocol framing |
| **Stakeholders** | `/stakeholders` | Anyone exploring scope | All 14 stakeholder types the platform is designed to eventually serve — 4 live, 10 explicitly marked "Planned" |
| **Ontology Explorer** | `/ontology` | Technical/analyst audiences | Browse the canonical object catalogue directly — Countries, Ports, Corridors |
| **Object profile** | `/ontology/{port,country,corridor}/{id}` | Deep-dive | One page per real-world object: relationships, live metrics, AI summary, timeline |
| **Evidence Centre** | `/evidence` | Auditors, skeptical buyers | Explains and demonstrates the Bronze→Silver→Gold lineage system |

**The role switcher** (top of the sidebar) is a demo convenience — it lets you show a Port CEO's view, then a DFI Executive's view, then an AfCFTA Analyst's view, in one session without logging in as different users. In production this will be replaced by real Clerk-based multi-tenant auth (not yet built), where each organisation only sees its own role.

---

## 9. How to Present This to Different Audiences

**To a port authority CEO:** lead with the Port dashboard live vessel map and berth pressure number, then click "Explain" on one KPI to show it isn't a black box. Emphasize: their data stays theirs (federated architecture — raw data never leaves the port), only aggregated intelligence flows upward.

**To a government/trade ministry official:** lead with the Government dashboard's corridor view and the Stakeholders page (shows the platform's full ambition, not just what's built). Emphasize SDG alignment and AfCFTA Digital Trade Protocol interoperability — this is infrastructure for the 2024 Protocol, not a vendor dashboard.

**To a DFI or investor:** lead with the Evidence Centre. This audience cares most about "can I trust this number for a lending decision," and the lineage system is the direct answer. Be explicit about the live/demo/planned split from §5 — DFIs will find out anyway during diligence, and leading with honesty about scope is more credible than a slick demo that turns out to be entirely staged.

**To an engineer evaluating the build:** walk them through §7 (the AIS worked example) and the ontology resolver. The interesting engineering decision to explain is: everything degrades gracefully. If Supabase is unreachable, every dashboard still renders (with demo data and an honest `down` feed status) instead of 500ing — this was a deliberate resilience pattern applied across the whole SDK (`lib/ontology/sdk.ts` never throws), not an accident.

---

## 10. Environments, Deployment, and Running Locally

- **Hosting:** Render only (constraint — no AWS/GCP/Azure). One web service (Next.js), one API service (currently thin), and one worker or cron job per data pillar — all defined in `render.yaml`.
- **Database:** Supabase Postgres. Schema lives entirely in `supabase/migrations/*.sql`, applied in order.
- **Queues:** Upstash Redis, used as a lightweight BullMQ-style job queue between ingestors and Silver consumers.
- **Secrets:** one Render "Environment Group" (`sinapse-xd-env`) — every service inherits from it, so a key only needs to be set once.

**To add a real data feed today** (e.g. make AIS go live): register for `AISHUB_USERNAME` (free, reciprocal — you feed AISHub your own AIS receiver data), set it in the Render environment group, redeploy the `sinapse-pipeline-ais` worker. No code changes needed — this is exactly what the provider-swap pattern was built for.

**To run and verify locally:**
```bash
pnpm install && pnpm dev --filter=web        # frontend, http://localhost:3000
cd packages/pipeline && pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q                           # pipeline tests (DB-dependent ones skip without TEST_DATABASE_URL)
```

---

## 11. Testing Philosophy

Two tiers, deliberately:

1. **Fast unit tests** (no network, no DB) for every provider's `normalise()` function — these run in milliseconds and catch field-mapping bugs (e.g. "does AISHub's HEADING=511 sentinel correctly fall back to course-over-ground").
2. **Postgres-backed integration tests** for the Silver consumer — these apply real migrations to a real (throwaway) Postgres database and assert that a record lands correctly, resolves its ontology key correctly, and that re-processing the same record is idempotent (doesn't duplicate). These are skipped automatically when `TEST_DATABASE_URL` isn't set, so they never block a quick local run.

Current count: **16 tests, all passing**, covering AIS, PortWatch, UN Comtrade, and Open-Meteo.

---

## 12. What's Next (Recommended Order)

1. **Provision the three free/self-serve credentials** already wired (`AISHUB_USERNAME`, `UN_COMTRADE_API_KEY`, nothing needed for Open-Meteo) — this alone converts three pillars from "wired, idle" to "live" with zero further engineering.
2. **Market Intel (freight rates)** — next stub to wire, same pattern as Trade/Weather.
3. **Financial Data + SDG Reporting** — same pattern, both have free APIs (IMF, World Bank, UN SDG).
4. **AI Briefings** — the Claude API corridor-analyst integration described in CLAUDE.md §6.3. This is where "AI recommends" (Principle #6) starts to become real rather than static copy.
5. **Auth/multi-tenancy (Clerk)** — needed before this can be handed to real, separate port/government/DFI organisations instead of demoed via the role switcher.

---

## Glossary

- **Bronze/Silver/Gold** — lakehouse maturity zones: raw → cleaned & ontology-keyed → pre-aggregated for dashboards.
- **Ontology-first** — data resolves to canonical objects (Country, Port, Corridor...), never to ad-hoc tables.
- **Evidence envelope** — the `{ value, source, asOf, confidence, lineage }` wrapper around every drillable number.
- **Federated** — each port keeps its raw operational data; only aggregated intelligence is shared upward.
- **Crosswalk** — the `ont_source_map` table + resolver functions that map each pillar's native IDs to canonical ontology IDs.
- **Idempotent upsert** — processing the same record twice updates one row rather than creating a duplicate; required because queue delivery is "at-least-once."
- **Gold mart** — a pre-aggregated Postgres view a dashboard reads directly, so no dashboard ever computes an aggregate at request time.
- **Wired, idle** — the full pipeline exists and is tested, but the ingestor has no credential yet, so it produces nothing and dashboards honestly show demo data.
