// ═══════════════════════════════════════════════════════════════
//  Event queries
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { Event, EventType, Person, Severity } from "@/types/domain";
import type { Prisma } from "@prisma/client";

export interface EventWithPerson extends Event {
  person: Pick<Person, "id" | "firstName" | "lastName"> | null;
}

/**
 * Recent events for an asset, newest first. Powers the
 * "Eventos recientes" panel in Libro B Overview.
 */
export async function getRecentEventsByAsset(
  assetId: string,
  limit = 10,
): Promise<EventWithPerson[]> {
  return db.event.findMany({
    where: { assetId },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: {
      person: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
//  Eventos tab in Libro B (Sub-lote 3.2) · paginated + filters
// ═══════════════════════════════════════════════════════════════

export interface AssetEventListParams {
  assetId: string;
  type?: EventType | null;
  severity?: Severity | null;
  page?: number;
  pageSize?: number;
}

export interface AssetEventListResult {
  rows: EventWithPerson[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listEventsByAsset(
  params: AssetEventListParams,
): Promise<AssetEventListResult> {
  const {
    assetId,
    type,
    severity,
    page = 1,
    pageSize = 25,
  } = params;

  const where: Prisma.EventWhereInput = {
    assetId,
    ...(type ? { type } : {}),
    ...(severity ? { severity } : {}),
  };

  const [total, items] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    rows: items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
