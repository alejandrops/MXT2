"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  Server Actions · Empresa (S1)
//  ─────────────────────────────────────────────────────────────
//  Acciones del grupo "Empresa" en /configuracion. Todas validan
//  que el caller tenga permiso (CLIENT_ADMIN o superior) Y que
//  el accountId target sea su propio account (excepto SA/MA que
//  pueden tocar cualquier cuenta).
// ═══════════════════════════════════════════════════════════════

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ─── Auth helper ─────────────────────────────────────────────

async function ensureCanManageAccount(
  targetAccountId: string,
): Promise<ActionResult<{ session: Awaited<ReturnType<typeof getSession>> }>> {
  const session = await getSession();
  const role = session.profile.systemKey;

  // SA y MA pueden tocar cualquier account
  if (role === "SUPER_ADMIN" || role === "MAXTRACKER_ADMIN") {
    return { ok: true, data: { session } };
  }

  // CA solo su propio account
  if (role === "CLIENT_ADMIN" && session.account?.id === targetAccountId) {
    return { ok: true, data: { session } };
  }

  return { ok: false, error: "No tenés permisos para esta operación." };
}

// ─── Datos de la cuenta ──────────────────────────────────────

export async function updateEmpresaDatos(input: {
  accountId: string;
  name: string;
  industry: string | null;
  alertContactEmail: string | null;
  alertContactPhone: string | null;
}): Promise<ActionResult> {
  const auth = await ensureCanManageAccount(input.accountId);
  if (!auth.ok) return auth;

  if (!input.name || input.name.length < 2) {
    return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };
  }

  if (input.alertContactEmail && !/^\S+@\S+\.\S+$/.test(input.alertContactEmail)) {
    return { ok: false, error: "Email de alertas inválido." };
  }

  try {
    // Update Account
    await db.account.update({
      where: { id: input.accountId },
      data: {
        name: input.name,
        industry: input.industry,
      },
    });

    // Upsert AccountSettings
    await db.accountSettings.upsert({
      where: { accountId: input.accountId },
      update: {
        alertContactEmail: input.alertContactEmail,
        alertContactPhone: input.alertContactPhone,
      },
      create: {
        accountId: input.accountId,
        alertContactEmail: input.alertContactEmail,
        alertContactPhone: input.alertContactPhone,
      },
    });

    revalidatePath("/configuracion");
    return { ok: true };
  } catch (err) {
    console.error("[updateEmpresaDatos]", err);
    return { ok: false, error: "Error al guardar los cambios." };
  }
}

// ─── Umbrales ────────────────────────────────────────────────

export async function updateEmpresaUmbrales(input: {
  accountId: string;
  speedLimitUrban: number;
  speedLimitHighway: number;
  speedTolerancePercent: number;
  harshBrakingThreshold: number;
  harshAccelerationThreshold: number;
  harshCorneringThreshold: number;
  idlingMinDuration: number;
  tripMinDistanceKm: number;
  tripMinDurationSec: number;
}): Promise<ActionResult> {
  const auth = await ensureCanManageAccount(input.accountId);
  if (!auth.ok) return auth;

  // Validaciones
  if (input.speedLimitUrban < 20 || input.speedLimitUrban > 130) {
    return { ok: false, error: "Velocidad urbana fuera de rango (20-130 km/h)." };
  }
  if (input.speedLimitHighway < 40 || input.speedLimitHighway > 150) {
    return { ok: false, error: "Velocidad ruta fuera de rango (40-150 km/h)." };
  }
  if (input.speedLimitHighway <= input.speedLimitUrban) {
    return { ok: false, error: "La velocidad de ruta debe ser mayor que la urbana." };
  }
  if (input.harshBrakingThreshold < 0.1 || input.harshBrakingThreshold > 1.0) {
    return { ok: false, error: "Umbral de frenada fuera de rango (0.1g - 1.0g)." };
  }

  try {
    await db.accountSettings.upsert({
      where: { accountId: input.accountId },
      update: {
        speedLimitUrban: input.speedLimitUrban,
        speedLimitHighway: input.speedLimitHighway,
        speedTolerancePercent: input.speedTolerancePercent,
        harshBrakingThreshold: input.harshBrakingThreshold,
        harshAccelerationThreshold: input.harshAccelerationThreshold,
        harshCorneringThreshold: input.harshCorneringThreshold,
        idlingMinDuration: input.idlingMinDuration,
        tripMinDistanceKm: input.tripMinDistanceKm,
        tripMinDurationSec: input.tripMinDurationSec,
      },
      create: {
        accountId: input.accountId,
        speedLimitUrban: input.speedLimitUrban,
        speedLimitHighway: input.speedLimitHighway,
        speedTolerancePercent: input.speedTolerancePercent,
        harshBrakingThreshold: input.harshBrakingThreshold,
        harshAccelerationThreshold: input.harshAccelerationThreshold,
        harshCorneringThreshold: input.harshCorneringThreshold,
        idlingMinDuration: input.idlingMinDuration,
        tripMinDistanceKm: input.tripMinDistanceKm,
        tripMinDurationSec: input.tripMinDurationSec,
      },
    });

    revalidatePath("/configuracion");
    return { ok: true };
  } catch (err) {
    console.error("[updateEmpresaUmbrales]", err);
    return { ok: false, error: "Error al guardar los umbrales." };
  }
}

