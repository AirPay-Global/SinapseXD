# CLAUDE.md — Sinapse XD Platform
**Owner:** AirPay Global Inc.
**Product:** Sinapse XD — Trade Intelligence Platform for African Ports & AfCFTA Institutions
**Status:** Design & Architecture Phase — Investment & Build
**Contact:** Ernest Beukes · ernest@airpayglobal.com · airpayglobal.com

---

## ⚠️ CURRENT BUILD FOCUS (July 2026)

**We are building Sinapse XD ONLY — the standalone intelligence layer, as a big-data dashboard product.**

- Sinapse XD must function **fully independently of Sinapse CRM**. No feature may depend on CRM data being present.
- The platform is driven by the **6 external data pillars** (AIS/vessels, trade analytics, market intel, weather, financial data, SDG reporting), delivered as **role-based dashboards** for ports, governments, DFIs, and AfCFTA/APRM institutions.
- Sinapse CRM is a **future, optional 7th data source**. The CRM ingestion path (`crm_ingestor.py`, `crm.port.events` queue, CRM screens under `/crm`) is **out of scope** for now — keep the ingestion architecture pluggable so CRM can slot in later, but do not build it.
- When CRM data is absent (the default), dashboards render entirely from external pillar data — no empty states caused by missing CRM feeds.

Everything below describes the full long-term platform. Where it conflicts with this focus statement, this focus statement wins.

---

## 1. What We Are Building

Sinapse XD is a federated trade intelligence platform that aggregates six external data streams plus a proprietary port operational data node (Sinapse CRM) into a single decision-ready intelligence layer for:

- **Port authorities** — operational intelligence, vessel scheduling, revenue optimisation
- **Governments** — corridor monitoring, SDG reporting, AfCFTA compliance
- **DFIs & development banks** — investment intelligence, impact measurement
- **AfCFTA & APRM institutions** — continental data platform, monitoring feeds

**Key differentiator:** Sinapse CRM is a purpose-built CRM that sits *inside* the port authority, capturing first-party operational data (vessel scheduling, tariff records, cargo manifests, staffing, maintenance). This owned data feeds directly into Sinapse XD's intelligence layer — a moat no third-party aggregator can replicate.

**Federated by design:** Each port keeps its raw data. Only aggregated intelligence is shared. This is the political architecture that makes 55-country participation viable.

---

## 2. Platform Products

### 2.1 Sinapse CRM (Proprietary Data Node)
Port Authority operational CRM. The entry product — ports adopt CRM, which feeds the intelligence layer.

**Modules:**
- Vessel Scheduling & Berth Management
- Cargo Manifest Management
- Tariff & Fee Records
- Port Staff & Operations Management
- Maintenance Scheduling & Asset Tracking
- Financial Records & Reporting
- Data Export to Sinapse XD Intelligence Layer

### 2.2 Sinapse XD Intelligence Platform
The shared intelligence layer built on top of Sinapse CRM + 6 external data pillars.

**Data Pillars:**
1. AIS & Vessels — real-time positions, ETAs, cargo manifests
2. Trade Analytics — commodity flows, corridor maps, trend forecasting
3. Market Intel — freight rates, pricing benchmarks, tariff monitoring
4. Weather & Climate — sea state, disruption risk, climate patterns
5. Financial Data — port revenue, fees, tariff data, trade finance
6. SDG Reporting — UN standards outputs, APRM monitoring feeds
7. **Sinapse CRM** — proprietary first-party port operational data (OWNED)

**Output Products:**
- Port Operations Dashboard
- Government Policy & Corridor Dashboard
- DFI Investment Intelligence Dashboard
- AfCFTA Trade Monitoring Dashboard
- APRM Reporting Exports (automated)
- Data Intelligence API (for licensing to institutions)

---

