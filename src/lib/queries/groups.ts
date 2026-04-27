import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  Groups queries · listing only (Lote A · simple version)
//  ─────────────────────────────────────────────────────────────
//  The Group model is hierarchical (parent/children) but for the
//  first iteration of /gestion/grupos we render a flat list with:
//    · group name
//    · account name
//    · vehicle count (assets directly assigned to that group)
//
//  Future: tree view honoring parent → children + bubbling counts.
// ═══════════════════════════════════════════════════════════════

export interface GroupListRow {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  parentId: string | null;
  parentName: string | null;
  vehicleCount: number;
}

export async function listGroupsWithCounts(opts: {
  search?: string | null;
  accountId?: string | null;
} = {}): Promise<GroupListRow[]> {
  const where: any = {};
  if (opts.accountId) where.accountId = opts.accountId;
  if (opts.search) {
    where.name = { contains: opts.search };
  }

  const groups = await db.group.findMany({
    where,
    select: {
      id: true,
      name: true,
      accountId: true,
      account: { select: { name: true } },
      parentId: true,
      parent: { select: { name: true } },
      _count: { select: { assets: true } },
    },
    orderBy: [{ account: { name: "asc" } }, { name: "asc" }],
  });

  return groups.map((g: any) => ({
    id: g.id,
    name: g.name,
    accountId: g.accountId,
    accountName: g.account.name,
    parentId: g.parentId,
    parentName: g.parent?.name ?? null,
    vehicleCount: g._count.assets,
  }));
}

export interface GroupCounts {
  totalGroups: number;
  totalRoots: number;
  totalVehicles: number;
}

export async function getGroupCounts(): Promise<GroupCounts> {
  const [totalGroups, totalRoots, totalVehiclesAgg] = await Promise.all([
    db.group.count(),
    db.group.count({ where: { parentId: null } }),
    db.asset.count({ where: { groupId: { not: null } } }),
  ]);
  return {
    totalGroups,
    totalRoots,
    totalVehicles: totalVehiclesAgg,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Lightweight filter helpers · used by trip filter bar etc.
// ═══════════════════════════════════════════════════════════════

export interface GroupForFilter {
  id: string;
  name: string;
}

export async function listGroupsForFilter(): Promise<GroupForFilter[]> {
  return db.group.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
