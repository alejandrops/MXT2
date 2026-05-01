"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createServerSupabase } from "@/lib/supabase/server";

// ═══════════════════════════════════════════════════════════════
//  Server actions de Configuración personal (S3 · pulido)
//  ─────────────────────────────────────────────────────────────
//  Operan sobre el User actual derivado de getSession(). Sin zod
//  por ahora · validación manual con mensajes en español.
//
//  Cambios S3:
//   · `changePassword` · integración real con Supabase Auth.
//     Valida la password actual con signInWithPassword() · si
//     pasa, llama a updateUser({ password: nueva }).
//   · `updateMiPerfil` · ignora cambios de email (email es
//     read-only desde la UI · cambios manuales requieren
//     soporte para sincronizar con Supabase Auth).
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
  /** Email se ignora · no se permite cambiar desde la UI */
  email?: string;
  phone: string;
  documentNumber: string;
}

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
  const phone = trimOrNull(input.phone);
  const documentNumber = trimOrNull(input.documentNumber);

  if (firstName.length === 0) errors.firstName = "Requerido";
  else if (firstName.length > 50)
    errors.firstName = "Máximo 50 caracteres";

  if (lastName.length === 0) errors.lastName = "Requerido";
  else if (lastName.length > 50) errors.lastName = "Máximo 50 caracteres";

  if (phone && phone.length > 30) errors.phone = "Máximo 30 caracteres";
  if (documentNumber && documentNumber.length > 30)
    errors.documentNumber = "Máximo 30 caracteres";

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // NO actualizamos el email · es read-only.
  await db.user.update({
    where: { id: session.user.id },
    data: { firstName, lastName, phone, documentNumber },
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

// ── Cambio de contraseña (S3 · Supabase real) ──────────────────

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

  // ── Validación local ──
  if (current.length === 0) {
    errors.current = "Requerido";
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

  // ── Modo de auth ──
  const authMode = process.env.AUTH_MODE === "supabase" ? "supabase" : "demo";

  if (authMode === "demo") {
    // Modo demo · no validamos contra Supabase. Solo guardamos un
    // hash dummy para que el cambio "se sienta real" en testing.
    await db.user.update({
      where: { id: session.user.id },
      data: { passwordHash: `demo:changed:${Date.now()}` },
    });
    return { ok: true, message: "Contraseña actualizada (modo demo)" };
  }

  // ── Modo Supabase · validar actual + actualizar ──
  try {
    const supabase = await createServerSupabase();

    // 1. Verificar password actual con signInWithPassword.
    //    Esto crea una nueva sesión válida si la pass es correcta.
    //    Si está mal, falla con error.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: current,
    });

    if (signInError) {
      return {
        ok: false,
        errors: { current: "Contraseña actual incorrecta" },
      };
    }

    // 2. Actualizar password.
    const { error: updateError } = await supabase.auth.updateUser({
      password: next,
    });

    if (updateError) {
      console.error("[changePassword] updateUser failed:", updateError);
      return {
        ok: false,
        errors: { next: updateError.message || "No se pudo actualizar la contraseña" },
      };
    }

    return { ok: true, message: "Contraseña actualizada" };
  } catch (err) {
    console.error("[changePassword] unexpected error:", err);
    return {
      ok: false,
      errors: {
        current: "Error inesperado al cambiar la contraseña. Intentá de nuevo.",
      },
    };
  }
}