## 3. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR, API routes, strong typing |
| UI Components | shadcn/ui + Tailwind CSS | Claude design system base |
| State Management | Zustand + React Query (TanStack) | Server state + client state |
| Backend API | Node.js + Fastify | High-performance REST/WebSocket |
| Data Pipeline | Python + BullMQ workers | Job-queue-based ingestion; Render background workers |
| AI Layer | Anthropic Claude API (claude-sonnet-4-6) | Intelligence, summaries, anomaly detection |
| Primary DB | Supabase (PostgreSQL 15) | Managed Postgres, RLS for multi-tenancy, realtime |
| Time-Series | PostgreSQL partitioned tables + indexes | AIS/price/weather time-series; no TimescaleDB required |
| Cache / Queue | Upstash Redis + BullMQ | Serverless Redis; job queues for pipeline workers |
| File Storage | Supabase Storage | Reports, documents, exports — S3-compatible |
| Realtime | Supabase Realtime | Live vessel positions, dashboard updates |
| Mapping | Mapbox GL JS | Corridor visualisation, vessel tracking |
| Auth | Clerk (multi-tenant) | Port authority + government + DFI orgs |
| Payments | Stripe | SaaS billing, subscription management |
| Email | SendGrid | Transactional + reporting emails |
| Hosting | Render | Web services, background workers, cron jobs |
| CI/CD | Render + GitHub | Auto-deploy on push to main |
| Monitoring | Sentry | Error tracking and performance monitoring |

---

## 4. Project Structure

```
sinapse-xd/
├── apps/
│   ├── web/                        # Next.js 14 frontend
│   │   ├── app/
│   │   │   ├── (auth)/             # Login, register, onboarding
│   │   │   ├── (dashboard)/        # Role-based dashboards
│   │   │   │   ├── port/           # Port operator views
│   │   │   │   ├── government/     # Government/policy views
│   │   │   │   ├── dfi/            # DFI/investor views
│   │   │   │   └── afcfta/         # AfCFTA/APRM views
│   │   │   ├── crm/                # Sinapse CRM module
│   │   │   │   ├── vessels/        # Vessel scheduling & berths
│   │   │   │   ├── cargo/          # Cargo manifests
│   │   │   │   ├── tariffs/        # Tariff & fee management
│   │   │   │   ├── operations/     # Staff & ops
│   │   │   │   └── maintenance/    # Asset & maintenance
│   │   │   └── api/                # Next.js API routes
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui base components
│   │   │   ├── charts/             # Recharts + D3 data viz
│   │   │   ├── maps/               # Mapbox corridor maps
│   │   │   ├── crm/                # CRM-specific components
│   │   │   └── intelligence/       # AI insight components
│   │   ├── lib/
│   │   │   ├── api/                # API client helpers
│   │   │   ├── supabase/           # Supabase client (browser + server)
│   │   │   ├── auth/               # Clerk helpers
│   │   │   └── utils/              # Shared utilities
│   │   └── styles/
│   │       └── globals.css         # Tailwind + CSS variables
│   │
│   └── api/                        # Fastify backend API
│       ├── src/
│       │   ├── routes/             # API route handlers
│       │   ├── services/           # Business logic
│       │   ├── models/             # Database models (Prisma)
│       │   ├── jobs/               # Background jobs
│       │   └── middleware/         # Auth, rate limiting, logging
│       └── prisma/
│           └── schema.prisma
│
├── packages/
│   ├── pipeline/                   # Python data ingestion workers
│   │   ├── ingestors/              # One ingestor per data pillar
│   │   │   ├── ais_ingestor.py
│   │   │   ├── trade_ingestor.py
│   │   │   ├── weather_ingestor.py
│   │   │   ├── financial_ingestor.py
│   │   │   ├── market_ingestor.py
│   │   │   ├── sdg_ingestor.py
│   │   │   └── crm_ingestor.py     # Proprietary CRM → XD feed
│   │   ├── processors/             # Data normalisation & enrichment
│   │   ├── queue/                  # Upstash Redis / BullMQ helpers
│   │   └── intelligence/           # Claude AI analysis calls
│   │
│   ├── shared/                     # Shared TypeScript types & schemas
│   │   ├── types/
│   │   └── schemas/                # Zod validation schemas
│   │
│   └── reporting/                  # SDG/APRM report generation
│       ├── templates/
│       └── generators/
│
├── supabase/
│   ├── migrations/                 # SQL migration files (version-controlled)
│   └── seed.sql                    # Development seed data
│
├── render.yaml                     # Render infrastructure blueprint
├── CLAUDE.md                       # This file
├── API_REGISTRATIONS.md            # API registration list
├── .env.example                    # Environment variable template
└── turbo.json                      # Turborepo monorepo config
```

---

## 5. UI Design System

