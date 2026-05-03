"use client";

import styles from "./GranularityToggle.module.css";

// ═══════════════════════════════════════════════════════════════
//  GranularityToggle · L3-IA
//  ─────────────────────────────────────────────────────────────
//  Control "Agrupar por" · separado del selector de tiempo
//  siguiendo el patrón Samsara/HubSpot.
//
//  Reemplaza al PeriodNavigator viejo (que mezclaba tiempo +
//  granularidad). Ahora:
//
//   · El TimeRangePicker decide QUÉ período ver
//   · El GranularityToggle decide CÓMO se agrega (día/semana/mes)
//
//  Las opciones disponibles son configurables · una pantalla
//  puede mostrar solo {Día, Semana, Mes} mientras otra muestra
//  los 5 niveles. Por defecto los 3 más comunes.
//
//  Mapping al modelo viejo de PeriodNavigator:
//    "day"   → granularity="day-hours"
//    "week"  → granularity="week-days"
//    "month" → granularity="month-days"
//    "year"  → granularity="year-months"
//
//  El consumer hace el mapping · acá solo manejamos las labels
//  que el user ve.
// ═══════════════════════════════════════════════════════════════

export type Granularity = "day" | "week" | "month" | "year";

interface Props {
  value: Granularity;
  onChange: (next: Granularity) => void;

  /** Subset de opciones a mostrar. Default: ["day", "week", "month"] */
  options?: readonly Granularity[];

  /** Label visible · default "Agrupar por" */
  label?: string;

  /** Disabled state */
  disabled?: boolean;
}

const ALL_GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

const DEFAULT_OPTIONS: readonly Granularity[] = ["day", "week", "month"];

export function GranularityToggle({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  label = "Agrupar por",
  disabled = false,
}: Props) {
  const visible = ALL_GRANULARITIES.filter((g) => options.includes(g.key));

  return (
    <div className={styles.wrap} aria-disabled={disabled}>
      <span className={styles.label}>{label}</span>
      <div className={styles.toggle} role="tablist">
        {visible.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={value === g.key}
            className={`${styles.btn} ${value === g.key ? styles.btnActive : ""}`}
            onClick={() => onChange(g.key)}
            disabled={disabled}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}
