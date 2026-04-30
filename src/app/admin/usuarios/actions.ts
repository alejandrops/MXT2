"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canWrite, getScopedAccountIds } from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════
//  Server actions · CRUD User (Backoffice B1)
//  ─────────────────────────────────────────────────────────────
//  Reglas de perfiles que un usuario puede asignar:
//
//    SUPER_ADMIN       → puede crear cualquier perfil
//                        (incluso otro SA)
//    MAXTRACKER_ADMIN  → puede crear MA, CA, OP · NO SA
//    CLIENT_ADMIN      → solo puede crear OP de su mismo account
//    OPERATOR          → no tiene acceso al backoffice
//
//  En MVP demo el password es siempre "demo123" · auth real
//  (Auth0) en v1.1+. El hash es un string fijo "demo123-hash"
//  para simular. Reset de contraseña vuelve a ese valor.
// ═══════════════════════════════════════════════════════════════

const DEMO_PASSWORD_HASH = "demo123-hash";

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
  id?: string;
  /** En createUser · password inicial generado para mostrar al admin */
  initialPassword?: string;
}

export interface UserInput {
  /** Solo en create · ignorado en update */
  accountId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string;
  phone: string;
  /** Solo en create · ignorado en update */
  profileId: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

interface ValidatedData {
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string | null;
  phone: string | null;
}

function validate(input: UserInput): {
  errors: Record<string, string>;
  data?: ValidatedData;
} {
  const errors: Record<string, string> = {};
  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const documentNumber = trimOrNull(input.documentNumber);
  const phone = trimOrNull(input.phone);

  if (firstName.length === 0) errors.firstName = "Requerido";
  else if (firstName.length > 50) errors.firstName = "Máximo 50 caracteres";

  if (lastName.length === 0) errors.lastName = "Requerido";
  else if (lastName.length > 50) errors.lastName = "Máximo 50 caracteres";

  if (email.length === 0) errors.email = "Requerido";
  else if (!EMAIL_RE.test(email)) errors.email = "Email inválido";

  if (Object.keys(errors).length > 0) return { errors };
  return { errors, data: { firstName, lastName, email, documentNumber, phone } };
}

/**
 * Verifica que el actor (session) puede asignar el targetProfile
 * y opcionalmente targetAccountId al usuario.
 *
 * Reglas:
 * - SUPER_ADMIN puede asignar cualquier perfil + cualquier account
 * - MAXTRACKER_ADMIN puede asignar MA/CA/OP, no SA. Cualquier account.
 * - CLIENT_ADMIN solo OPERATOR + solo su account.
 * - OPERATOR no llega aquí (canWrite es false).
 */
async function validateAssignment(
  actorSession: Awaited<ReturnType<typeof getSession>>,
  targetProfileId: string,
  targetAccountId: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const targetProfile = await db.profile.findUnique({
    where: { id: targetProfileId },
    select: { systemKey: true },
  });
  if (!targetProfile) return { ok: false, message: "Perfil inválido." };

  const actorKey = actorSession.profile.systemKey;
  const targetKey = targetProfile.systemKey;

  // Reglas de perfil
  if (actorKey === "MAXTRACKER_ADMIN" && targetKey === "SUPER_ADMIN") {
    return { ok: false, message: "No podés asignar perfil Super admin." };
  }
  if (actorKey === "CLIENT_ADMIN") {
    if (targetKey !== "OPERATOR") {
      return {
        ok: false,
        message: "Como Admin de cliente solo podés crear usuarios con perfil Operador.",
      };
    }
    if (!targetAccountId || targetAccountId !== actorSession.user.accountId) {
      return {
        ok: false,
        message: "Solo podés crear usuarios de tu propio cliente.",
      };
    }
  }

  // SA y MA: cualquier account, las reglas siguen
  // Reglas de account según perfil del target
  if (targetKey === "SUPER_ADMIN" || targetKey === "MAXTRACKER_ADMIN") {
    if (targetAccountId !== null) {
      return {
        ok: false,
        message: "Super admin y Admin Maxtracker no tienen cliente asignado.",
      };
    }
  } else {
    // CLIENT_ADMIN, OPERATOR · accountId obligatorio
    if (!targetAccountId) {
      return {
        ok: false,
        message: "Admin de cliente y Operador deben tener un cliente asignado.",
      };
    }
  }

  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════════════════════════

export async function createUser(input: UserInput): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_usuarios")) {
    return { ok: false, message: "No tenés permiso para crear usuarios." };
  }

  const { errors, data } = validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  if (!input.profileId) {
    return { ok: false, errors: { profileId: "Perfil requerido" } };
  }

  // Validar asignación de perfil + account
  const assignCheck = await validateAssignment(
    session,
    input.profileId,
    input.accountId,
  );
  if (!assignCheck.ok) {
    return { ok: false, message: assignCheck.message };
  }