### 5.1 Design Foundation
We use **shadcn/ui** as the component foundation — the same system powering Claude.ai's interface. It provides unstyled, accessible components that we skin with AirPay Global's brand tokens via Tailwind CSS variables.

**Install shadcn/ui:**
```bash
npx shadcn-ui@latest init
```

### 5.2 Brand Colour Tokens

Add to `apps/web/styles/globals.css`:

```css
:root {
  /* AirPay Global Brand */
  --brand-navy:        #0D2B4E;
  --brand-blue:        #1B6CC8;
  --brand-orange:      #F5A200;
  --brand-light-blue:  #EBF2FC;
  --brand-light-blue2: #F0F7FF;

  /* Semantic tokens (light mode) */
  --background:        #FFFFFF;
  --foreground:        #0D2B4E;
  --card:              #F4F7FB;
  --card-foreground:   #0D2B4E;
  --primary:           #1B6CC8;
  --primary-foreground:#FFFFFF;
  --accent:            #F5A200;
  --accent-foreground: #FFFFFF;
  --muted:             #EBF2FC;
  --muted-foreground:  #64748B;
  --border:            #C5D5E8;
  --ring:              #1B6CC8;
  --radius:            0.625rem;

  /* Status colours */
  --success:           #0D7A4E;
  --warning:           #B45309;
  --destructive:       #DC2626;
  --info:              #0E7490;
}

[data-theme="dark"] {
  --background:        #0A1E36;
  --foreground:        #F8FAFC;
  --card:              #0D2B4E;
  --card-foreground:   #F8FAFC;
  --muted:             #183868;
  --muted-foreground:  #94A3B8;
  --border:            #2D5A8E;
}
```

### 5.3 Typography

```css
/* In globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap');

:root {
  --font-sans:    'Inter', system-ui, sans-serif;
  --font-heading: 'Sora', 'Inter', system-ui, sans-serif;
}
```

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page title | Sora | 2rem (32px) | 700 |
| Section heading | Sora | 1.25rem (20px) | 600 |
| Card title | Inter | 1rem (16px) | 600 |
| Body text | Inter | 0.875rem (14px) | 400 |
| Caption / label | Inter | 0.75rem (12px) | 500 |
| Stat number | Sora | 2.25rem (36px) | 700 |

### 5.4 Key Component Patterns

**KPI Stat Card:**
```tsx
// components/ui/stat-card.tsx
<div className="rounded-xl border bg-card p-6 shadow-sm">
  <p className="text-sm font-medium text-muted-foreground">{label}</p>
  <p className="mt-2 text-4xl font-bold font-heading text-foreground">{value}</p>
  <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
</div>
```

**Data Table:** use `shadcn/ui` Table + TanStack Table for sorting/filtering/pagination.

**Charts:** use `recharts` wrapped in shadcn/ui Card components.

**Map:** Mapbox GL JS inside a `useEffect` — render vessel tracks and trade corridors.

**AI Insight Panel:**
```tsx
<div className="rounded-xl border border-brand-blue/20 bg-brand-light-blue p-4">
  <div className="flex items-center gap-2 mb-2">
    <SparklesIcon className="h-4 w-4 text-brand-blue" />
    <span className="text-xs font-semibold text-brand-blue uppercase tracking-wide">
      Sinapse Intelligence
    </span>
  </div>
  <p className="text-sm text-foreground">{insight}</p>
</div>
```

### 5.5 Layout Structure

```
AppShell
├── Sidebar (collapsible, 240px)
│   ├── Logo (AirPay Global / Sinapse XD)
│   ├── OrgSwitcher (Clerk multi-tenant)
│   ├── Navigation (role-based)
│   └── UserButton (Clerk)
├── TopBar (breadcrumb, notifications, search)
└── Main Content Area
    ├── Page Header (title + actions)
    └── Content Grid
```

---

## 6. Module Specifications

### 6.1 Sinapse CRM — Port Authority Data Node

**Purpose:** Capture first-party port operational data. This is the proprietary data moat.

**Core Entities:**
```
Port → Berths → VesselCalls → CargoManifests
Port → TariffSchedules → InvoiceRecords
Port → Staff → OperationalLogs
Port → Assets → MaintenanceRecords
```

