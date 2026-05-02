import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createServerSupabase } from "@/lib/supabase/server";

// ═══════════════════════════════════════════════════════════════
//  Session · soporta dos modos · controlado por AUTH_MODE env (H2)
//  ─────────────────────────────────────────────────────────────
//
//  AUTH_MODE=demo (default · dev local)
//    · Cookie "mxt-demo-user-id" apunta a User.id
//    · Si no hay cookie → fallback al primer SUPER_ADMIN activo
//    · El switcher de identidad (Topbar) sigue funcionando
//
//  AUTH_MODE=supabase (producción)
//    · Lee la sesión de Supabase Auth via @supabase/ssr
//    · Mapea auth.users.id → User.supabaseAuthId → User row
//    · Si no hay sesión válida → redirect a /login
//    · El switcher de identidad NO se muestra (deshabilitado)
//
//  El resto del código (todas las páginas) consume `getSession()`
//  sin saber qué modo está activo · misma SessionData en ambos.
//
//  cache() de React: cachea por request, así múltiples
//  Server Components no consultan DB varias veces.
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = "mxt-demo-user-id";

export type AuthMode = "demo" | "supabase";

export function getAuthMode(): AuthMode {
  return process.env.AUTH_MODE === "supabase" ? "supabase" : "demo";
}

export interface SessionData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    /** Teléfono opcional · usado por la pantalla de "Mi perfil". */
    phone: string | null;
    /** DNI / documento · usado por "Mi perfil" y backoffice. */
    documentNumber: string | null;
    organizationId: string;
    accountId: string | null;
    initials: string;
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
    permissions: unknown;
  };
  account: {
    id: string;
    name: string;
    slug: string;
    /** Plan comercial (BASE / PRO / ENTERPRISE) · null si user cross-account. */
    tier: "BASE" | "PRO" | "ENTERPRISE";
  } | null;
  organization: {
    id: string;
    name: string;
  };
  /** Indica el modo de auth activo · UI lo usa para decidir si
   * mostrar el switcher de identidad o no */
  authMode: AuthMode;
}

// ─── Public API ──────────────────────────────────────────────

export const getSession = cache(async (): Promise<SessionData> => {
  const mode = getAuthMode();

  if (mode === "supabase") {
    return getSessionFromSupabase();
  }

  return getSessionFromDemoCookie();
});

/**
 * Lista usuarios para el switcher de identidad.
 *
 * En modo demo, devuelve TODOS los users activos.
 * En modo supabase, devuelve [] (no hay switcher en producción).
 */
export async function listDemoIdentities() {
  if (getAuthMode() === "supabase") {
    return [];
  }
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

// ─── Implementación · modo demo ───────────────────────────────

async function getSessionFromDemoCookie(): Promise<SessionData> {
  const cookieStore = await cookies();
  const userIdCookie = cookieStore.get(COOKIE_NAME);
  const userId = userIdCookie?.value ?? null;

  let user = userId
    ? await db.user.findFirst({
        where: { id: userId, status: "ACTIVE" },
        include: { profile: true, account: true, organization: true },
      })
    : null;

  if (!user) {
    user = await db.user.findFirst({
      where: { profile: { systemKey: "SUPER_ADMIN" }, status: "ACTIVE" },
      include: { profile: true, account: true, organization: true },
    });
  }

  if (!user) {
    user = await db.user.findFirst({
      where: { status: "ACTIVE" },
      include: { profile: true, account: true, organization: true },
    });
  }

  if (!user) {
    throw new Error(
      "No hay usuarios activos en la base · ejecutá los seeds",
    );
  }

  return mapUser(user, "demo");
}

// ─── Implementación · modo Supabase ───────────────────────────

async function getSessionFromSupabase(): Promise<SessionData> {
  const supabase = await createServerSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Buscar el User local por supabaseAuthId
  const user = await db.user.findFirst({
    where: { supabaseAuthId: authUser.id, status: "ACTIVE" },
    include: { profile: true, account: true, organization: true },
  });

  // El user existe en auth pero no en nuestra DB · hay desincronización
  // (se borró del backoffice mientras tenía sesión) · forzar logout.
  if (!user) {
    await supabase.auth.signOut();
    redirect("/login?error=user_not_provisioned");
  }

  return mapUser(user, "supabase");
}

// ─── Helper de mapping (compartido) ───────────────────────────

type UserWithRelations = NonNullable<
  Awaited<ReturnType<typeof db.user.findFirst>>
> & {
  profile: { id: string; systemKey: string; nameLabel: string; permissions: unknown };
  account: { id: string; name: string; slug: string; tier: string } | null;
  organization: { id: string; name: string };
};

function mapUser(u: UserWithRelations, authMode: AuthMode): SessionData {
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
      phone: u.phone ?? null,
      documentNumber: u.documentNumber ?? null,
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
    authMode,
  };
}

function computeInitials(firstName: string, lastName: string): string {
  const f = firstName?.trim()[0] ?? "?";
  const l = lastName?.trim()[0] ?? "";
  return (f + l).toUpperCase();
}

const AVATAR_PALETTE = [
  "#2563EB",
  "#7C3AED",
  "#0891B2",
  "#059669",
  "#CA8A04",
  "#DC2626",
  "#DB2777",
  "#0D9488",
];

function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}
