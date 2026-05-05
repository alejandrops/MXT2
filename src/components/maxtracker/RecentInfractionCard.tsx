// @ts-nocheck · pre-existing TS errors (Prisma types stale)
import Link from "next/link";
import { ChevronRight, Clock, Gauge, User } from "lucide-react";
import { relativeTime } from "@/lib/format";
import type { RecentInfractionRow } from "@/lib/queries/conduccion";
import styles from "./RecentInfractionCard.module.css";

// ═══════════════════════════════════════════════════════════════
//  RecentInfractionCard · S4-L3b
//  ─────────────────────────────────────────────────────────────
//  Card individual de una infracción para la lista del Dashboard
//  de Conducción. Mismo lenguaje visual que AlarmCard:
//    1. Dot coloreado por severity (LEVE / MEDIA / GRAVE)
//    2. Borde izquierdo con tono sutil de la severity
//    3. 3 líneas: tipo · meta · timestamp
//
//  Click → Libro del Vehículo (drill al detalle del asset).
//  En S4-L3c con la lista completa esto irá al detalle de la
//  infracción específica con polilínea + curva velocidad/tiempo.
// ═══════════════════════════════════════════════════════════════

interface RecentInfractionCardProps {
  infraction: RecentInfractionRow;
}

const SEVERITY_LABEL: Record<"LEVE" | "MEDIA" | "GRAVE", string> = {
  LEVE: "Leve",
  MEDIA: "Media",
  GRAVE: "Grave",
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}min`;
  return `${m}min ${s}s`;
}

export function RecentInfractionCard({ infraction }: RecentInfractionCardProps) {
  const severityClass = styles[`sev_${infraction.severity}`] ?? "";
  const driverName = infraction.driver
    ? `${infraction.driver.firstName} ${infraction.driver.lastName}`.trim()
    : null;
  const assetLabel = infraction.asset.plate ?? infraction.asset.name;

  return (
    <Link
      href={`/objeto/vehiculo/${infraction.asset.id}`}
      className={`${styles.card} ${severityClass}`}
    >
      <span className={styles.dot} />
      <div className={styles.body}>
        <div className={styles.line1}>
          <span className={styles.type}>
            {assetLabel}
            <span className={styles.sevTag}>
              {SEVERITY_LABEL[infraction.severity]}
            </span>
          </span>
        </div>
        <div className={styles.line2}>
          <span className={styles.meta}>
            <Gauge size={12} aria-hidden />
            {Math.round(infraction.peakSpeedKmh)}{" / "}
            <span className={styles.vmax}>{infraction.vmaxKmh}</span>
            {" km/h"}
          </span>
          <span className={styles.metaSep}>·</span>
          <span className={styles.meta}>
            {formatDuration(infraction.durationSec)}
          </span>
          {driverName && (
            <>
              <span className={styles.metaSep}>·</span>
              <span className={styles.meta}>
                <User size={12} aria-hidden />
                {driverName}
              </span>
            </>
          )}
          {!driverName && (
            <>
              <span className={styles.metaSep}>·</span>
              <span className={styles.metaMuted}>Sin conductor</span>
            </>
          )}
        </div>
        <div className={styles.line3}>
          <Clock size={11} aria-hidden />
          <span>{relativeTime(infraction.startedAt)}</span>
        </div>
      </div>
      <ChevronRight className={styles.chev} size={16} />
    </Link>
  );
}
