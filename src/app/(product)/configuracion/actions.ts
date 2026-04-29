"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  Server actions de Configuración personal
//  ─────────────────────────────────────────────────────────────
//  Operan sobre el User actual derivado de getSession(). Sin zod
//  por ahora · validación manual con mensajes en español. Cuando
//  necesitemos validación más rica, agregamos la dep.
//
//  Cada action devuelve { ok: true } o { ok: false, errors }
//  donde errors es un Record<string, string> con field → mensaje.
// ═══════════════════════════════════════════════════════════════

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
}

// ── Mi perfil ──────────────────────────────────────────────────

export interface MiPerfilInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentNumber: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function updateMiPerfil(
  input: MiPerfilInput,
): Promise<ActionResult> {
  const session = await getSession();
  const errors: Record<string, string> = {};

  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = trimOrNull(input.phone);
  const documentNumber = trimOrNull(input.documentNumber);

  if (firstName.length === 0) errors.firstName = "Requerido";
  else if (firstName.length > 50)
    errors.firstName = "Máximo 50 caracteres";

  if (lastName.length === 0) errors.lastName = "Requerido";
  else if (lastName.length > 50) errors.lastName = "Máximo 50 caracteres";

  if (email.length === 0) errors.email = "Requerido";
  else if (!EMAIL_RE.test(email)) errors.email = "Email inválido";
  else if (email.length > 120) errors.email = "Máximo 120 caracteres";

  if (phone && phone.length > 30)
    errors.phone = "Máximo 30 caracteres";

  if (documentNumber && documentNumber.length > 30)
    errors.documentNumber = "Máximo 30 caracteres";

  // Verificar email único · si cambió y otro user lo tiene
  if (!errors.email && email !== session.user.email) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== session.user.id) {
      errors.email = "Ya hay otro usuario con este email";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { firstName, lastName, email, phone, documentNumber },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil actualizado" };
}

// ── Preferencias ───────────────────────────────────────────────

const VALID_LANGS = ["es-AR", "es-MX", "en-US"] as const;
const VALID_THEMES = ["LIGHT", "DARK", "AUTO"] as const;

type LangCode = (typeof VALID_LANGS)[number];
type ThemeCode = (typeof VALID_THEMES)[number];

export interface PreferenciasInput {
  language: string;
  theme: string;
}

export async function updatePreferencias(
  input: PreferenciasInput,
): Promise<ActionResult> {
  const session = await getSession();
  const errors: Record<string, string> = {};

  const language = input.language as LangCode;
  const theme = input.theme as ThemeCode;

  if (!VALID_LANGS.includes(language)) {
    errors.language = "Idioma inválido";
  }
  if (!VALID_THEMES.includes(theme)) {
    errors.theme = "Tema inválido";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { language, theme },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Preferencias actualizadas" };
}

// ── Notificaciones ─────────────────────────────────────────────

export interface NotificacionesInput {
  notifyAlarmHighCrit: boolean;
  notifyScoreDrop: boolean;
  notifyBoletinClosed: boolean;
  notifyCriticalEvent: boolean;
}

export async function updateNotificaciones(
  input: NotificacionesInput,
): Promise<ActionResult> {
  const session = await getSession();

  // Coerción defensiva · si llegó algo raro lo paso a false
  const data = {
    notifyAlarmHighCrit: input.notifyAlarmHighCrit === true,
    notifyScoreDrop: input.notifyScoreDrop === true,
    notifyBoletinClosed: input.notifyBoletinClosed === true,
    notifyCriticalEvent: input.notifyCriticalEvent === true,
  };

  await db.user.update({
    where: { id: session.user.id },
    data,
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Notificaciones actualizadas" };
}

// ── Cambio de contraseña ───────────────────────────────────────

export interface ChangePasswordInput {
  current: string;
  next: string;
  repeat: string;
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<ActionResult> {
  const session = await getSession();
  const errors: Record<string, string> = {};

  const current = (input.current ?? "").trim();
  const next = (input.next ?? "").trim();
  const repeat = (input.repeat ?? "").trim();

  // Demo · pedimos algo no vacío en "actual" (4+ chars) pero NO
  // validamos contra un valor real. Cuando viene Auth0 esta línea
  // se reemplaza con la validación real.
  if (current.length === 0) {
    errors.current = "Requerido";
  } else if (current.length < 4) {
    errors.current = "Mínimo 4 caracteres";
  }

  if (next.length === 0) {
    errors.next = "Requerido";
  } else if (next.length < 8) {
    errors.next = "Mínimo 8 caracteres";
  } else if (!/[a-zA-Z]/.test(next) || !/[0-9]/.test(next)) {
    errors.next = "Debe incluir letras y números";
  } else if (next === current) {
    errors.next = "Tiene que ser distinta a la actual";
  }

  if (repeat !== next) {
    errors.repeat = "No coincide con la nueva contraseña";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // Demo · "hash" dummy. Cuando viene Auth0 este reemplazo cambia.
  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash: `demo:changed:${Date.now()}` },
  });

  return { ok: true, message: "Contraseña actualizada" };
}
