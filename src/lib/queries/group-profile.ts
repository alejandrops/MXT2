import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  getGroupProfile · datos para el header slot del Libro Grupo
//  ─────────────────────────────────────────────────────────────
//  Cantidades y composición del grupo. Útil para ver de un vistazo
//  el tamaño del grupo y cuántos conductores activos lo cubren.
// ═══════════════════════════════════════════════════════════════

export interface GroupProfileData {
  id: string;
  name: string;
  /** Cantidad total de vehículos asignados al grupo */
  assetCount: number;
  /** Vehículos del grupo con un conductor asignado actualmente */
  assetsWithDriver: number;
  /** Conductores únicos que están asignados a vehículos de este grupo */
  uniqueDriversCount: number;
  /** ¿Hay un grupo padre? */
  parentName: string | null;
  /** ¿Hay subgrupos? */
  childrenCount: number;
}

export async function getGroupProfile(
  groupId: string,
): Promise<GroupProfileData | null> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      parent: { select: { name: true } },
      _count: { select: { children: true } },
      assets: {
        select: { id: true, currentDriverId: true },
      },
    },
  });

  if (!group) return null;

  const assetCount = group.assets.length;
  const assetsWithDriver = group.assets.filter(
    (a) => a.currentDriverId !== null,
  ).length;

  // Set de driverIds únicos
  const uniqueDrivers = new Set(
    group.assets
      .map((a) => a.currentDriverId)
      .filter((d): d is string => d !== null),
  );

  return {
    id: group.id,
    name: group.name,
    assetCount,
    assetsWithDriver,
    uniqueDriversCount: uniqueDrivers.size,
    parentName: group.parent?.name ?? null,
    childrenCount: group._count.children,
  };
}
