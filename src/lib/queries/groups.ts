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
  /** Cantidad de subgrupos directos · A5 */
  childCount: number;
}

export async function listGroupsWithCounts(opts: {
  search?: string | null;
  accountId?: string | null;
  scopedAccountIds?: string[] | null;
} = {}): Promise<GroupListRow[]> {
  // Tenant scope · si vacío, devolver vacío
  if (Array.isArray(opts.scopedAccountIds) && opts.scopedAccountIds.length === 0) {
    return [];
  }

  const where: any = {};
  if (Array.isArray(opts.scopedAccountIds)) {
    where.accountId = { in: opts.scopedAccountIds };
  }
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
      _count: { select: { assets: true, children: true } },
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
    childCount: g._count.children,
  }));
}

export interface GroupCounts {
  totalGroups: number;
  totalRoots: number;
  totalVehicles: number;
}

export async function getGroupCounts(
  scopedAccountIds?: string[] | null,
): Promise<GroupCounts> {
  // Tenant scope · si vacío, devolver 0s
  if (Array.isArray(scopedAccountIds) && scopedAccountIds.length === 0) {
    return { totalGroups: 0, totalRoots: 0, totalVehicles: 0 };
  }

  const groupWhere = Array.isArray(scopedAccountIds)
    ? { accountId: { in: scopedAccountIds } }
    : undefined;
  const assetWhere = Array.isArray(scopedAccountIds)
    ? { accountId: { in: scopedAccountIds }, groupId: { not: null } }
    : { groupId: { not: null } };
  const rootWhere = Array.isArray(scopedAccountIds)
    ? { accountId: { in: scopedAccountIds }, parentId: null }
    : { parentId: null };

  const [totalGroups, totalRoots, totalVehiclesAgg] = await Promise.all([
    db.group.count({ where: groupWhere }),
    db.group.count({ where: rootWhere }),
    db.asset.count({ where: assetWhere }),
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

// ═══════════════════════════════════════════════════════════════
//  Helpers para drawer · A5
// ═══════════════════════════════════════════════════════════════

/**
 * Detalle del grupo para el drawer · null si no existe o fuera del scope.
 */
export async function getGroupForEdit(
  groupId: string,
  scopedAccountIds: string[] | null,
): Promise<{
  id: string;
  accountId: string;
  parentId: string | null;
  name: string;
} | null> {
  if (Array.isArray(scopedAccountIds) && scopedAccountIds.length === 0) {
    return null;
  }
  const where: any = { id: groupId };
  if (Array.isArray(scopedAccountIds)) {
    where.accountId = { in: scopedAccountIds };
  }
  return db.group.findFirst({
    where,
    select: { id: true, accountId: true, parentId: true, name: true },
  });
}

/**
 * Para validar antes de delete · cuántos hijos directos y vehículos
 * tiene un grupo. Si total > 0 no se puede eliminar.
 */
export async function getGroupRelationCounts(
  groupId: string,
): Promise<{
  childGroups: number;
  vehicles: number;
  total: number;
}> {
  const [childGroups, vehicles] = await Promise.all([
    db.group.count({ where: { parentId: groupId } }),
    db.asset.count({ where: { groupId } }),
  ]);
  return { childGroups, vehicles, total: childGroups + vehicles };
}

/**
 * Devuelve los IDs de todos los descendientes de un grupo
 * (recursivo, multi-nivel). Usado por el drawer para excluirlos
 * de las opciones de "Padre" y prevenir ciclos.
 *
 * Devuelve set vacío si el grupo no tiene hijos. NO incluye al
 * grupo mismo · el caller hace .add(groupId) si lo necesita.
 */
export async function getGroupDescendantIds(groupId: string): Promise<string[]> {
  const result = new Set<string>();
  const queue: string[] = [groupId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await db.group.findMany({
      where: { parentId: currentId },
      select: { id: true },
    });
    for (const c of children) {
      if (!result.has(c.id)) {
        result.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return Array.from(result);
}

/**
 * Para llenar el selectbox de "Padre" del drawer · todos los grupos
 * de un account, opcionalmente excluyendo un set (el grupo actual
 * y sus descendientes en modo edit).
 */
export async function listGroupsForParentSelect(
  accountId: string,
  excludeIds: string[] = [],
): Promise<{ id: string; name: string; parentName: string | null }[]> {
  const groups = await db.group.findMany({
    where: {
      accountId,
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      parent: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    parentName: g.parent?.name ?? null,
  }));
}
