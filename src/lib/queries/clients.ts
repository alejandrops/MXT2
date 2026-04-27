// ═══════════════════════════════════════════════════════════════
//  Accounts (clients) queries · backoffice multi-tenant view
//  ─────────────────────────────────────────────────────────────
//  Returns the list of all client accounts the platform manages,
//  joined with key counts (assets, devices, drivers) and a derived
//  "tier" pill. This is what Maxtracker staff sees in the admin
//  view, NOT what individual customers see.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

export interface ClientRow {
  id: string;
  name: string;
  slug: string;
  tier: "BASE" | "PRO" | "ENTERPRISE";
  industry: string | null;
  assetCount: number;
  deviceCount: number;
  personCount: number;
  alarmCount30d: number;
  createdAt: Date;
}

export async function listClients(opts: {
  search?: string | null;
  tier?: ClientRow["tier"] | null;
} = {}): Promise<ClientRow[]> {
  const where: any = {};
  if (opts.tier) where.tier = opts.tier;
  if (opts.search) {
    where.OR = [
      { name: { contains: opts.search } },
      { slug: { contains: opts.search } },
      { industry: { contains: opts.search } },
    ];
  }

  const accounts = await db.account.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      tier: true,
      industry: true,
      createdAt: true,
      _count: {
        select: { assets: true, persons: true },
      },
    },
  });

  // Need device count per account (join through Asset). Same for
  // alarmCount30d. Run as separate queries to keep the listing one
  // round-trip per concern.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ids = (accounts as { id: string }[]).map((a) => a.id);

  const [deviceCounts, alarmCounts] = await Promise.all([
    db.device.groupBy({
      by: ["accountId"] as any,
      _count: { _all: true },
    } as any).catch(() => [] as any[]),
    db.alarm.groupBy({
      by: ["accountId"],
      where: { triggeredAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  // device.groupBy may not work because Device has no direct
  // accountId — derive through Asset
  const devicesByAcc = new Map<string, number>();
  if ((deviceCounts as any[]).length === 0) {
    // Fallback: count devices per account through Asset relation
    const allDevices = await db.device.findMany({
      where: { asset: { accountId: { in: ids } } },
      select: { asset: { select: { accountId: true } } },
    });
    for (const d of allDevices as any[]) {
      const aid = d.asset?.accountId;
      if (!aid) continue;
      devicesByAcc.set(aid, (devicesByAcc.get(aid) ?? 0) + 1);
    }
  } else {
    for (const r of deviceCounts as any[]) {
      devicesByAcc.set(r.accountId, r._count._all);
    }
  }

  const alarmsByAcc = new Map<string, number>();
  for (const r of alarmCounts as any[]) {
    alarmsByAcc.set(r.accountId, r._count._all);
  }

  return (accounts as any[]).map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    tier: a.tier as ClientRow["tier"],
    industry: a.industry,
    assetCount: a._count.assets,
    personCount: a._count.persons,
    deviceCount: devicesByAcc.get(a.id) ?? 0,
    alarmCount30d: alarmsByAcc.get(a.id) ?? 0,
    createdAt: a.createdAt,
  }));
}

export async function getClientCounts(): Promise<{
  total: number;
  base: number;
  pro: number;
  enterprise: number;
}> {
  const [total, base, pro, enterprise] = await Promise.all([
    db.account.count(),
    db.account.count({ where: { tier: "BASE" } }),
    db.account.count({ where: { tier: "PRO" } }),
    db.account.count({ where: { tier: "ENTERPRISE" } }),
  ]);
  return { total, base, pro, enterprise };
}
