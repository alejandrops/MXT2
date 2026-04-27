# ADR-000 — Inaugural Stack

**Status:** Accepted  
**Date:** 2026-04-24  
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator  
**Supersedes:** —  
**Superseded by:** —

## Context

Maxtracker v8.18 is a single-file HTML demo (~2.3 MB, 63 screens, hardcoded
inline data) used for sales and UX validation. Further UX iteration requires
coherent relational data across screens — empty states, pagination, search,
filters, cross-entity references — which hardcoded inline data cannot provide.

The project needs a functional demo with a real data layer that will eventually
become the production codebase. Key constraints from project memory:

- Declared production stack: TypeScript + Next.js + tRPC + Prisma + Supabase
  PostgreSQL + TimescaleDB + Fly.io + Vercel + Auth0.
- Scale target: 1,000,000 assets monitored (production).
- Current phase: UX-deep work, not production backend.
- Working environment: Alejandro runs everything locally on his machine.
- Demo must remain reproducible across sessions and machines.

## Decision

Adopt the following stack for the functional demo:

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | **Node.js ≥20** | Matches declared production runtime |
| Framework | **Next.js 15 (App Router)** | Matches declared production framework; Server Components give us real DB queries without an intermediate API layer; file-based routing maps naturally to our 63 screens |
| Language | **TypeScript strict** | Type safety across DB/UI boundary; matches production |
| ORM | **Prisma 6** | Matches declared production ORM; schema becomes executable ERD (closes audit gap G-03 incrementally) |
| Database | **SQLite (local file)** | Zero setup, git-trackable seed state, fully offline, migration to Postgres is a `DATABASE_URL` change |
| Styling | **CSS Modules + CSS variables** | Preserves v8.18 token system as-is; no translation step required; Server-Components friendly |
| Maps | **Leaflet/OSM via react-leaflet** | Already validated in v8.18 |
| Icons | **lucide-react** | Matches v8.18 aesthetic, tree-shakable |
| Package manager | **pnpm** | Strict peer dependency resolution, disk-efficient |

## Alternatives considered

### SQLite vs Postgres (Docker) vs Supabase cloud

Postgres Docker and Supabase were rejected for this phase. Both add friction
(Docker requirement, cloud account, internet dependency) without a measurable
UX iteration benefit. SQLite handles thousands of entities effortlessly — our
UX-testing scale. The migration path to Postgres via Prisma is well-trodden.

### Rebuild vs Port of v8.18

See ADR-002 (upcoming) for port-with-cleanup decision.

### Framework alternatives (Astro, Remix, SvelteKit, Nuxt)

All rejected as throwaway — they do not match the declared production stack.

### Styling alternatives (Tailwind, CSS-in-JS)

Tailwind would require translating v8.18's CSS variable token system into
`tailwind.config.ts` — pure friction for a port. CSS-in-JS is incompatible with
Next.js Server Components best practices.

## Consequences

### Positive

- Zero throwaway code. Every file written in the functional demo migrates
  unchanged to production.
- The Prisma schema is the executable ERD, partially closing audit gap G-03.
- Each ported component becomes an entry of the Design System, partially
  closing audit gap G-02.
- The seeded `dev.db` file, committed to git, guarantees reproducible demos
  across machines and presentations.
- Local-first development: no internet required, no cloud costs, fast
  iteration cycles.

### Negative

- SQLite-Postgres feature delta: we cannot use `Jsonb`, `Jsonb` indexes,
  `to_tsvector` full-text search, or PG-specific functions in queries. These
  limitations are documented as they arise.
- TimescaleDB hypertables are not available; Position and Event tables use
  regular B-tree indexes for now. Time-range queries will be slower at scale,
  but scale is not the Lote 1–2 concern.
- Next.js build tooling is heavier than a single HTML file — requires Node.js
  installed, `pnpm install` step, dev server process.

### Neutral

- The git-commit-the-DB pattern is unusual but deliberate for this phase.
  When we migrate to Postgres (target: Lote 3 or 4), dev.db is deleted and
  `.gitignore` is updated.

## Follow-up decisions

- **ADR-001** — Asset cardinality to Group (1:N)
- **ADR-002** (pending) — Port-with-cleanup strategy for v8.18
- **ADR-003** (pending, expected Lote 1.2) — Seed determinism approach
- **ADR-004** (pending, expected Lote 1.3) — Server Component vs Client
  Component boundaries for screen pages