  // Email único
  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { ok: false, errors: { email: "Ya existe un usuario con ese email" } };
  }

  // Validar account existe (si aplica)
  if (input.accountId) {
    const account = await db.account.findUnique({
      where: { id: input.accountId },
      select: { id: true },
    });
    if (!account) {
      return { ok: false, errors: { accountId: "Cliente inválido" } };
    }
  }

  const created = await db.user.create({
    data: {
      organizationId: session.organization.id,
      accountId: input.accountId,
      profileId: input.profileId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      documentNumber: data.documentNumber,
      phone: data.phone,
      passwordHash: DEMO_PASSWORD_HASH,
      status: "ACTIVE",
    },
  });

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    message: "Usuario creado",
    id: created.id,
    initialPassword: "demo123",
  };
}

// ═══════════════════════════════════════════════════════════════
//  Update · no toca password ni cambia perfil/account
//  ─────────────────────────────────────────────────────────────
//  Cambiar perfil/account de un usuario existente requiere
//  consideraciones complejas (re-asignación de scope, qué hacer
//  con sesiones activas, auditoría). En MVP solo permitimos
//  editar datos personales. Para cambiar perfil/account, hay que
//  desactivar y crear uno nuevo.
// ═══════════════════════════════════════════════════════════════

export async function updateUser(
  userId: string,
  input: UserInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!canWrite(session, "backoffice_usuarios")) {
    return { ok: false, message: "No tenés permiso." };
  }

  const scoped = getScopedAccountIds(session, "backoffice_usuarios");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }

  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, accountId: true, email: true },
  });
  if (!existing) return { ok: false, message: "Usuario no encontrado" };
  if (Array.isArray(scoped)) {
    if (existing.accountId === null || !scoped.includes(existing.accountId)) {
      return { ok: false, message: "Sin permiso para este usuario." };
    }
  }

  const { errors, data } = validate(input);
  if (Object.keys(errors).length > 0 || !data) return { ok: false, errors };

  // Email único (excluyendo el propio)
  if (data.email !== existing.email) {
    const conflict = await db.user.findUnique({
      where: { email: data.email },
    });
    if (conflict) {
      return {
        ok: false,
        errors: { email: "Ya existe otro usuario con ese email" },
      };
    }
  }

  await db.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      documentNumber: data.documentNumber,
      phone: data.phone,
    },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Usuario actualizado" };
}

// ═══════════════════════════════════════════════════════════════
//  Suspend / Reactivate
// ═══════════════════════════════════════════════════════════════

async function checkUserAccessible(
  userId: string,
  session: Awaited<ReturnType<typeof getSession>>,
): Promise<{ ok: boolean; user?: { id: string; accountId: string | null; firstName: string; lastName: string }; message?: string }> {
  if (!canWrite(session, "backoffice_usuarios")) {
    return { ok: false, message: "No tenés permiso." };
  }
  const scoped = getScopedAccountIds(session, "backoffice_usuarios");
  if (Array.isArray(scoped) && scoped.length === 0) {
    return { ok: false, message: "Sin permiso." };
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, accountId: true, firstName: true, lastName: true },
  });
  if (!user) return { ok: false, message: "Usuario no encontrado" };
  if (Array.isArray(scoped)) {
    if (user.accountId === null || !scoped.includes(user.accountId)) {
      return { ok: false, message: "Sin permiso para este usuario." };
    }
  }
  if (user.id === session.user.id) {
    return { ok: false, message: "No podés suspender tu propio usuario." };
  }
  return { ok: true, user };
}

export async function suspendUser(userId: string): Promise<ActionResult> {
  const session = await getSession();
  const check = await checkUserAccessible(userId, session);
  if (!check.ok || !check.user) return { ok: false, message: check.message };

  await db.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
  revalidatePath("/admin/usuarios");
  return { ok: true, message: `${check.user.firstName} ${check.user.lastName} suspendido` };
}

export async function reactivateUser(userId: string): Promise<ActionResult> {
  const session = await getSession();
  const check = await checkUserAccessible(userId, session);
  if (!check.ok || !check.user) return { ok: false, message: check.message };

  await db.user.update({
    where: { id: userId },
    data: { status: "ACTIVE" },
  });
  revalidatePath("/admin/usuarios");
  return { ok: true, message: `${check.user.firstName} ${check.user.lastName} reactivado` };
}

// ═══════════════════════════════════════════════════════════════
//  Reset password · vuelve a "demo123"
// ═══════════════════════════════════════════════════════════════

export async function resetUserPassword(userId: string): Promise<ActionResult> {
  const session = await getSession();
  const check = await checkUserAccessible(userId, session);
  if (!check.ok || !check.user) return { ok: false, message: check.message };

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: DEMO_PASSWORD_HASH },
  });
  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    message: `Contraseña reseteada a "demo123"`,
    initialPassword: "demo123",
  };
}
