"use client";

import styles from "./KpiCard.module.css";

// ═══════════════════════════════════════════════════════════════
//  KpiCard · componente unificado · reemplaza 3 implementaciones
//  ─────────────────────────────────────────────────────────────
//  Aparecía en:
//    · VistaEjecutivaClient · cards 14px padding · valor 26px
//    · WeeklyPrintReport    · cards 10px padding · valor 20px
//    · AnnualPrintReport    · cards con valor 18px + unit
//
//  3 size variants:
//    sm · uso en imprimibles (denso)
//    md · uso en pantallas comunes (default)
//    lg · uso en home/landing (Vista ejecutiva)
//
//  2 modos · pueden coexistir:
//    · delta · variación vs período anterior (KPI tradicional)
//    · peer  · comparativa contra promedio de flota / grupo
//      (necesario para Libro del Objeto)
//
//  Tufte · sin sombras · border 1px · radius mínimo · color
//  solo en delta (excepción) · sin iconos decorativos.
// ═══════════════════════════════════════════════════════════════

export type KpiSize = "sm" | "md" | "lg";

interface PeerComparison {
  /** Valor de referencia (ej: promedio de la flota) */
  peerValue: number;
  /** Etiqueta del peer · "vs flota", "vs grupo Sur" */
  peerLabel: string;
  /** Cómo formatear los números */
  formatValue: (v: number) => string;
}

interface KpiCardProps {
  label: string;
  /** Valor principal pre-formateado · ej "1.240" o "147h" */
  value: string;
  /** Unidad opcional · ej "km" · va al lado del valor en gris */
  unit?: string;
  /**
   * Delta vs período anterior · -1 a +1 (ej 0.12 = +12%).
   * null = no hay datos previos · undefined = no aplica.
   */
  delta?: number | null;
  /**
   * Si true, delta positivo se pinta como malo (eventos · más eventos = peor).
   * Default false.
   */
  isReverseDelta?: boolean;
  /** Texto custom para acompañar el delta · default "vs período anterior" */
  deltaLabel?: string;
  /** Comparativa contra peer (ej promedio flota) · null = no aplica */
  peer?: PeerComparison | null;
  /** Tamaño · default "md" */
  size?: KpiSize;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  isReverseDelta = false,
  deltaLabel = "vs período anterior",
  peer,
  size = "md",
}: KpiCardProps) {
  return (
    <div className={`${styles.kpi} ${styles[size]}`}>
      <div className={styles.label}>{label}</div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>

      {delta !== undefined && (
        <DeltaLine
          delta={delta}
          isReverse={isReverseDelta}
          label={deltaLabel}
        />
      )}

      {peer && <PeerLine {...peer} />}
    </div>
  );
}

function DeltaLine({
  delta,
  isReverse,
  label,
}: {
  delta: number | null;
  isReverse: boolean;
  label: string;
}) {
  if (delta === null) {
    return <div className={styles.metaEmpty}>—</div>;
  }
  const cls =
    delta === 0
      ? styles.flat
      : isReverse
        ? delta > 0
          ? styles.bad
          : styles.good
        : delta > 0
          ? styles.up
          : styles.down;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "·";
  return (
    <div className={`${styles.meta} ${cls}`}>
      {arrow} {Math.abs(delta * 100).toFixed(0)}% {label}
    </div>
  );
}

function PeerLine({
  peerValue,
  peerLabel,
  formatValue,
}: PeerComparison) {
  return (
    <div className={styles.meta}>
      {peerLabel}: <span className={styles.peerValue}>{formatValue(peerValue)}</span>
    </div>
  );
}