**Key Screens:**
- **Berth Board** — drag-drop vessel scheduling board (similar to a Gantt chart)
- **Vessel Call Detail** — ETA, actual arrival, departure, cargo, fees, documents
- **Cargo Manifest Entry** — commodity type, volume, origin, destination, value
- **Tariff Management** — fee schedules, waivers, invoicing
- **Operations Log** — daily operational events, incidents, notes
- **Maintenance Tracker** — equipment, scheduled maintenance, history
- **CRM → XD Sync** — controls which data is aggregated into Sinapse XD

**Data Flow to Sinapse XD:**
```
Sinapse CRM  →  crm_ingestor.py  →  BullMQ queue: crm.port.events  →  Sinapse XD Intelligence Engine
```

### 6.2 Data Ingestion Pipeline

Each external pillar runs as an independent Python worker (Render background worker or cron service):

```python
# packages/pipeline/ingestors/base_ingestor.py
class BaseIngestor:
    def fetch(self) -> list[dict]      # Pull from external API
    def normalise(self, raw) -> dict   # Map to Sinapse XD schema
    def enqueue(self, data) -> None    # Push job to BullMQ/Upstash queue
    def run(self) -> None              # fetch → normalise → enqueue
```

**BullMQ Queues (Upstash Redis):**

| Queue | Source | Frequency | Render Service Type |
|-------|--------|-----------|---------------------|
| `ais.vessel.positions` | MarineTraffic / Spire | Real-time | Background Worker |
| `trade.corridor.flows` | UN Comtrade / Kpler | Daily | Cron Job |
| `market.freight.rates` | Freightos / Xeneta | 4-hourly | Cron Job |
| `weather.marine.forecast` | StormGlass / NOAA | Hourly | Cron Job |
| `financial.port.data` | IMF / World Bank | Daily | Cron Job |
| `sdg.indicators` | UN SDG API | Weekly | Cron Job |
| `crm.port.events` | Sinapse CRM | Real-time | Background Worker |

### 6.3 Intelligence Engine (Claude AI Layer)

Use Anthropic's Claude API to power:

```python
# packages/pipeline/intelligence/corridor_analyst.py
from anthropic import Anthropic

client = Anthropic()

def analyse_corridor(corridor_data: dict) -> str:
    """Generate natural-language corridor intelligence briefing."""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system="""You are Sinapse XD's corridor intelligence analyst. 
        Analyse African trade corridor data and provide concise, 
        actionable intelligence for port operators and government officials.
        Focus on: anomalies, opportunities, risks, and SDG impact signals.""",
        messages=[{
            "role": "user",
            "content": f"Analyse this corridor data and provide a briefing:\n{corridor_data}"
        }]
    )
    return response.content[0].text
```

**AI Features:**
- Corridor intelligence briefings (natural language)
- Anomaly detection (unusual vessel behaviour, cargo spikes)
- SDG progress narratives for APRM reports
- Port performance benchmarking commentary
- Trade disruption early warnings

### 6.4 Role-Based Dashboards

**Port Operator View (`/dashboard/port`):**
- Berth utilisation index (smart port metric)
- Live vessel tracking map (Mapbox)
- Incoming vessel queue with ETAs
- Revenue vs forecast
- Cargo throughput by commodity
- AI corridor briefing

**Government View (`/dashboard/government`):**
- Intra-AfCFTA trade flow maps
- Corridor performance scorecards
- Trade cost reduction tracking (SDG 10)
- Preferential tariff application data
- APRM export dashboard

**DFI View (`/dashboard/dfi`):**
- SDG 8/9/10/17 indicator dashboards
- Port infrastructure ROI analytics
- Investment impact measurement
- Blended finance opportunity signals
- Automated APRM monitoring reports

**AfCFTA Secretariat View (`/dashboard/afcfta`):**
- Continental trade flow overview (55 member states)
- Digital Trade Protocol compliance tracking
- Rules-of-origin verification data
- Landlocked economy inclusion metrics

### 6.5 Data Intelligence API (Product)

Expose aggregated intelligence as a licensed API for national statistics offices, research bodies, and DFIs:

```
GET  /api/v1/corridors                    → List AfCFTA trade corridors
GET  /api/v1/corridors/:id/intelligence   → AI briefing for corridor
GET  /api/v1/vessels/live                 → Real-time vessel positions
GET  /api/v1/ports/:id/metrics            → Port performance metrics
GET  /api/v1/sdg/indicators               → SDG indicator data
GET  /api/v1/trade/flows                  → Trade flow data
POST /api/v1/reports/aprm                 → Generate APRM report
```

