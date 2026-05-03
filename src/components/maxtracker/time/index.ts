// ═══════════════════════════════════════════════════════════════
//  Time pickers · L3-IA · barrel exports
//  ─────────────────────────────────────────────────────────────
//  4 componentes para 4 patrones distintos de selección temporal:
//
//   · TimeRangePicker   · rango libre [from, to] + presets
//                          (Trips, Reportes, Objeto)
//   · GranularityToggle · "Agrupar por" (Día/Semana/Mes)
//                          separado del tiempo
//   · MonthPicker       · selector específico de mes (Boletín)
//   · DayWithTimePicker · día + slider horario (Historial)
//
//  Helpers compartidos en `presets.ts` · timezone-aware,
//  computePreset, formatMonthLabel, etc.
// ═══════════════════════════════════════════════════════════════

export {
  TimeRangePicker,
  type TimeRangeValue,
} from "./TimeRangePicker";

export {
  GranularityToggle,
  type Granularity,
} from "./GranularityToggle";

export { MonthPicker } from "./MonthPicker";

export {
  DayWithTimePicker,
  type DayWithTimeValue,
} from "./DayWithTimePicker";

export {
  ALL_PRESETS,
  computePreset,
  detectActivePreset,
  toIsoDateLocal,
  formatMonthLabel,
  shiftMonth,
  type PresetKey,
  type PresetSpec,
} from "./presets";
