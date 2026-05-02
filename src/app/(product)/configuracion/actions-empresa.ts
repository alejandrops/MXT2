"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  Server Actions · Empresa (S1 + S4 fixes)
//  ─────────────────────────────────────────────────────────────
//  S4 ·
//    · updateEmpresaUmbrales · validación completa de TODAS las
//      inputs (antes solo 3 de 9)
//    · updateAccountUser · bloquea cambiar el último CA a OP
//    · toggleUserStatus · bloquea suspender al último CA activo
//    · deleteAccountUser · bloquea eliminar al último CA +
//      mensajes específicos de error según relations
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

  // SA y MA pueden tocar cualquier account de SU organización (no de otras)
  if (role === "SUPER_ADMIN" || role === "MAXTRACKER_ADMIN") {
    const target = await db.account.findUnique({
      where: { id: targetAccountId },
      select: { organizationId: true },
    });
    if (!target) {
      return { ok: false, error: "Cuenta no encontrada." };
    }
    if (target.organizationId !== session.organization.id) {
      return { ok: false, error: "Esa cuenta pertenece a otra organización." };
    }
    return { ok: true, data: { session } };
  }

  if (role === "CLIENT_ADMIN" && session.account?.id === targetAccountId) {
    return { ok: true, data: { session } };
  }

  return { ok: false, error: "No tenés permisos para esta operación." };
}

/**
 * Helper · cuenta cuántos CLIENT_ADMIN ACTIVOS quedan en una cuenta
 * (excluyendo opcionalmente al user que está siendo modificado)
 */
