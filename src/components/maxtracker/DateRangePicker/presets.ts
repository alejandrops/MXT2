// ═══════════════════════════════════════════════════════════════
//  DateRangePicker · Presets
//  ─────────────────────────────────────────────────────────────
//  Helpers para calcular rangos comunes ("Ayer", "Últimos 7 días",
//  "Este mes", etc.). Cada preset recibe el `today` actual y
//  devuelve un par `{ from, to }` en formato YYYY-MM-DD.
//
//  El cálculo es timezone-aware (Argentina UTC-3 default) para que
//  los rangos coincidan con el día natural del usuario, no con el
//  día UTC. El offset es overrideable para tenants en otras zonas
//  futuras (Chile UTC-3, México UTC-6, etc.).
// ═══════════════════════════════════════════════════════════════

export type PresetKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "thisMonth"
  | "lastMonth";

export interface PresetSpec {
  key: PresetKey;
  label: string;
  /** Intervalo en días para hint UX · -1 si no aplica */
  daysHint: number;
}

export const ALL_PRESETS: readonly PresetSpec[] = [
  { key: "today", label: "Hoy", daysHint: 1 },
  { key: "yesterday", label: "Ayer", daysHint: 1 },
  { key: "7d", label: "7 días", daysHint: 7 },
  { key: "30d", label: "30 días", daysHint: 30 },
  { key: "thisMonth", label: "Este mes", daysHint: -1 },
  { key: "lastMonth", label: "Mes pasado", daysHint: -1 },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convierte un Date a YYYY-MM-DD usando el timezone offset dado.
 * `tzOffsetHours` es positivo al oeste de UTC (ej: -3 para Argentina).
 */
export function toIsoDateLocal(d: Date, tzOffsetHours = -3): string {
  const local = new Date(d.getTime() + tzOffsetHours * 60 * 60_000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calcula el rango {from, to} en YYYY-MM-DD para un preset dado,
 * relativo al `today` provisto. El `tzOffsetHours` define qué zona
 * horaria se usa para "hoy/ayer".
 */
export function computePreset(
  preset: PresetKey,
  today: Date,
  tzOffsetHours = -3,
): { from: string; to: string } {
  const todayIso = toIsoDateLocal(today, tzOffsetHours);
  const todayMs = today.getTime();

  switch (preset) {
    case "today":
      return { from: todayIso, to: todayIso };

    case "yesterday": {
      const y = toIsoDateLocal(new Date(todayMs - DAY_MS), tzOffsetHours);
      return { from: y, to: y };
    }

    case "7d": {
      const from = toIsoDateLocal(
        new Date(todayMs - 6 * DAY_MS),
        tzOffsetHours,
      );
      return { from, to: todayIso };
    }

    case "30d": {
      const from = toIsoDateLocal(
        new Date(todayMs - 29 * DAY_MS),
        tzOffsetHours,
      );
      return { from, to: todayIso };
    }

    case "thisMonth": {
      // Calcular primer día del mes en local timezone
      const local = new Date(today.getTime() + tzOffsetHours * 60 * 60_000);
      const y = local.getUTCFullYear();
      const m = String(local.getUTCMonth() + 1).padStart(2, "0");
      return { from: `${y}-${m}-01`, to: todayIso };
    }

    case "lastMonth": {
      const local = new Date(today.getTime() + tzOffsetHours * 60 * 60_000);
      const y = local.getUTCFullYear();
      const m = local.getUTCMonth(); // 0-based
      const lastMonthYear = m === 0 ? y - 1 : y;
      const lastMonth = m === 0 ? 12 : m;
      const monthStr = String(lastMonth).padStart(2, "0");
      // Día final del mes pasado · primer día del mes actual menos 1
      const firstOfThisMonth = new Date(Date.UTC(y, m, 1));
      const lastDayOfLastMonth = new Date(firstOfThisMonth.getTime() - DAY_MS);
      const lastDayStr = String(lastDayOfLastMonth.getUTCDate()).padStart(2, "0");
      return {
        from: `${lastMonthYear}-${monthStr}-01`,
        to: `${lastMonthYear}-${monthStr}-${lastDayStr}`,
      };
    }
  }
}

/**
 * Detecta si el rango actual coincide exactamente con un preset.
 * Útil para resaltar el preset activo en la UI.
 */
export function detectActivePreset(
  range: { from: string; to: string },
  today: Date,
  presets: readonly PresetKey[] = ["today", "yesterday", "7d", "30d", "thisMonth", "lastMonth"],
  tzOffsetHours = -3,
): PresetKey | null {
  for (const preset of presets) {
    const computed = computePreset(preset, today, tzOffsetHours);
    if (computed.from === range.from && computed.to === range.to) {
      return preset;
    }
  }
  return null;
}
