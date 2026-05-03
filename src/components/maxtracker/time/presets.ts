// ═══════════════════════════════════════════════════════════════
//  Time picker · Presets · L3-IA
//  ─────────────────────────────────────────────────────────────
//  Helpers para calcular rangos comunes a partir de un `today` y
//  un timezone offset. Reemplaza los presets más limitados del
//  DateRangePicker original (L3) con un set más completo y
//  reusable entre TimeRangePicker, GranularityToggle (no usa) y
//  potencialmente otros consumers.
//
//  Convención · todas las fechas son strings YYYY-MM-DD. Las
//  conversiones a Date se hacen acá puntualmente · evita líos
//  de timezone en el data flow padre/hijo.
// ═══════════════════════════════════════════════════════════════

export type PresetKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "thisYear"
  | "lastYear"
  | "ytd";

export interface PresetSpec {
  key: PresetKey;
  label: string;
  /** Categoría para agrupar visualmente · "rapido" arriba, "extendido" abajo */
  group: "quick" | "week" | "month" | "quarter" | "year";
}

export const ALL_PRESETS: readonly PresetSpec[] = [
  { key: "today", label: "Hoy", group: "quick" },
  { key: "yesterday", label: "Ayer", group: "quick" },
  { key: "7d", label: "7 días", group: "quick" },
  { key: "30d", label: "30 días", group: "quick" },
  { key: "90d", label: "90 días", group: "quick" },
  { key: "thisWeek", label: "Esta semana", group: "week" },
  { key: "lastWeek", label: "Semana pasada", group: "week" },
  { key: "thisMonth", label: "Este mes", group: "month" },
  { key: "lastMonth", label: "Mes pasado", group: "month" },
  { key: "thisQuarter", label: "Este trimestre", group: "quarter" },
  { key: "lastQuarter", label: "Trimestre pasado", group: "quarter" },
  { key: "thisYear", label: "Este año", group: "year" },
  { key: "lastYear", label: "Año pasado", group: "year" },
  { key: "ytd", label: "YTD", group: "year" },
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

/** Día de la semana 0=domingo · 1=lunes · ... · 6=sábado */
function localWeekday(d: Date, tzOffsetHours: number): number {
  const local = new Date(d.getTime() + tzOffsetHours * 60 * 60_000);
  return local.getUTCDay();
}

/**
 * Calcula el rango {from, to} en YYYY-MM-DD para un preset dado.
 * Semanas comienzan lunes (LATAM convention).
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
      const from = toIsoDateLocal(new Date(todayMs - 6 * DAY_MS), tzOffsetHours);
      return { from, to: todayIso };
    }

    case "30d": {
      const from = toIsoDateLocal(new Date(todayMs - 29 * DAY_MS), tzOffsetHours);
      return { from, to: todayIso };
    }

    case "90d": {
      const from = toIsoDateLocal(new Date(todayMs - 89 * DAY_MS), tzOffsetHours);
      return { from, to: todayIso };
    }

    case "thisWeek": {
      // Lunes-domingo
      const dow = localWeekday(today, tzOffsetHours);
      const offset = dow === 0 ? 6 : dow - 1;
      const monday = new Date(todayMs - offset * DAY_MS);
      return {
        from: toIsoDateLocal(monday, tzOffsetHours),
        to: todayIso,
      };
    }

    case "lastWeek": {
      const dow = localWeekday(today, tzOffsetHours);
      const offset = dow === 0 ? 6 : dow - 1;
      const lastMonday = new Date(todayMs - (offset + 7) * DAY_MS);
      const lastSunday = new Date(todayMs - (offset + 1) * DAY_MS);
      return {
        from: toIsoDateLocal(lastMonday, tzOffsetHours),
        to: toIsoDateLocal(lastSunday, tzOffsetHours),
      };
    }

    case "thisMonth": {
      const local = new Date(todayMs + tzOffsetHours * 60 * 60_000);
      const y = local.getUTCFullYear();
      const m = String(local.getUTCMonth() + 1).padStart(2, "0");
      return { from: `${y}-${m}-01`, to: todayIso };
    }

    case "lastMonth": {
      const local = new Date(todayMs + tzOffsetHours * 60 * 60_000);
      const y = local.getUTCFullYear();
      const m = local.getUTCMonth();
      const lastMonthYear = m === 0 ? y - 1 : y;
      const lastMonth = m === 0 ? 12 : m;
      const monthStr = String(lastMonth).padStart(2, "0");
      const firstOfThisMonth = new Date(Date.UTC(y, m, 1));
      const lastDayOfLastMonth = new Date(firstOfThisMonth.getTime() - DAY_MS);
      const lastDayStr = String(lastDayOfLastMonth.getUTCDate()).padStart(2, "0");
      return {
        from: `${lastMonthYear}-${monthStr}-01`,
        to: `${lastMonthYear}-${monthStr}-${lastDayStr}`,
      };
    }

    case "thisQuarter": {
      const local = new Date(todayMs + tzOffsetHours * 60 * 60_000);
      const y = local.getUTCFullYear();
      const m = local.getUTCMonth();
      const qStart = Math.floor(m / 3) * 3;
      const monthStr = String(qStart + 1).padStart(2, "0");
      return { from: `${y}-${monthStr}-01`, to: todayIso };
    }

    case "lastQuarter": {
      const local = new Date(todayMs + tzOffsetHours * 60 * 60_000);
      const y = local.getUTCFullYear();
      const m = local.getUTCMonth();
      const thisQStart = Math.floor(m / 3) * 3;
      const lastQStart = thisQStart === 0 ? 9 : thisQStart - 3;
      const lastQYear = thisQStart === 0 ? y - 1 : y;
      const lastQEndMonth = lastQStart + 2;
      const startStr = String(lastQStart + 1).padStart(2, "0");
      const endStr = String(lastQEndMonth + 1).padStart(2, "0");
      const firstOfNext = new Date(Date.UTC(lastQYear, lastQEndMonth + 1, 1));
      const lastDay = new Date(firstOfNext.getTime() - DAY_MS);
      const lastDayStr = String(lastDay.getUTCDate()).padStart(2, "0");
      return {
        from: `${lastQYear}-${startStr}-01`,
        to: `${lastQYear}-${endStr}-${lastDayStr}`,
      };
    }

    case "thisYear":
    case "ytd": {
      const local = new Date(todayMs + tzOffsetHours * 60 * 60_000);
      const y = local.getUTCFullYear();
      return { from: `${y}-01-01`, to: todayIso };
    }

    case "lastYear": {
      const local = new Date(todayMs + tzOffsetHours * 60 * 60_000);
      const y = local.getUTCFullYear() - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
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
  presets: readonly PresetKey[] = [
    "today",
    "yesterday",
    "7d",
    "30d",
    "thisMonth",
    "lastMonth",
  ],
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

// ═══════════════════════════════════════════════════════════════
//  Helpers de mes · usados por MonthPicker
// ═══════════════════════════════════════════════════════════════

/** Convierte "2026-04" → "Abril 2026" (locale ES) */
export function formatMonthLabel(period: string): string {
  const [yearStr, monthStr] = period.split("-");
  if (!yearStr || !monthStr) return period;
  const month = parseInt(monthStr, 10);
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${months[month - 1] ?? monthStr} ${yearStr}`;
}

/** Sumar/restar meses a un período YYYY-MM */
export function shiftMonth(period: string, delta: number): string {
  const [yearStr, monthStr] = period.split("-");
  if (!yearStr || !monthStr) return period;
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const total = y * 12 + (m - 1) + delta;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}