All API routes require bearer token auth. Rate limited by subscription tier.

---

## 7. Database Schema (Core Tables)

All tables live in Supabase (PostgreSQL). Enable Row Level Security (RLS) on every table — each row is scoped to `org_id` so tenants never see each other's data.

```sql
-- Multi-tenancy
organisations     (id, name, type: PORT|GOVERNMENT|DFI|AFCFTA, country, plan)
users             (id, org_id, clerk_id, role, permissions)

-- Sinapse CRM
ports             (id, org_id, name, country, coordinates, iata_code)
berths            (id, port_id, name, max_loa, max_draft, status)
vessel_calls      (id, port_id, berth_id, imo, vessel_name, eta, ata, etd, atd, status)
cargo_manifests   (id, vessel_call_id, commodity, volume, unit, origin, destination, value_usd)
tariff_records    (id, port_id, fee_type, amount, currency, vessel_call_id, invoice_id)
maintenance_jobs  (id, port_id, asset, description, scheduled_date, status, cost)

-- Intelligence Layer
corridors         (id, name, countries[], start_port_id, end_port_id, distance_km)
corridor_metrics  (id, corridor_id, timestamp, throughput_teu, avg_transit_days, trade_value_usd)
vessel_positions  (id, imo, timestamp, lat, lng, speed, heading, status)  -- PARTITION BY RANGE (timestamp)
freight_rates     (id, route, timestamp, rate_usd, index_source)         -- PARTITION BY RANGE (timestamp)
sdg_indicators    (id, country, indicator_code, value, year, source)
ai_briefings      (id, corridor_id, generated_at, model, content, tokens_used)

-- Reporting
aprm_reports      (id, org_id, period, status, content_json, generated_at)
api_keys          (id, org_id, key_hash, name, rate_limit, last_used)
```

---

## 8. Environment Variables

Copy to `.env.local` for development. Never commit secrets. In production, set these in the **Render Environment Group** (`sinapse-xd-env`) — all services inherit from one place.

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# ── Supabase (database + storage + realtime) ──────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Transaction mode (pooled) — for Prisma + serverless API routes
DATABASE_URL=postgresql://postgres.YOURREF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Session mode — for Supabase CLI migrations (not pooled)
DIRECT_URL=postgresql://postgres.YOURREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres

# Supabase Storage buckets
SUPABASE_STORAGE_BUCKET_REPORTS=sinapse-reports
SUPABASE_STORAGE_BUCKET_EXPORTS=sinapse-exports

# ── Upstash Redis (cache + BullMQ job queues) ─────────────
UPSTASH_REDIS_REST_URL=https://your-redis-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# ── Auth (Clerk) ──────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# ── Anthropic (AI Intelligence Layer) ────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Mapping ───────────────────────────────────────────────
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

# ── Payments ──────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── Email ─────────────────────────────────────────────────
SENDGRID_API_KEY=SG....

# ── Monitoring ────────────────────────────────────────────
SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz

# ── AIS Data ──────────────────────────────────────────────
AIS_PROVIDER=aishub
AISHUB_USERNAME=...
MARINETRAFFIC_API_KEY=...
SPIRE_MARITIME_TOKEN=...

# ── Trade Data ────────────────────────────────────────────
UN_COMTRADE_API_KEY=...
KPLER_API_KEY=...

# ── Port Activity (IMF PortWatch — open, no key) ──────────
PORTWATCH_ENABLED=false
PORTWATCH_WHERE=ISO3 IN ('ZAF','KEN','NGA','TGO','DJI','TZA','GHA')
PORTWATCH_FEATURESERVER_URL=

# ── Weather ───────────────────────────────────────────────
STORMGLASS_API_KEY=...
OPENWEATHER_API_KEY=...

# ── Market Intel ──────────────────────────────────────────
FREIGHTOS_API_KEY=...
XENETA_API_KEY=...

# ── Financial ─────────────────────────────────────────────
ALPHA_VANTAGE_API_KEY=...

# ── Feature Flags ─────────────────────────────────────────
ENABLE_AI_BRIEFINGS=true
ENABLE_CRM_SYNC=true
ENABLE_APRM_EXPORTS=true
```

---

## 9. Development Commands

```bash
# Install dependencies (uses pnpm workspaces)
pnpm install

