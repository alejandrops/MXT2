"use client";

import { Calendar } from "lucide-react";
import { useMemo } from "react";
import {
  ALL_PRESETS,
  computePreset,
  detectActivePreset,
  type PresetKey,
} from "./presets";
import styles from "./TimeRangePicker.module.css";

// ═══════════════════════════════════════════════════════════════
//  TimeRangePicker · L3-IA · componente unificado de rango libre
//  ─────────────────────────────────────────────────────────────
//  Reemplaza al DateRangePicker original (L3) con un componente
//  más alineado al patrón Samsara/Geotab/HubSpot:
//
//   · Inputs de fecha + presets relativos (no chips de granularidad)
//   · La granularidad del display la maneja una pantalla con
//     <GranularityToggle /> separado · NO con este picker
//   · Subset configurable de presets para casos especiales
//
//  Para los 4 patrones distintos de Maxtracker:
//   · /actividad/viajes        · presets quick (yesterday, 7d, 30d, thisMonth)
//   · /actividad/evolucion     · presets quick + week + month
//   · /actividad/resumen       · idem
//   · /objeto/[tipo]/[id]      · idem
//   · /direccion/boletin       · NO usa este componente · MonthPicker propio
//   · /seguimiento/historial   · NO usa este componente · DayWithTimePicker propio
//
//  API estable · todos los strings en formato YYYY-MM-DD.
// ═══════════════════════════════════════════════════════════════

export interface TimeRangeValue {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface Props {
  value: TimeRangeValue;
  onChange: (next: TimeRangeValue) => void;

  /**
   * Subset de presets a mostrar. Default: presets "quick".
   * Pasar `[]` deshabilita los presets (solo inputs nativos).
   */
  presets?: readonly PresetKey[];

  /**
   * "Hoy" usado para calcular presets relativos. Default: new Date().
   * Override útil en demos con data fija de un mes específico.
   */
  today?: Date;

  /**
   * Offset de zona horaria (positivo al oeste de UTC).
   * Default · -3 (Argentina).
   */
  tzOffsetHours?: number;

  /** Disabled state · usado durante transitions de router.push */
  disabled?: boolean;

  /** Variante compacta · 1 fila inline · default */
  variant?: "inline" | "stacked";
}

const DEFAULT_PRESETS: readonly PresetKey[] = [
  "yesterday",
  "7d",
  "30d",
  "thisMonth",
  "lastMonth",
];

export function TimeRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  today,
  tzOffsetHours = -3,
  disabled = false,
  variant = "inline",
}: Props) {
  const todayDate = useMemo(() => today ?? new Date(), [today]);

  const activePreset = useMemo(
    () => detectActivePreset(value, todayDate, presets, tzOffsetHours),
    [value, todayDate, presets, tzOffsetHours],
  );

  const presetSpecs = useMemo(
    () => ALL_PRESETS.filter((p) => presets.includes(p.key)),
    [presets],
  );

  function applyDate(field: "from" | "to", input: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return;
    onChange({ ...value, [field]: input });
  }

  function applyPreset(key: PresetKey) {
    const computed = computePreset(key, todayDate, tzOffsetHours);
    onChange(computed);
  }

  const wrapClass =
    variant === "stacked" ? styles.wrapStacked : styles.wrapInline;

  return (
    <div className={wrapClass} aria-disabled={disabled}>
      {/* ── Date inputs ────────────────────────────────────── */}
      <div className={styles.dateGroup}>
        <Calendar size={12} className={styles.icon} aria-hidden="true" />
        <input
          type="date"
          className={styles.dateInput}
          value={value.from}
          max={value.to}
          onChange={(e) => applyDate("from", e.target.value)}
          disabled={disabled}
          aria-label="Fecha desde"
        />
        <span className={styles.dateSep} aria-hidden="true">
          →
        </span>
        <input
          type="date"
          className={styles.dateInput}
          value={value.to}
          min={value.from}
          onChange={(e) => applyDate("to", e.target.value)}
          disabled={disabled}
          aria-label="Fecha hasta"
        />
      </div>

      {/* ── Presets ────────────────────────────────────────── */}
      {presetSpecs.length > 0 && (
        <div className={styles.presets}>
          {presetSpecs.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`${styles.preset} ${activePreset === p.key ? styles.presetActive : ""}`}
              onClick={() => applyPreset(p.key)}
              disabled={disabled}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
