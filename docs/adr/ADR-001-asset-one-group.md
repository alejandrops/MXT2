# ADR-001 — Asset Belongs to Exactly One Group

**Status:** Accepted  
**Date:** 2026-04-24  
**Decider:** Alejandro (Project Owner) + AG-001d Orchestrator  
**Supersedes:** —  
**Superseded by:** —  
**Context document:** DPM-001 in project memory

## Context

During schema design for Lote 1, we had to resolve the open domain-modeling
question DPM-001: can an asset belong to multiple groups simultaneously?

Both cardinalities are defensible:

- **1:N** — One asset belongs to AT MOST ONE group at a time. Simple,
  unambiguous, easy to reason about for end users, cheap to query.
- **N:M** — One asset can belong to multiple groups simultaneously. More
  flexible for complex organizational schemes where an asset is simultaneously
  part of (for example) a "North Region" fleet AND a "Refrigerated" category.

## Decision

**An Asset belongs to at most one Group (1:N).**

Schema representation:

```prisma
model Asset {
  // ...
  groupId String?
  group   Group? @relation(fields: [groupId], references: [id])
}
```

The foreign key is nullable so that an asset can exist without any group
assignment (transient states: newly onboarded assets, assets under transfer,
assets from accounts without group taxonomy).

## Rationale

Three factors drove the decision toward simplicity:

1. **User mental model.** Fleet managers we modeled in memory think of an
   asset as having a home (its group/subgroup). Being in multiple groups
   simultaneously is a power-user feature that creates reporting ambiguity
   ("does Asset X's mileage count in both groups' totals?") without an
   equivalent gain in day-to-day operations.

2. **Query simplicity.** Group-scoped queries (the common case) use a
   simple WHERE clause. With N:M we would need a junction table, additional
   joins, and duplicate-detection logic in aggregations. For a platform
   aiming at 1M assets, query simplicity pays compounding dividends.

3. **Reversibility.** Moving from 1:N to N:M later is straightforward:
   add a junction table, migrate existing assignments, update queries.
   Moving from N:M to 1:N later is a data-integrity nightmare.

## Consequences

### Positive

- Schema is simpler (no junction table, no composite indexes).
- Aggregation queries by group are trivially correct.
- UI for group assignment is a single-select dropdown, not a multi-select
  tagger — clearer UX with lower error rate.
- Moving an asset between groups is an atomic update, not a multi-row
  operation.

### Negative

- Accounts that organize assets along multiple orthogonal axes (e.g. region
  + vehicle type) cannot model both as groups. They must pick one as the
  primary taxonomy and solve the other with filters/tags.
- If the business need for N:M emerges post-launch, migration has a small
  but real cost.

### Mitigation

If a later use case demands multi-group membership, we have two paths:

1. Introduce a separate `Tag` entity with N:M to Asset, keeping Group as 1:N.
   This covers most multi-axis taxonomy needs without destabilizing Group
   semantics.
2. Full migration to Group N:M via junction table (breaking change for Group
   queries in UI and reports).

## Implementation

- `prisma/schema.prisma` — `Asset.groupId` as nullable String FK.
- `prisma/seed.ts` (Lote 1.2) — assigns exactly one group to each asset or
  leaves null for a small fraction representing newly-onboarded assets.
- `src/lib/queries/assets.ts` (Lote 1.2) — group filter becomes a simple
  `where: { groupId }` clause.
