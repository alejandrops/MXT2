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

export async function getGroupCounts(
  accountId?: string | null,
): Promise<GroupCounts> {
  // Multi-tenant scope (U1d) · counts deben ser consistentes con el listing
  const groupWhere = accountId ? { accountId } : undefined;
  const assetWhere = accountId
    ? { accountId, groupId: { not: null } }
    : { groupId: { not: null } };

  const [totalGroups, totalRoots, totalVehiclesAgg] = await Promise.all([
    db.group.count({ where: groupWhere }),
    db.group.count({ where: { ...(groupWhere ?? {}), parentId: null } }),
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

export async function listGroupsForFilter(
  /** Si se pasa, filtra grupos a ese account. Para users con scope
   *  OWN_ACCOUNT (CA, OP). Para SA/MA, pasar null o omitir. */
  accountId?: string | null,
): Promise<GroupForFilter[]> {
  return db.group.findMany({
    where: accountId ? { accountId } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ═══════════════════════════════════════════════════════════════
//  getGroupRelationCounts · pre-delete check (L1.5b)
//  ─────────────────────────────────────────────────────────────
//  Cuenta subgrupos directos y vehículos asignados al grupo. Si
//  total > 0, el caller debe rechazar el delete · el user tiene
//  que reasignar primero.
//
//  Usado por · /catalogos/grupos/actions.ts::deleteGroup
// ═══════════════════════════════════════════════════════════════

export interface GroupRelationCounts {
  childGroups: number;
  vehicles: number;
  total: number;
}

export async function getGroupRelationCounts(
  groupId: string,
): Promise<GroupRelationCounts> {
  const [childGroups, vehicles] = await Promise.all([
    db.group.count({ where: { parentId: groupId } }),
    db.asset.count({ where: { groupId } }),
  ]);

  return {
    childGroups,
    vehicles,
    total: childGroups + vehicles,
  };
}

// ═══════════════════════════════════════════════════════════════
//  getGroupDescendantIds · ciclo prevention (L1.5b)
//  ─────────────────────────────────────────────────────────────
//  Devuelve TODOS los IDs descendientes (recursivo) de un grupo
//  raíz. Usado para validar que al editar un grupo y asignarle un
//  parent, el parent propuesto NO sea un descendiente del grupo
//  actual (eso crearía un ciclo).
//
//  Implementación · BFS iterativo sobre Group.parentId. Para la
//  jerarquía actual (max 2 niveles · ADR-001) se ejecuta en O(1)
//  iteraciones. La implementación es general por si se aumenta
//  la profundidad en el futuro.
//
//  Usado por · /catalogos/grupos/actions.ts::updateGroup
// ═══════════════════════════════════════════════════════════════

export async function getGroupDescendantIds(
  groupId: string,
): Promise<string[]> {
  const descendants: string[] = [];
  let frontier: string[] = [groupId];

  // Cap defensivo · evita loop infinito si la DB tiene un ciclo
  // accidental (no debería existir por ADR-001 pero queda como guard).
  const MAX_DEPTH = 16;
  let depth = 0;

  while (frontier.length > 0 && depth < MAX_DEPTH) {
    const children = await db.group.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length === 0) break;
    descendants.push(...childIds);
    frontier = childIds;
    depth++;
  }

  return descendants;
}
