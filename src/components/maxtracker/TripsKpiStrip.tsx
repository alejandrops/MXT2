"use client";

import { Activity, AlertTriangle, Clock, Gauge, Map, Truck } from "lucide-react";
import type { TripKpis } from "@/lib/queries/trips";
import { formatDuration } from "@/lib/format";
import styles from "./TripsKpiStrip.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripsKpiStrip · summary KPIs over the trip range
// ═══════════════════════════════════════════════════════════════

interface TripsKpiStripProps {
  kpis: TripKpis;
}

export function TripsKpiStrip({ kpis }: TripsKpiStripProps) {
  const distance = formatKm(kpis.totalDistanceKm);
  const duration = formatDuration(kpis.totalDurationMs);
  const idle = formatDuration(kpis.totalIdleMs);
  const avgSpeed = Math.round(kpis.avgSpeedKmh);

  return (
    <div className={styles.strip}>
      <Kpi
        icon={<Map size={14} />}
        label="Viajes"
        value={kpis.totalTrips.toLocaleString("es-AR")}
        accent="blue"
      />
      <Kpi
        icon={<Truck size={14} />}
        label="Vehículos activos"
        value={kpis.vehiclesActive.toLocaleString("es-AR")}
        accent="purple"
      />
      <Divider />
      <Kpi
        icon={<Activity size={14} />}
        label="Distancia total"
        value={distance.value}
        unit={distance.unit}
        accent="cyan"
      />
      <Kpi
        icon={<Clock size={14} />}
        label="Tiempo total"
        value={duration}
        accent="green"
      />
      <Kpi
        icon={<Clock size={14} />}
        label="Tiempo en ralentí"
        value={idle}
        muted
        accent="slate"
      />
      <Kpi
        icon={<Gauge size={14} />}
        label="Velocidad promedio"
        value={avgSpeed.toString()}
        unit="km/h"
        accent="amber"
      />
      <Divider />
      <Kpi
        icon={<AlertTriangle size={14} />}
        label="Eventos"
        value={kpis.totalEvents.toLocaleString("es-AR")}
        sub={
          kpis.totalHighSeverityEvents > 0
            ? `${kpis.totalHighSeverityEvents} críticos`
            : null
        }
        warn={kpis.totalHighSeverityEvents > 0}
        accent={kpis.totalHighSeverityEvents > 0 ? "red" : "amber"}
      />
    </div>
  );
}

type AccentKey =
  | "blue"
  | "cyan"
  | "green"
  | "amber"
  | "red"
  | "purple"
  | "slate";

const ACCENT_CLASS: Record<AccentKey, string> = {
  blue: "kpiIconBlue",
  cyan: "kpiIconCyan",
  green: "kpiIconGreen",
  amber: "kpiIconAmber",
  red: "kpiIconRed",
  purple: "kpiIconPurple",
  slate: "kpiIconSlate",
};

function Kpi({
  icon,
  label,
  value,
  unit,
  sub,
  muted,
  warn,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  sub?: string | null;
  muted?: boolean;
  warn?: boolean;
  accent?: AccentKey;
}) {
  const iconClass = accent
    ? `${styles.kpiIcon} ${styles[ACCENT_CLASS[accent]] ?? ""}`
    : styles.kpiIcon;
  return (
    <div className={`${styles.kpi} ${muted ? styles.kpiMuted : ""}`}>
      <span className={iconClass}>{icon}</span>
      <div className={styles.kpiBody}>
        <div className={styles.kpiLabel}>{label}</div>
        <div className={styles.kpiValueRow}>
          <span
            className={`${styles.kpiValue} ${warn ? styles.kpiValueWarn : ""}`}
          >
            {value}
          </span>
          {unit && <span className={styles.kpiUnit}>{unit}</span>}
          {sub && (
            <span
              className={`${styles.kpiSub} ${warn ? styles.kpiSubWarn : ""}`}
            >
              {sub}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className={styles.divider} aria-hidden="true" />;
}

function formatKm(km: number): { value: string; unit: string } {
  if (km >= 1000) {
    return {
      value: (km / 1000).toLocaleString("es-AR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      unit: "Mm",
    };
  }
  return {
    value: km.toLocaleString("es-AR", {
      maximumFractionDigits: 0,
    }),
    unit: "km",
  };
}
