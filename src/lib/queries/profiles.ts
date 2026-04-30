// ═══════════════════════════════════════════════════════════════
//  Profile queries · backoffice (B2)
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";

export interface ProfileListRow {
  id: string;
  systemKey: "SUPER_ADMIN" | "MAXTRACKER_ADMIN" | "CLIENT_ADMIN" | "OPERATOR";
  nameLabel: string;
  userCount: number;
  permissions: unknown;
}

/**
 * Lista de los 4 perfiles builtin con conteo de usuarios asignados.
 */
export async function listProfilesWithUserCounts(): Promise<ProfileListRow[]> {
  const profiles = await db.profile.findMany({
    select: {
      id: true,
      systemKey: true,
      nameLabel: true,
      permissions: true,
      _count: { select: { users: true } },
    },
    orderBy: { systemKey: "asc" },
  });

  return profiles.map((p) => ({
    id: p.id,
    systemKey: p.systemKey as ProfileListRow["systemKey"],
    nameLabel: p.nameLabel,
    userCount: p._count.users,
    permissions: p.permissions,
  }));
}

/**
 * Detalle de un perfil para el drawer de edit.
 */
export async function getProfileForEdit(profileId: string): Promise<{
  id: string;
  systemKey: string;
  nameLabel: string;
  permissions: unknown;
  userCount: number;
} | null> {
  const p = await db.profile.findUnique({
    where: { id: profileId },
    include: { _count: { select: { users: true } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    systemKey: p.systemKey,
    nameLabel: p.nameLabel,
    permissions: p.permissions,
    userCount: p._count.users,
  };
}