// ─── Usuarios · CRUD ─────────────────────────────────────────

export async function createAccountUser(input: {
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  profileId: string;
}): Promise<ActionResult<{ userId: string }>> {
  const auth = await ensureCanManageAccount(input.accountId);
  if (!auth.ok) return auth;

  if (!input.firstName || !input.lastName) {
    return { ok: false, error: "Nombre y apellido son obligatorios." };
  }
  if (!/^\S+@\S+\.\S+$/.test(input.email)) {
    return { ok: false, error: "Email inválido." };
  }

  // Verificar que el profileId sea CLIENT_ADMIN o OPERATOR
  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || !["CLIENT_ADMIN", "OPERATOR"].includes(profile.systemKey)) {
    return { ok: false, error: "Perfil inválido." };
  }

  // Verificar que el account exista
  const account = await db.account.findUnique({ where: { id: input.accountId } });
  if (!account) {
    return { ok: false, error: "Cuenta no encontrada." };
  }

  // Verificar que no exista otro user con ese email
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return { ok: false, error: "Ya existe un usuario con ese email." };
  }

  try {
    const user = await db.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash: "supabase-auth-managed", // placeholder · auth real en Supabase
        organizationId: account.organizationId,
        accountId: input.accountId,
        profileId: input.profileId,
        status: "ACTIVE",
        language: "es-AR",
        theme: "LIGHT",
      },
    });

    revalidatePath("/configuracion");
    return { ok: true, data: { userId: user.id } };
  } catch (err) {
    console.error("[createAccountUser]", err);
    return { ok: false, error: "Error al crear el usuario." };
  }
}

export async function updateAccountUser(input: {
  userId: string;
  profileId?: string;
}): Promise<ActionResult> {
  const session = await getSession();

  if (input.userId === session.user.id) {
    return {
      ok: false,
      error: "No podés cambiar tu propio perfil. Pedí a otro admin.",
    };
  }

  const targetUser = await db.user.findUnique({
    where: { id: input.userId },
    select: { accountId: true },
  });

  if (!targetUser?.accountId) {
    return { ok: false, error: "Usuario no encontrado." };
  }

  const auth = await ensureCanManageAccount(targetUser.accountId);
  if (!auth.ok) return auth;

  if (input.profileId) {
    const profile = await db.profile.findUnique({ where: { id: input.profileId } });
    if (!profile || !["CLIENT_ADMIN", "OPERATOR"].includes(profile.systemKey)) {
      return { ok: false, error: "Perfil inválido." };
    }
  }

  try {
    await db.user.update({
      where: { id: input.userId },
      data: {
        ...(input.profileId && { profileId: input.profileId }),
      },
    });

    revalidatePath("/configuracion");
    return { ok: true };
  } catch (err) {
    console.error("[updateAccountUser]", err);
    return { ok: false, error: "Error al actualizar el usuario." };
  }
}

export async function toggleUserStatus(input: {
  userId: string;
  newStatus: "ACTIVE" | "SUSPENDED";
}): Promise<ActionResult> {
  const session = await getSession();

  if (input.userId === session.user.id) {
    return { ok: false, error: "No podés suspenderte a vos mismo." };
  }

  const targetUser = await db.user.findUnique({
    where: { id: input.userId },
    select: { accountId: true },
  });

  if (!targetUser?.accountId) {
    return { ok: false, error: "Usuario no encontrado." };
  }

  const auth = await ensureCanManageAccount(targetUser.accountId);
  if (!auth.ok) return auth;

  try {
    await db.user.update({
      where: { id: input.userId },
      data: { status: input.newStatus },
    });

    revalidatePath("/configuracion");
    return { ok: true };
  } catch (err) {
    console.error("[toggleUserStatus]", err);
    return { ok: false, error: "Error al cambiar el estado." };
  }
}

export async function deleteAccountUser(input: {
  userId: string;
}): Promise<ActionResult> {
  const session = await getSession();

  if (input.userId === session.user.id) {
    return { ok: false, error: "No podés eliminarte a vos mismo." };
  }

  const targetUser = await db.user.findUnique({
    where: { id: input.userId },
    select: { accountId: true },
  });

  if (!targetUser?.accountId) {
    return { ok: false, error: "Usuario no encontrado." };
  }

  const auth = await ensureCanManageAccount(targetUser.accountId);
  if (!auth.ok) return auth;

  try {
    // Hard delete · si tuviera relations bloqueantes, hacer soft delete
    await db.user.delete({ where: { id: input.userId } });

    revalidatePath("/configuracion");
    return { ok: true };
  } catch (err) {
    console.error("[deleteAccountUser]", err);
    return {
      ok: false,
      error: "Error al eliminar. Puede que el usuario tenga datos relacionados (alarmas atendidas, etc.) que impiden el borrado.",
    };
  }
}