# Start all services locally
pnpm dev

# Start only the web frontend
pnpm dev --filter=web

# Start only the API backend
pnpm dev --filter=api

# Run data pipeline workers (Python)
cd packages/pipeline && python -m uvicorn main:app --reload

# ── Supabase CLI ──────────────────────────────────────────
# Install once: npm install -g supabase
supabase login
supabase init                       # first-time setup

supabase start                      # start local Supabase stack (DB + Auth + Storage)
supabase stop

supabase db push                    # push local schema changes → create migration
supabase db pull                    # pull remote schema to local
supabase migration up               # apply pending migrations

# Generate TypeScript types from Supabase schema
supabase gen types typescript --project-id YOUR_PROJECT_ID \
  > packages/shared/types/supabase.ts

supabase studio                     # open local Supabase Studio UI

# ── Prisma ────────────────────────────────────────────────
# Uses DATABASE_URL (pooled) for queries, DIRECT_URL for migrations
pnpm db:migrate                     # run prisma migrate dev
pnpm db:studio                      # open Prisma Studio

# ── Tests & Quality ───────────────────────────────────────
pnpm test
pnpm lint
pnpm typecheck

# Build for production
pnpm build

# Add shadcn/ui component
npx shadcn-ui@latest add button card table badge
```

---

## 10. Render Deployment Blueprint

`render.yaml` in repo root — Render reads this to provision all services automatically on first deploy.

```yaml
services:
  # ── Next.js web app ────────────────────────────────────
  - type: web
    name: sinapse-xd-web
    runtime: node
    buildCommand: pnpm install && pnpm build --filter=web
    startCommand: pnpm start --filter=web
    envVarGroups:
      - sinapse-xd-env
    autoDeploy: true

  # ── Fastify API ─────────────────────────────────────────
  - type: web
    name: sinapse-xd-api
    runtime: node
    buildCommand: pnpm install && pnpm build --filter=api
    startCommand: pnpm start --filter=api
    envVarGroups:
      - sinapse-xd-env
    autoDeploy: true

  # ── AIS ingestor — real-time background worker ──────────
  - type: worker
    name: sinapse-pipeline-ais
    runtime: python
    buildCommand: pip install -r packages/pipeline/requirements.txt
    startCommand: python packages/pipeline/ingestors/ais_ingestor.py
    envVarGroups:
      - sinapse-xd-env

  # ── CRM sync worker — real-time background worker ───────
  - type: worker
    name: sinapse-pipeline-crm
    runtime: python
    buildCommand: pip install -r packages/pipeline/requirements.txt
    startCommand: python packages/pipeline/ingestors/crm_ingestor.py
    envVarGroups:
      - sinapse-xd-env

  # ── Trade data ingestor — daily cron ────────────────────
  - type: cron
    name: sinapse-cron-trade
    runtime: python
    schedule: "0 6 * * *"
    buildCommand: pip install -r packages/pipeline/requirements.txt
    startCommand: python packages/pipeline/ingestors/trade_ingestor.py
    envVarGroups:
      - sinapse-xd-env

  # ── Weather ingestor — hourly cron ──────────────────────
  - type: cron
    name: sinapse-cron-weather
    runtime: python
    schedule: "0 * * * *"
    buildCommand: pip install -r packages/pipeline/requirements.txt
    startCommand: python packages/pipeline/ingestors/weather_ingestor.py
    envVarGroups:
      - sinapse-xd-env

  # ── Freight rate ingestor — 4-hourly cron ───────────────
  - type: cron
    name: sinapse-cron-freight
    runtime: python
    schedule: "0 */4 * * *"
    buildCommand: pip install -r packages/pipeline/requirements.txt
    startCommand: python packages/pipeline/ingestors/market_ingestor.py
    envVarGroups:
      - sinapse-xd-env

  # ── SDG indicator ingestor — weekly cron ────────────────
  - type: cron
    name: sinapse-cron-sdg
    runtime: python
    schedule: "0 3 * * 1"
    buildCommand: pip install -r packages/pipeline/requirements.txt
    startCommand: python packages/pipeline/ingestors/sdg_ingestor.py
    envVarGroups:
      - sinapse-xd-env
