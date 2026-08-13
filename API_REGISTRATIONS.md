# API Registrations — Sinapse XD Platform
**Owner:** AirPay Global Inc.
**Last Updated:** July 2026

Register for all APIs below before beginning Phase 1 build. APIs are tiered by build priority.

---

## Tier 1 — Register Immediately (Phase 1 blockers)

These are required to start building. Register for all before writing a single line of data code.

---

### Infrastructure & Platform

| # | Service | Purpose | Register At | Cost |
|---|---------|---------|-------------|------|
| 1 | **Anthropic API** | Claude AI intelligence layer (corridor briefings, anomaly detection, APRM narratives) | https://console.anthropic.com | Pay-per-token. ~$3/M input tokens (Sonnet) |
| 2 | **Clerk** | Multi-tenant authentication (port authorities, governments, DFIs as separate orgs) | https://clerk.com | Free up to 10,000 MAU; then $25/mo+ |
| 3 | **Mapbox** | Vessel tracking map, trade corridor visualisations | https://account.mapbox.com | Free 50,000 map loads/mo; then usage-based |
| 4 | **Stripe** | SaaS subscription billing per organisation | https://dashboard.stripe.com/register | 2.9% + 30¢ per transaction |
| 5 | **SendGrid** | Transactional email (reports, alerts, invoices) | https://signup.sendgrid.com | Free 100 emails/day; Essentials $19.95/mo |
| 6 | **Render** | Hosting — web services, background workers, cron jobs | https://render.com | Free tier available; Team services from $7/mo each |
| 7 | **Supabase** | PostgreSQL database, file storage, realtime subscriptions, RLS multi-tenancy | https://supabase.com | Free (500MB DB); Pro $25/mo (8GB DB, 100GB storage) |
| 8 | **Upstash** | Serverless Redis — caching + BullMQ job queues for pipeline workers | https://upstash.com | Free 10K commands/day; ~$0.2/100K commands beyond that |

---

### AIS & Vessel Tracking (Pillar 1)

| # | Service | Purpose | Register At | Cost |
|---|---------|---------|-------------|------|
| 7 | **MarineTraffic API** ✅ wired (`AIS_PROVIDER=marinetraffic`, `MARINETRAFFIC_API_KEY`) | Real-time vessel positions, ETAs, port calls, cargo info | https://www.marinetraffic.com/en/ais-api-services | Tiered from ~$50/mo. Request commercial plan for African coverage |
| 8 | **Spire Maritime** | High-quality satellite AIS — best coverage for African waters and smaller vessels | https://spire.com/maritime | Enterprise pricing. Request Africa-focused quote |
| 9 | **VesselFinder API** | Supplementary AIS feed, port calls, expected arrivals | https://www.vesselfinder.com/api | From $49/mo |
| 10 | **AISHub** | Free community AIS data — useful for dev/testing | https://www.aishub.net/api | Free (community-based, lower quality) |

> **Note:** Start with MarineTraffic for development. Spire for production — satellite AIS gives significantly better coverage in African coastal waters.

---

### Weather & Marine Conditions (Pillar 4)

| # | Service | Purpose | Register At | Cost |
|---|---------|---------|-------------|------|
| 11 | **StormGlass Marine API** | Wave height, wind speed, sea state, swell — critical for port operations | https://stormglass.io | Free 10 requests/day (dev); from $29/mo (prod) |
| 12 | **OpenWeatherMap** | General weather, precipitation, temperature — for inland corridor disruption | https://openweathermap.org/api | Free 1,000 calls/day; from $40/mo |
| 13 | **NOAA API** | Free US/global weather data — good for Atlantic corridor coverage | https://www.weather.gov/documentation/services-web-api | **Free** |
| 14 | **Copernicus Climate Data Store** | EU-funded global climate data — sea surface temperature, anomalies, long-range forecasts | https://cds.climate.copernicus.eu | **Free** — registration required |

---

## Tier 2 — Register Before Phase 2

Required for trade analytics, market intelligence, and financial data pillars.

---

### Trade Analytics (Pillar 2)

