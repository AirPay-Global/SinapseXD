# Sinapse XD

**Trade Intelligence Platform for African Ports & AfCFTA Institutions**
Built by AirPay Global Inc. — [airpayglobal.com](https://airpayglobal.com)

Sinapse XD is a federated trade intelligence platform that aggregates six external data pillars plus a proprietary port operational data node (**Sinapse CRM**) into a single decision-ready intelligence layer for port authorities, governments, DFIs, and AfCFTA/APRM institutions.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — full platform architecture, tech stack, module specs, schema, and build priorities
- [`API_REGISTRATIONS.md`](./API_REGISTRATIONS.md) — tiered list of external API registrations required per phase
- [`.env.example`](./.env.example) — environment variable template (copy to `.env.local`; never commit secrets)

## Stack

Next.js 14 + TypeScript · Fastify · Python pipeline workers (BullMQ) · Supabase (PostgreSQL) · Upstash Redis · Clerk · Stripe · Mapbox · Anthropic Claude API · Hosted on Render.

## Status

Design & Architecture phase. See **Phase 1 Build Priorities** in `CLAUDE.md` §13.