async function countActiveClientAdmins(
  accountId: string,
  excludeUserId?: string,
): Promise<number> {
  const where: {
    accountId: string;
    status: "ACTIVE";
    profile: { systemKey: "CLIENT_ADMIN" };
    NOT?: { id: string };
  } = {
    accountId,
    status: "ACTIVE",
    profile: { systemKey: "CLIENT_ADMIN" },
  };
  if (excludeUserId) {
    where.NOT = { id: excludeUserId };
  }
  return db.user.count({ where });
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

  if (!input.name || input.name.trim().length < 2) {
    return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };
  }
  if (input.name.length > 100) {
    return { ok: false, error: "El nombre no puede superar los 100 caracteres." };
  }

  if (input.alertContactEmail && !/^\S+@\S+\.\S+$/.test(input.alertContactEmail)) {
    return { ok: false, error: "Email de alertas inválido." };
  }
  if (input.alertContactEmail && input.alertContactEmail.length > 120) {
    return { ok: false, error: "Email de alertas demasiado largo." };
  }
  if (input.alertContactPhone && input.alertContactPhone.length > 30) {
    return { ok: false, error: "Teléfono demasiado largo." };
  }

  try {
    await db.account.update({
      where: { id: input.accountId },
      data: {
        name: input.name.trim(),
        industry: input.industry,
      },
    });

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

// ─── Umbrales · validación completa ───────────────────────────

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

  // ── Velocidad ──
  if (
    !Number.isFinite(input.speedLimitUrban) ||
    input.speedLimitUrban < 20 ||
    input.speedLimitUrban > 130
  ) {
    return { ok: false, error: "Velocidad urbana fuera de rango (20-130 km/h)." };
  }
  if (
    !Number.isFinite(input.speedLimitHighway) ||
    input.speedLimitHighway < 40 ||
    input.speedLimitHighway > 150
  ) {
    return { ok: false, error: "Velocidad ruta fuera de rango (40-150 km/h)." };
  }
  if (input.speedLimitHighway <= input.speedLimitUrban) {
    return {
      ok: false,
      error: "La velocidad de ruta debe ser mayor que la urbana.",
    };
  }
  if (
    !Number.isFinite(input.speedTolerancePercent) ||
    input.speedTolerancePercent < 0 ||
    input.speedTolerancePercent > 50
  ) {
    return { ok: false, error: "Tolerancia fuera de rango (0-50%)." };
  }

  // ── G-force ──
  if (
    !Number.isFinite(input.harshBrakingThreshold) ||
    input.harshBrakingThreshold < 0.1 ||
    input.harshBrakingThreshold > 1.0
  ) {
    return { ok: false, error: "Umbral de frenada fuera de rango (0.1g - 1.0g)." };
  }
  if (
    !Number.isFinite(input.harshAccelerationThreshold) ||
    input.harshAccelerationThreshold < 0.1 ||
    input.harshAccelerationThreshold > 1.0
  ) {
    return {
      ok: false,
      error: "Umbral de aceleración fuera de rango (0.1g - 1.0g).",
    };
  }
  if (
    !Number.isFinite(input.harshCorneringThreshold) ||
    input.harshCorneringThreshold < 0.1 ||
    input.harshCorneringThreshold > 1.0
  ) {
    return {
      ok: false,
      error: "Umbral de curva fuera de rango (0.1g - 1.0g).",
    };
  }

  // ── Operación ──
  if (
    !Number.isInteger(input.idlingMinDuration) ||
    input.idlingMinDuration < 30 ||
    input.idlingMinDuration > 3600
  ) {
    return {
      ok: false,
      error: "Tiempo mínimo de ralentí fuera de rango (30-3600 segundos).",
    };
  }
  if (
    !Number.isFinite(input.tripMinDistanceKm) ||
    input.tripMinDistanceKm < 0.1 ||
    input.tripMinDistanceKm > 5
  ) {
    return {
      ok: false,
      error: "Distancia mínima de viaje fuera de rango (0.1-5 km).",
    };
  }
  if (
    !Number.isInteger(input.tripMinDurationSec) ||
    input.tripMinDurationSec < 30 ||
    input.tripMinDurationSec > 600
  ) {
    return {
      ok: false,
      error: "Duración mínima de viaje fuera de rango (30-600 segundos).",
    };
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

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();

  if (!firstName || !lastName) {
    return { ok: false, error: "Nombre y apellido son obligatorios." };
  }
  if (firstName.length > 50 || lastName.length > 50) {
    return { ok: false, error: "Nombre o apellido demasiado largos (máx 50 caracteres)." };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, error: "Email inválido." };
  }
  if (email.length > 120) {
    return { ok: false, error: "Email demasiado largo." };
  }

  // Verificar que el profileId sea CLIENT_ADMIN o OPERATOR
  // (los demás roles · SA, MA · se gestionan via /admin, no acá)
  const profile = await db.profile.findUnique({ where: { id: input.profileId } });
  if (!profile || !["CLIENT_ADMIN", "OPERATOR"].includes(profile.systemKey)) {
    return { ok: false, error: "Perfil inválido." };
  }

  const account = await db.account.findUnique({ where: { id: input.accountId } });
  if (!account) {
    return { ok: false, error: "Cuenta no encontrada." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Ya existe un usuario con ese email." };
  }

  try {
    const user = await db.user.create({
      data: {
        firstName,
        lastName,
        email,
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
    include: { profile: true },
  });

  if (!targetUser?.accountId) {
    return { ok: false, error: "Usuario no encontrado." };
  }

  const auth = await ensureCanManageAccount(targetUser.accountId);
  if (!auth.ok) return auth;

  if (input.profileId) {
    const newProfile = await db.profile.findUnique({
      where: { id: input.profileId },
    });
    if (!newProfile || !["CLIENT_ADMIN", "OPERATOR"].includes(newProfile.systemKey)) {
      return { ok: false, error: "Perfil inválido." };
    }

    // ── S4 · proteger último CA ──
    // Si el target era CLIENT_ADMIN y va a cambiar a algo distinto,
    // verificar que no sea el último CA activo de la cuenta.
    if (
      targetUser.profile.systemKey === "CLIENT_ADMIN" &&
      newProfile.systemKey !== "CLIENT_ADMIN" &&
      targetUser.status === "ACTIVE"
    ) {
      const otherActiveCAs = await countActiveClientAdmins(
        targetUser.accountId,
        targetUser.id,
      );
      if (otherActiveCAs === 0) {
        return {
          ok: false,
          error:
            "No se puede degradar al último administrador de la cuenta. Crear otro CLIENT_ADMIN primero.",
        };
      }
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
    return { ok: false, error: "No podés cambiar tu propio estado." };
  }

  const targetUser = await db.user.findUnique({
    where: { id: input.userId },
    include: { profile: true },
  });

  if (!targetUser?.accountId) {
    return { ok: false, error: "Usuario no encontrado." };
  }

  const auth = await ensureCanManageAccount(targetUser.accountId);
  if (!auth.ok) return auth;

  // ── S4 · proteger último CA ──
  // Si vamos a SUSPENDER a un CA activo, verificar que no sea el último.
  if (
    input.newStatus === "SUSPENDED" &&
    targetUser.profile.systemKey === "CLIENT_ADMIN" &&
    targetUser.status === "ACTIVE"
  ) {
    const otherActiveCAs = await countActiveClientAdmins(
      targetUser.accountId,
      targetUser.id,
    );
    if (otherActiveCAs === 0) {
      return {
        ok: false,
        error:
          "No se puede suspender al último administrador activo de la cuenta.",
      };
    }
  }

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
    include: { profile: true },
  });

  if (!targetUser?.accountId) {
    return { ok: false, error: "Usuario no encontrado." };
  }

  const auth = await ensureCanManageAccount(targetUser.accountId);
  if (!auth.ok) return auth;

  // ── S4 · proteger último CA ──
  if (
    targetUser.profile.systemKey === "CLIENT_ADMIN" &&
    targetUser.status === "ACTIVE"
  ) {
    const otherActiveCAs = await countActiveClientAdmins(
      targetUser.accountId,
      targetUser.id,
    );
    if (otherActiveCAs === 0) {
      return {
        ok: false,
        error:
          "No se puede eliminar al último administrador activo de la cuenta.",
      };
    }
  }

  try {
    await db.user.delete({ where: { id: input.userId } });
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (err) {
    console.error("[deleteAccountUser]", err);

    // ── S4 · mensaje específico según relations bloqueantes ──
    const errStr = String(err);
    if (errStr.includes("foreign key") || errStr.includes("violates")) {
      return {
        ok: false,
        error:
          "No se puede eliminar · el usuario tiene datos relacionados (alarmas atendidas, asignaciones, etc.). Suspendelo en su lugar.",
      };
    }
    return {
      ok: false,
      error: "Error al eliminar el usuario.",
    };
  }
}

// ─── S6 · Set password de otro user (admin only) ─────────────

export async function setUserPassword(input: {
  userId: string;
  newPassword: string;
}): Promise<ActionResult> {
  const session = await getSession();

  // No usar este flujo para cambiar la propia · ahí va el de
  // /configuracion?section=seguridad (que pide la actual)
  if (input.userId === session.user.id) {
    return {
      ok: false,
      error:
        "No podés cambiar tu propia contraseña desde acá. Usá Configuración > Seguridad.",
    };
  }

  const targetUser = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      accountId: true,
      email: true,
      supabaseAuthId: true,
    },
  });

  if (!targetUser?.accountId) {
    return { ok: false, error: "Usuario no encontrado." };
  }

  const auth = await ensureCanManageAccount(targetUser.accountId);
  if (!auth.ok) return auth;

  // ── Validación de la nueva password ──
  const newPass = input.newPassword.trim();
  if (newPass.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
    return { ok: false, error: "La contraseña debe incluir letras y números." };
  }

  // ── Necesita supabaseAuthId ──
  if (!targetUser.supabaseAuthId) {
    return {
      ok: false,
      error:
        "Este usuario no tiene cuenta de Supabase Auth. Tenés que crear primero el user en Supabase Auth (Dashboard > Authentication > Users > Add user) con el email " +
        targetUser.email +
        " · una vez creado, copiá el ID generado y pegalo en la columna supabaseAuthId del user en la base de datos.",
    };
  }

  // ── Modo de auth ──
  const authMode = process.env.AUTH_MODE === "supabase" ? "supabase" : "demo";

  if (authMode === "demo") {
    // Cosmético en modo demo · no hay Supabase Auth real
    return {
      ok: true,
      data: undefined,
    };
  }

  // ── Llamar al admin API de Supabase ──
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.supabaseAuthId,
      { password: newPass },
    );

    if (error) {
      console.error("[setUserPassword] supabase admin error:", error);
      return {
        ok: false,
        error: error.message || "No se pudo actualizar la contraseña.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[setUserPassword] unexpected error:", err);
    const msg = err instanceof Error ? err.message : "Error inesperado.";
    return {
      ok: false,
      error: msg,
    };
  }
}