```

> Manage secrets in **Render Dashboard → Environment Groups → `sinapse-xd-env`**. All services inherit from one group — update once, propagates everywhere.

---

## 11. Coding Conventions

### General
- TypeScript strict mode everywhere — no `any`
- Zod for all API input validation
- All database queries via Prisma ORM or `@supabase/supabase-js` — no raw SQL in application code
- All secrets via environment variables — never hardcoded

### Frontend
- Server Components by default; only use `"use client"` when state/effects are needed
- Use `@supabase/ssr` for server-side Supabase access in Next.js App Router (cookies-based auth handoff with Clerk)
- Data fetching in Server Components or via TanStack Query
- Forms: React Hook Form + Zod resolver
- Error boundaries on every route segment
- Loading states on every async operation

### API
- All routes return `{ data, error, meta }` envelope
- HTTP status codes used correctly (200/201/400/401/403/404/422/500)
- Rate limiting on all public-facing API routes
- Request logging with correlation IDs
- Validate all inputs with Zod before touching the database

### Data Pipeline
- Each ingestor is idempotent — safe to re-run
- BullMQ dead-letter queues for failed jobs (`attempts: 3`, `backoff: { type: 'exponential', delay: 5000 }`)
- All errors logged to Sentry with context
- Data normalised to UTC timestamps

---

## 12. Key Constraints (Non-Negotiable)

1. **AirPay Global Inc.** is the operating company — never reference M2M Global Technologies in the platform UI or docs.
2. **Sinapse XD** is the intelligence platform. **Sinapse CRM** is the port operational CRM. They are separate products with a data integration between them.
3. **Federated architecture** — raw port data never leaves the port's control. Only aggregated intelligence flows to the central Sinapse XD layer.
4. **Multi-tenant** — each port authority, government body, and DFI is a separate Clerk organisation. Use Supabase RLS policies keyed on `org_id` for database-level isolation.
5. **SDG alignment** — every feature that touches reporting must map outputs to SDG indicators (8, 9, 10, 17).
6. **AfCFTA Digital Trade Protocol (2024)** — all data formats and API structures must be interoperable-by-design with the Protocol's standards.
7. **Deployment stack: Render + Supabase + Upstash.** Do not introduce AWS, GCP, or Azure dependencies. For data residency, set the Supabase project region to the closest available African region (check https://supabase.com/docs/guides/platform/regions — currently `ap-southeast-1` Singapore is nearest until an Africa region launches; verify at project creation time).
8. **No Wilmington references** in production code, comments, or UI copy.

---

## 13. Phase 1 Build Priorities

Start here. Everything else follows.

**Scope note:** Per the Current Build Focus, Sinapse CRM and the CRM → XD sync are deferred. Phase 1 builds Sinapse XD as a standalone big-data dashboard on external pillar data only.

| Priority | Module | Deliverable |
|----------|--------|-------------|
| P0 | Auth & Orgs | Clerk multi-tenant setup, role-based routing |
| P0 | Supabase Setup | Schema migrations, RLS policies, Realtime enabled on vessel tables |
| P0 | Data Schema | Full Prisma schema, time-series partitioned tables in Supabase |
| P0 | AIS Ingestor | MarineTraffic integration + live vessel map (Mapbox) |
| P1 | Port Dashboard | Vessel traffic, port-call analytics, KPI cards (external data only) |
| P1 | Trade Analytics | UN Comtrade ingestor + corridor flow maps |
| P1 | Weather Ingestor | StormGlass/NOAA marine conditions + disruption signals |
| P2 | AI Briefings | Claude API corridor intelligence integration |
| P2 | Market Intel | Freight rate ingestors + benchmarking views |
| P2 | Financial Data | IMF/World Bank ingestors + economic indicator views |
| P2 | SDG Dashboard | SDG 8/9/10/17 indicator cards |
| P3 | Government View | AfCFTA monitoring, APRM report generation |
| P3 | Data API | Authenticated external API with rate limiting |
| P3 | Billing | Stripe subscriptions per org |
| Deferred | Sinapse CRM | Vessel scheduling board, cargo manifest, tariff entry |
| Deferred | CRM → XD Sync | crm_ingestor.py + BullMQ queue (pluggable 7th pillar) |

---

*Built by AirPay Global Inc. — airpayglobal.com*
