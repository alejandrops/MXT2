import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  Session · simulada vía cookie en demo
//  ─────────────────────────────────────────────────────────────
//  Cookie: "mxt-demo-user-id"
//  Si no hay cookie → default al primer Super admin (Alejandro).
//  Si la cookie apunta a un user inexistente → fallback al primer
//  user activo (cubre el caso "borraron mi user pero mi cookie
//  sigue ahí").
//
//  Cuando viene auth real (Auth0 v1.1+):
//    · `getSession()` lee el JWT en lugar de la cookie demo
//    · El switcher de identidad se elimina
//    · El resto del código no cambia · todo consume SessionData
//
//  cache() de React: cachea `getSession()` por request, así
//  múltiples server components que la pidan no consultan DB
//  varias veces.
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = "mxt-demo-user-id";

export interface SessionData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string | null;
    documentNumber: string | null;
    organizationId: string;
    accountId: string | null;
    /** "AS" · iniciales para avatar */
    initials: string;
    /** Color hex estable derivado del id · para avatar coloreado */
    avatarColor: string;
    language: string;
    theme: "LIGHT" | "DARK" | "AUTO";
    notifyAlarmHighCrit: boolean;
    notifyScoreDrop: boolean;
    notifyBoletinClosed: boolean;
    notifyCriticalEvent: boolean;
  };
  profile: {
    id: string;
    systemKey: "SUPER_ADMIN" | "MAXTRACKER_ADMIN" | "CLIENT_ADMIN" | "OPERATOR";
    nameLabel: string;
    /** Json del DB · ver PermissionsMap en permissions.ts */
    permissions: unknown;
  };
  account: {
    id: string;
    name: string;
    slug: string;
    tier: "BASE" | "PRO" | "ENTERPRISE";
  } | null;
  organization: {
    id: string;
    name: string;
  };
}

export const getSession = cache(async (): Promise<SessionData> => {
  const cookieStore = await cookies();
  const userIdCookie = cookieStore.get(COOKIE_NAME);
  const userId = userIdCookie?.value ?? null;

  // 1. Buscar por cookie (si existe)
  let user = userId
    ? await db.user.findFirst({
        where: { id: userId, status: "ACTIVE" },
        include: { profile: true, account: true, organization: true },
      })
    : null;

  // 2. Fallback · primer Super admin
  if (!user) {
    user = await db.user.findFirst({
      where: { profile: { systemKey: "SUPER_ADMIN" }, status: "ACTIVE" },
      include: { profile: true, account: true, organization: true },
    });
  }

  // 3. Fallback final · primer user activo
  if (!user) {
    user = await db.user.findFirst({
      where: { status: "ACTIVE" },
      include: { profile: true, account: true, organization: true },
    });
  }

  if (!user) {
    throw new Error(
      "No hay usuarios activos en la base · ejecutá `npm run db:seed`",
    );
  }

  return mapUser(user);
});

/**
 * Lista todos los usuarios activos · para el switcher de identidad
 * demo. Solo se usa desde el dropdown del Topbar (que es client),
 * a través de prop drilling desde el layout server component.
 */
export async function listDemoIdentities() {
  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    include: { profile: true, account: true },
    orderBy: [
      { profile: { systemKey: "asc" } },
      { firstName: "asc" },
    ],
  });
  return users.map((u) => ({
    id: u.id,
    fullName: `${u.firstName} ${u.lastName}`,
    email: u.email,
    profileKey: u.profile.systemKey,
    profileLabel: u.profile.nameLabel,
    accountName: u.account?.name ?? null,
  }));
}

// ═══════════════════════════════════════════════════════════════
//  Helpers internos
// ═══════════════════════════════════════════════════════════════

type UserWithRelations = NonNullable<
  Awaited<ReturnType<typeof db.user.findFirst>>
> & {
  profile: { id: string; systemKey: string; nameLabel: string; permissions: unknown };
  account: { id: string; name: string; slug: string; tier: string } | null;
  organization: { id: string; name: string };
};

function mapUser(u: UserWithRelations): SessionData {
  const fullName = `${u.firstName} ${u.lastName}`.trim();
  const initials = computeInitials(u.firstName, u.lastName);
  const avatarColor = colorForId(u.id);

  return {
    user: {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName,
      email: u.email,
      phone: u.phone,
      documentNumber: u.documentNumber,
      organizationId: u.organizationId,
      accountId: u.accountId,
      initials,
      avatarColor,
      language: u.language,
      theme: u.theme as "LIGHT" | "DARK" | "AUTO",
      notifyAlarmHighCrit: u.notifyAlarmHighCrit,
      notifyScoreDrop: u.notifyScoreDrop,
      notifyBoletinClosed: u.notifyBoletinClosed,
      notifyCriticalEvent: u.notifyCriticalEvent,
    },
    profile: {
      id: u.profile.id,
      systemKey: u.profile.systemKey as SessionData["profile"]["systemKey"],
      nameLabel: u.profile.nameLabel,
      permissions: u.profile.permissions,
    },
    account: u.account
      ? {
          id: u.account.id,
          name: u.account.name,
          slug: u.account.slug,
          tier: u.account.tier as "BASE" | "PRO" | "ENTERPRISE",
        }
      : null,
    organization: { id: u.organization.id, name: u.organization.name },
  };
}

function computeInitials(firstName: string, lastName: string): string {
  const f = firstName?.trim()[0] ?? "?";
  const l = lastName?.trim()[0] ?? "";
  return (f + l).toUpperCase();
}

/**
 * Color estable derivado del id · paleta acotada para look enterprise.
 * 8 tonos para que diferentes usuarios sean distinguibles sin caos.
 */
const AVATAR_PALETTE = [
  "#2563EB", // blue
  "#7C3AED", // purple
  "#0891B2", // cyan
  "#059669", // green
  "#CA8A04", // amber-dark
  "#DC2626", // red
  "#DB2777", // pink
  "#0D9488", // teal
];

function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}
