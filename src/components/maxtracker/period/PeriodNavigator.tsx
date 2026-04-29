"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { AnalysisGranularity } from "@/lib/queries";
import styles from "./PeriodNavigator.module.css";

// ═══════════════════════════════════════════════════════════════
//  PeriodNavigator · navegador de período compartido
//  ─────────────────────────────────────────────────────────────
//  Usado en Análisis y Reportes (y futuras pantallas).
//  Compone:
//    [< prev]  [📅 Hoy]  [next >]   |   [Día][Sem][Mes][Año-sem][Año-mes]
//
//  Es controlado · todos los cómputos de "qué viene antes/después"
//  los hace el server. El componente solo dispara eventos.
//
//  El prop `available` permite a cada pantalla limitar las
//  granularidades disponibles (ej. Reportes no muestra Año-sem
//  porque su grilla pivotada por días no escalaría).
// ═══════════════════════════════════════════════════════════════

interface Props {
  /** Granularidad actual */
  granularity: AnalysisGranularity;
  /** Subset visible · default: todas */
  available?: AnalysisGranularity[];
  /** Anchor del período anterior · calculado por el server */
  prevAnchor: string;
  /** Anchor del próximo período · null si es futuro y no se puede avanzar */
  nextAnchor: string | null;
  /** Si el período actual ES hoy (deshabilita el botón "Hoy") */
  isToday: boolean;
  /** Click en granularidad → cambia el modo */
  onChangeGranularity: (g: AnalysisGranularity) => void;
  /** Click en prev/next/today → cambia el ancla. null = volver a hoy */
  onChangeAnchor: (anchor: string | null) => void;
}

const TABS: {
  key: AnalysisGranularity;
  label: string;
  hint: string;
}[] = [
  { key: "day-hours", label: "Día", hint: "por horas" },
  { key: "week-days", label: "Semana", hint: "por días" },
  { key: "month-days", label: "Mes", hint: "por días" },
  { key: "year-weeks", label: "Año", hint: "por semanas" },
  { key: "year-months", label: "Año", hint: "por meses" },
];

export function PeriodNavigator({
  granularity,
  available,
  prevAnchor,
  nextAnchor,
  isToday,
  onChangeGranularity,
  onChangeAnchor,
}: Props) {
  const visibleTabs = available
    ? TABS.filter((t) => available.includes(t.key))
    : TABS;

  return (
    <div className={styles.wrap}>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => onChangeAnchor(prevAnchor)}
          title="Período anterior"
          aria-label="Período anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className={styles.todayBtn}
          onClick={() => onChangeAnchor(null)}
          disabled={isToday}
          title={isToday ? "Ya estás en hoy" : "Volver a hoy"}
        >
          <CalendarDays size={12} />
          <span>Hoy</span>
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => nextAnchor && onChangeAnchor(nextAnchor)}
          disabled={nextAnchor === null}
          title={nextAnchor ? "Período siguiente" : "Sin futuro"}
          aria-label="Período siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.tabs}>
        {visibleTabs.map((tab) => {
          const active = tab.key === granularity;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChangeGranularity(tab.key)}
              className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabHint}>{tab.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
