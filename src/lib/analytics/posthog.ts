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
  // ── Auth ─────────────────────────────────────────────────
  user_login: { success: boolean; profileLabel?: string; reason?: string };
  user_logout: Record<string, never>;
  account_switched: { from: string | null; to: string };

  // ── Command palette ──────────────────────────────────────
  cmdk_opened: Record<string, never>;
  cmdk_searched: { queryLength: number };

  // ── Alarmas / seguridad ──────────────────────────────────
  alarm_attended: { alarmId: string; severity: string };
  alarm_closed: { alarmId: string; resolution?: string };

  // ── Libro del Objeto · S1-L4/L5/L6 ──────────────────────
  vehicle_view: { assetId: string; source: "list" | "map" | "search" | "cmdk" };
  /** Cambio de tab del Libro · entender qué módulos consumen los users */
  book_tab_changed: {
    objectType: "vehiculo" | "conductor" | "grupo";
    fromTab: string | null;
    toTab: string;
  };

  // ── Reportes / boletín ───────────────────────────────────
  report_generated: { type: string; period?: string; metric?: string };
  /** Usuario vio el boletín mensual · medir adopción */
  boletin_viewed: { period: string; source: "snapshot" | "onDemand" };
  export_clicked: { format: "csv" | "pdf" | "excel" };

  // ── Configuración / preferences ──────────────────────────
  theme_changed: { mode: "LIGHT" | "DARK" | "AUTO" };
  password_set_for_user: { targetUserId: string };

  // ── Feedback widget · S1-L8 ──────────────────────────────
  feedback_opened: Record<string, never>;
  feedback_submitted: {
    category: "BUG" | "FEATURE" | "OTHER";
    messageLength: number;
  };
  feedback_dismissed: { hadDraft: boolean };

  // ── Session replay opt-out · S1-L9 ───────────────────────
  session_recording_paused: Record<string, never>;
  session_recording_resumed: Record<string, never>;
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

// ═══════════════════════════════════════════════════════════════
//  Session recording · S1-L9
//  ─────────────────────────────────────────────────────────────
//  Control opt-in/opt-out de la grabación de sesión. La decisión
//  de habilitarla por default se toma en el caller (Provider · vía
//  env var NEXT_PUBLIC_ENABLE_SESSION_REPLAY o un flag por user).
//
//  El usuario puede pausar desde el banner de aviso · persistido
//  en localStorage para que sobreviva refresh.
// ═══════════════════════════════════════════════════════════════

const PAUSED_KEY = "mxt_session_recording_paused";

export function isSessionRecordingPausedByUser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PAUSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function pauseSessionRecording(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAUSED_KEY, "1");
  } catch {
    // localStorage puede estar deshabilitado · ignoramos
  }
  if (!enabled) return;
  try {
    posthog.stopSessionRecording();
  } catch (err) {
    console.warn("[posthog] stop session recording failed", err);
  }
}

export function resumeSessionRecording(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PAUSED_KEY);
  } catch {
    // localStorage puede estar deshabilitado · ignoramos
  }
  if (!enabled) return;
  try {
    posthog.startSessionRecording();
  } catch (err) {
    console.warn("[posthog] start session recording failed", err);
  }
}

/**
 * Enciende session recording si el user no lo pausó previamente.
 * Llamado por el Provider cuando session_replay está habilitado.
 */
export function maybeStartSessionRecording(): void {
  if (!enabled) return;
  if (isSessionRecordingPausedByUser()) return;
  try {
    posthog.startSessionRecording();
  } catch (err) {
    console.warn("[posthog] start session recording failed", err);
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