| # | Service | Purpose | Register At | Cost |
|---|---------|---------|-------------|------|
| 15 | **UN Comtrade API** | Official UN trade statistics — imports/exports by country, commodity, partner | https://comtrade.un.org/developers | **Free** — API key registration required |
| 16 | **World Bank Open Data API** | Trade indicators, infrastructure data, economic development stats | https://data.worldbank.org/developers | **Free** |
| 17 | **ITC Trade Map API** | Detailed bilateral trade flows, tariff data, NTM analysis — Africa-specific depth | https://www.trademap.org/ApiIntroduction.aspx | Contact ITC for academic/development pricing |
| 18 | **Kpler AIS API** ✅ wired (`AIS_PROVIDER=kpler`, `KPLER_API_KEY`) | Vessel-level AIS positions — the account's provisioned key covers the AIS product, not the commodity/cargo-tracking product | https://www.kpler.com | Enterprise pricing |
| 20 | **AISStream.io** ✅ wired (`AIS_PROVIDER=aisstream`, `AISSTREAM_API_KEY`) | Free WebSocket AIS vessel positions — BETA, no SLA, models explicitly unstable. Stopgap while a commercial feed is arranged | https://aisstream.io/apikeys | **Free** — sign in via GitHub |
| 19 | **African Development Bank Open Data** | AfDB economic indicators, infrastructure investment data, regional statistics | https://dataportal.afdb.org/api | **Free** — registration required |

---

### Market Intelligence — Freight Rates (Pillar 3)

| # | Service | Purpose | Register At | Cost |
|---|---------|---------|-------------|------|
| 20 | **Freightos Baltic Index (FBX) API** | Container freight rate benchmarks on major African trade lanes | https://fbx.freightos.com/api/ | Free for index data; paid for lane-level detail |
| 21 | **Xeneta API** | Ocean freight rate intelligence — contracted vs spot, benchmarking | https://www.xeneta.com/products/api/ | Enterprise pricing. Request shipping line tier |
| 22 | **Sea-Intelligence** | Schedule reliability data — carrier on-time performance per route | https://www.sea-intelligence.com | Subscription. Contact for API access |
| 23 | **Drewry** | Port tariff benchmarking, container handling cost data | https://www.drewry.co.uk | Subscription. Contact data services team |

---

### Financial Data (Pillar 5)

| # | Service | Purpose | Register At | Cost |
|---|---------|---------|-------------|------|
| 24 | **IMF Data API** | GDP, trade balance, FX reserves, balance of payments — all AfCFTA member states | https://data.imf.org | **Free** |
| 25 | **World Bank Financial API** | Financial inclusion, FDI, remittances, infrastructure investment | https://data.worldbank.org/developers | **Free** |
| 26 | **Alpha Vantage** | Real-time FX rates (ZAR, KES, NGN, ETB, etc.), commodity prices | https://www.alphavantage.co | Free 25 requests/day; $50/mo for higher limits |
| 27 | **Open Exchange Rates** | Currency conversion for multi-currency trade value normalisation | https://openexchangerates.org | Free 1,000 requests/mo; from $12/mo |

---

### SDG & Development Reporting (Pillar 6)

| # | Service | Purpose | Register At | Cost |
|---|---------|---------|-------------|------|
| 28 | **UN SDG API** | Official UN SDG indicator data — all 17 goals, all member states | https://unstats.un.org/sdgs/api | **Free** |
| 29 | **UNDP Human Development API** | HDI, inequality index, gender data — maps to SDG 10 | https://hdr.undp.org/data-center | **Free** — registration required |
| 30 | **WHO Global Health Observatory API** | Health indicators — needed for SDG 3 and diaspora health context | https://www.who.int/data/gho/info/gho-odata-api | **Free** |

---

## Tier 3 — Register Before Phase 3

Required for government/DFI features, APRM integration, and continental scale.

---

### AfCFTA & APRM (Direct Engagement Required)

These are not self-serve APIs — they require formal engagement with the relevant AU institutions.

| # | Organisation | What to Request | Contact |
|---|-------------|-----------------|---------|
| 31 | **AfCFTA Secretariat** | Access to the AfCFTA Digital Trade Protocol data standards and any emerging interoperability APIs. Request to be registered as a Digital Trade Protocol-aligned platform. | https://au-afcfta.org — contact the Digital Trade unit |
| 32 | **APRM Secretariat** | Data feed or API access for APRM monitoring indicators. Pitch Sinapse XD as an automated APRM evidence base. | https://www.aprm-au.org — contact the data & research division |
| 33 | **African Union Statistics (StatAfrica)** | Continental statistical data feeds, harmonised trade standards | https://au.int/en/ti/statistics |
| 34 | **UNCTAD API** | Investment flows, maritime transport data, trade facilitation indicators | https://unctadstat.unctad.org/api | Free |

> **Strategy:** Approach AfCFTA and APRM with the investor deck. The pitch is: Sinapse XD becomes the data infrastructure that makes the 2024 Digital Trade Protocol operational. This is a partnership conversation, not just an API registration.

