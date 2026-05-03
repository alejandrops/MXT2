"use client";

import { Calendar } from "lucide-react";
import { useMemo } from "react";
import {
  ALL_PRESETS,
  computePreset,
  detectActivePreset,
  type PresetKey,
} from "./presets";
import styles from "./DateRangePicker.module.css";

// ═══════════════════════════════════════════════════════════════
//  DateRangePicker · L3 · componente unificado
//  ─────────────────────────────────────────────────────────────
//  Reemplaza implementaciones ad-hoc de date range que cada
//  pantalla con filtros de fecha tenía duplicadas. Permite a
//  futuros consumers ahorrar el boilerplate.
//
//  Caso de uso · selección de un rango libre [from, to] con
//  presets opcionales ("Ayer", "7 días", etc.). NO incluye
//  granularity ni rangos horarios · esos casos tienen otros
//  componentes (Historicos · DayWithTimeRange; Direccion ·
//  MonthPicker; Objeto · GranularityAnchorPicker) o se quedan
//  ad-hoc según relevancia.
//
//  Diseño:
//   · Inputs nativos <input type="date"> · soporte universal,
//     no requiere library (vs react-day-picker o similar).
//   · Presets como buttons inline · click aplica directamente
//     y se resalta el preset que matchea el rango actual.
//   · Validación · from <= to enforced via min/max attrs.
//
//  API estable · todos los strings en formato YYYY-MM-DD
//  (sin Date objects) para evitar líos de timezone en el
//  data flow padre/hijo.
// ═══════════════════════════════════════════════════════════════

export interface DateRangeValue {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface Props {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;

  /**
   * Subset de presets a mostrar. Default: todos.
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
}

const DEFAULT_PRESETS: readonly PresetKey[] = [
  "yesterday",
  "7d",
  "30d",
  "thisMonth",
  "lastMonth",
];

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  today,
  tzOffsetHours = -3,
  disabled = false,
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

  return (
    <div className={styles.wrap} aria-disabled={disabled}>
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
        <span className={styles.dateSep} aria-hidden="true">→</span>
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
