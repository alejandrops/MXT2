import { db } from "@/lib/db";
import type { PickerGroup, PickerUser } from "./LoginPicker";

// ═══════════════════════════════════════════════════════════════
//  loadDemoUsers · query y agrupa los users disponibles
//  ─────────────────────────────────────────────────────────────
//  Usado por /login en modo demo para popular el picker.
//
//  Reglas de orden:
//   1. Maxtracker (interno) primero · super admin antes que admin
//   2. Cuentas cliente alfabéticas · CLIENT_ADMIN antes que OPERATOR
//
//  Solo trae users con status=ACTIVE (los desactivados no se
//  pueden personificar en demo).
// ═══════════════════════════════════════════════════════════════

const ROLE_LABELS: Record<PickerUser["roleKey"], string> = {
  SUPER_ADMIN: "Super admin",
  MAXTRACKER_ADMIN: "Admin Maxtracker",
  CLIENT_ADMIN: "Admin",
  OPERATOR: "Operador",
};

/** Orden interno · super admin primero · operador último */
const ROLE_ORDER: Record<PickerUser["roleKey"], number> = {
  SUPER_ADMIN: 0,
  MAXTRACKER_ADMIN: 1,
  CLIENT_ADMIN: 2,
  OPERATOR: 3,
};

/** Paleta de colores para avatares · cíclica por user index */
const AVATAR_COLORS = [
  "#2563eb",
  "#16a34a",
  "#b45309",
  "#9333ea",
  "#0891b2",
  "#dc2626",
  "#7c3aed",
  "#0d9488",
];

export async function loadDemoUsers(): Promise<PickerGroup[]> {
  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      account: { select: { id: true, name: true, slug: true, tier: true } },
      profile: { select: { systemKey: true } },
    },
    orderBy: [{ accountId: "asc" }, { firstName: "asc" }],
  });

  // ── Mappear a PickerUser ──────────────────────────────────────
  type DbUser = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    account: { id: string; name: string; slug: string; tier: string } | null;
    profile: { systemKey: PickerUser["roleKey"] };
  };

  const pickerUsers: (PickerUser & {
    accountId: string | null;
    accountName: string | null;
    accountTier: string | null;
  })[] = (users as DbUser[]).map((u, idx) => ({
    id: u.id,
    fullName: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    initials: `${u.firstName[0] ?? "?"}${u.lastName[0] ?? ""}`.toUpperCase(),
    avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] ?? "#666",
    roleKey: u.profile.systemKey,
    roleLabel: ROLE_LABELS[u.profile.systemKey],
    accountId: u.account?.id ?? null,
    accountName: u.account?.name ?? null,
    accountTier: u.account?.tier ?? null,
  }));

  // ── Agrupar ───────────────────────────────────────────────────
  const groups = new Map<
    string,
    { label: string; caption?: string; isInternal: boolean; users: PickerUser[] }
  >();

  for (const user of pickerUsers) {
    const groupKey = user.accountId ?? "__INTERNAL__";

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        label: user.accountName ?? "Maxtracker (equipo interno)",
        caption: user.accountTier ?? undefined,
        isInternal: user.accountId === null,
        users: [],
      });
    }

    groups.get(groupKey)!.users.push({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      initials: user.initials,
      avatarColor: user.avatarColor,
      roleKey: user.roleKey,
      roleLabel: user.roleLabel,
    });
  }

  // ── Ordenar users dentro de cada grupo · por rol, luego nombre
  for (const group of groups.values()) {
    group.users.sort((a, b) => {
      const ro = ROLE_ORDER[a.roleKey] - ROLE_ORDER[b.roleKey];
      if (ro !== 0) return ro;
      return a.fullName.localeCompare(b.fullName);
    });
  }

  // ── Ordenar grupos · interno primero, después alfabéticos ────
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.isInternal && !b.isInternal) return -1;
    if (!a.isInternal && b.isInternal) return 1;
    return a.label.localeCompare(b.label);
  });

  return sortedGroups;
}
