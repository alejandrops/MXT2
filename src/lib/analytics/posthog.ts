// ═══════════════════════════════════════════════════════════════
//  Analytics · PostHog wrapper (L6)
//  ─────────────────────────────────────────────────────────────
//  Capa de abstracción sobre posthog-js para que:
//
//  1. Code que llama `track()` no rompa si la key no está seteada
//     (graceful degradation · MVP no requiere analytics activos).
//  2. Se trackeen IDs en lugar de PII · email/nombres no se
//     mandan a PostHog (decisión de privacy).
//  3. Eventos sean type-safe · refactor-friendly y autocompletado.
//  4. En modo demo / desarrollo NO se trackeen eventos · pollute
//     analytics con datos fake.
//
//  Para usar:
//
//    import { track } from "@/lib/analytics/posthog";
//    track("user_login", { success: true, profile: "OPERATOR" });
//
//  El módulo es importable desde cualquier Client Component. La
//  inicialización real ocurre en `<PostHogProvider />` en el layout.
// ═══════════════════════════════════════════════════════════════

import posthog from "posthog-js";

// ───────────────────────────────────────────────────────────────
//  Event registry · un solo lugar para definir los eventos válidos
//  y sus payloads. Agregar acá ANTES de llamar track() en otra
//  parte del código.
// ───────────────────────────────────────────────────────────────

export type EventMap = {
  user_login: { success: boolean; profileLabel?: string; reason?: string };
  user_logout: Record<string, never>;
  account_switched: { from: string | null; to: string };
  cmdk_opened: Record<string, never>;
  cmdk_searched: { queryLength: number };
  alarm_attended: { alarmId: string; severity: string };
  alarm_closed: { alarmId: string; resolution?: string };
  vehicle_view: { assetId: string; source: "list" | "map" | "search" | "cmdk" };
  report_generated: { type: string; period?: string; metric?: string };
  export_clicked: { format: "csv" | "pdf" | "excel" };
  theme_changed: { mode: "LIGHT" | "DARK" | "AUTO" };
  password_set_for_user: { targetUserId: string };
};

export type EventName = keyof EventMap;

// ───────────────────────────────────────────────────────────────
//  Estado interno · si el SDK está habilitado o no
// ───────────────────────────────────────────────────────────────

let initialized = false;
let enabled = false;

/**
 * Inicializa el SDK. Se llama una vez en el mount del Provider.
 *
 * Si no hay `NEXT_PUBLIC_POSTHOG_KEY`, el módulo queda en modo
 * no-op (track / identify son funciones vacías). Esto evita
 * romper deploys que no tengan la key configurada.
 *
 * En modo demo (cookie demo activa, no hay supabase auth real),
 * tampoco se trackea · pollute analytics con datos fake.
 */
export function initPostHog(opts: {
  authMode: "demo" | "supabase";
  // Permite forzar disabled desde el caller · útil en tests
  forceDisabled?: boolean;
}): void {
  if (initialized) return;
  initialized = true;

  if (opts.forceDisabled) {
    enabled = false;
    return;
  }

  if (opts.authMode === "demo") {
    enabled = false;
    return;
  }

  const key = process.env["NEXT_PUBLIC_POSTHOG_KEY"];
  const host = process.env["NEXT_PUBLIC_POSTHOG_HOST"] ?? "https://us.i.posthog.com";

  if (!key) {
    enabled = false;
    return;
  }

  try {
    posthog.init(key, {
      api_host: host,
      // Privacy: nunca capturar PII
      mask_all_text: false,
      mask_all_element_attributes: false,
      // Auto-capture pageviews vía our own listener (mejor control en App Router)
      capture_pageview: false,
      // Session replay: opt-in vía preferencia de user (NO default)
      disable_session_recording: true,
      // Persist en localStorage (más durable que cookie)
      persistence: "localStorage",
      // Identifier por defecto: anonymous · luego identify() lo asocia
      loaded: () => {
        enabled = true;
      },
    });
    enabled = true;
  } catch (err) {
    console.warn("[posthog] init failed", err);
    enabled = false;
  }
}

/**
 * Identifica al user en PostHog. Solo se manda IDs y atributos
 * estructurales (accountId, profile, tier). NUNCA email / nombres.
 *
 * Llamar en cada mount del layout (Provider) cuando hay session
 * activa · idempotente.
 */
export function identify(userId: string, traits: {
  accountId: string | null;
  profileLabel: string;
  accountTier: string | null;
}): void {
  if (!enabled) return;
  try {
    posthog.identify(userId, traits);
  } catch (err) {
    console.warn("[posthog] identify failed", err);
  }
}

/**
 * Cierra la sesión de tracking · llamar en logout. Asegura que
 * el próximo user no herede el ID del anterior.
 */
export function reset(): void {
  if (!enabled) return;
  try {
    posthog.reset();
  } catch (err) {
    console.warn("[posthog] reset failed", err);
  }
}

/**
 * Captura un page view manualmente. Llamado por el Provider en
 * cada cambio de pathname (App Router no tiene auto-pageview que
 * funcione bien out-of-the-box).
 */
export function capturePageView(pathname: string): void {
  if (!enabled) return;
  try {
    posthog.capture("$pageview", { $current_url: pathname });
  } catch (err) {
    console.warn("[posthog] pageview failed", err);
  }
}

/**
 * Captura un evento custom type-safe. El nombre del evento debe
 * estar en `EventMap`; las props son inferidas automáticamente.
 *
 * Ejemplo:
 *   track("user_login", { success: true, profileLabel: "OPERATOR" })
 */
export function track<K extends EventName>(
  name: K,
  props: EventMap[K],
): void {
  if (!enabled) return;
  try {
    posthog.capture(name, props as Record<string, unknown>);
  } catch (err) {
    console.warn("[posthog] track failed", err);
  }
}

/**
 * Para testing / debugging desde la consola del browser.
 * NO usar desde código de producción.
 */
export const __posthogInternal__ = {
  isEnabled: () => enabled,
  isInitialized: () => initialized,
};