---

### Port Authority Data Agreements

Each port authority that adopts Sinapse CRM will require a **Data Processing Agreement (DPA)** signed before their operational data flows into Sinapse XD. Engage legal counsel to prepare a standard DPA template covering:
- Data ownership (port retains ownership of raw data)
- Federated aggregation consent (anonymised intelligence only)
- GDPR/African data protection law compliance
- Commercial licensing of aggregated insights

Priority ports for pilot agreements (approach in Phase 2):

| Port | Country | Annual TEU | Why Priority |
|------|---------|-----------|-------------|
| Port of Durban (Transnet) | South Africa | ~2.8M TEU | Largest in Sub-Saharan Africa |
| Port of Mombasa (KPA) | Kenya | ~1.5M TEU | East African gateway |
| Port of Lagos (Apapa) | Nigeria | ~1.2M TEU | West African hub |
| Port of Lomé | Togo | ~1.4M TEU | Fastest-growing, landlocked corridor |
| Port of Djibouti | Djibouti | ~600K TEU | Horn of Africa + landlocked Ethiopia gateway |
| Port of Dar es Salaam (TPA) | Tanzania | ~900K TEU | Central/East Africa corridor |
| Port of Tema | Ghana | ~800K TEU | West Africa, ECOWAS gateway |

---

### Monitoring & DevOps

| # | Service | Purpose | Register At | Cost |
|---|---------|---------|-------------|------|
| 35 | **Sentry** | Error tracking and performance monitoring | https://sentry.io | Free for small teams; from $26/mo |
| 36 | **Datadog** | Infrastructure monitoring, Kafka metrics, API latency | https://www.datadoghq.com | Free 14-day trial; from $15/host/mo |
| 37 | **GitHub** | Source code, CI/CD via GitHub Actions | https://github.com | Free for public/open source; Teams $4/user/mo |
| 38 | **Sentry** | Error tracking and performance monitoring | https://sentry.io | Free for small teams; from $26/mo |
| 39 | **GitHub** | Source code, CI/CD via Render auto-deploy on push | https://github.com | Free for public/open source; Teams $4/user/mo |

---

## Summary — Cost Estimate (MVP Phase)

| Category | Monthly Estimate |
|----------|-----------------|
| Render (web + API + workers) | $50 – $200 |
| Supabase (database + storage) | $25 – $100 |
| Upstash Redis (cache + queues) | $0 – $30 |
| Anthropic API (Claude) | $200 – $800 |
| MarineTraffic / Spire AIS | $300 – $800 |
| StormGlass + OpenWeather | $30 – $100 |
| Kpler (commodity tracking) | $500 – $2,000 |
| Freightos / Xeneta (freight rates) | $200 – $600 |
| Mapbox | $0 – $50 |
| Clerk auth | $25 – $100 |
| Stripe | 2.9% + 30¢ per transaction |
| SendGrid | $20 – $50 |
| Sentry | $0 – $50 |
| **Total MVP monthly** | **~$1,400 – $4,900** |

> Render + Supabase + Upstash replaces AWS at a fraction of the cost at MVP scale, with zero DevOps overhead. Cost drops per-unit as port SaaS revenue scales — at 5 ports on the $120K/year plan, infrastructure costs are <3% of revenue.

---

## Quick Registration Checklist

- [ ] **Render** — create account + connect GitHub repo
- [ ] **Supabase** — create project, set region, enable Realtime on vessel tables
- [ ] **Upstash** — create Redis database (serverless)
- [ ] Anthropic API (claude-sonnet-4-6)
- [ ] Clerk (auth)
- [ ] Mapbox
- [ ] Stripe
- [ ] SendGrid
- [ ] MarineTraffic API
- [ ] Spire Maritime (quote request)
- [ ] StormGlass
- [ ] OpenWeatherMap
- [ ] NOAA (free — just read the docs)
- [ ] Copernicus CDS (free)
- [ ] UN Comtrade (free)
- [ ] World Bank API (free)
- [ ] African Development Bank (free)
- [ ] IMF Data API (free)
- [ ] UN SDG API (free)
- [ ] Alpha Vantage
- [ ] Freightos FBX API
- [ ] Sentry
- [ ] GitHub
- [ ] Contact AfCFTA Secretariat (Digital Trade unit)
- [ ] Contact APRM Secretariat (data division)

---

*AirPay Global Inc. — airpayglobal.com — ernest@airpayglobal.com*
