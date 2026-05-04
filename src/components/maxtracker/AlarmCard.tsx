// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
import Link from "next/link";
import { ChevronRight, Clock, User } from "lucide-react";
import {
  ALARM_TYPE_LABEL,
  SEVERITY_LABEL,
  relativeTime,
} from "@/lib/format";
import type { AlarmWithRefs } from "@/types/domain";
import styles from "./AlarmCard.module.css";

// ═══════════════════════════════════════════════════════════════
//  AlarmCard
//  ─────────────────────────────────────────────────────────────
//  Single alarm row used in the Dashboard D alarm list and in
//  the Libro B "open alarms" panel. The whole card is a Link to
//  the asset's Libro B page.
//
//  Visual reference: Samsara fleet safety alarm rows.
//
//  Severity is conveyed by:
//    1. A colored dot on the left
//    2. A subtle left border tint
//    3. The severity label in small monospace
//
//  DEUDA-1.3-V04 fix: when there's no driver assigned, we no
//  longer collapse the meta line to just a timestamp. We render
//  "Sin conductor asignado" and a Clock icon for the timestamp,
//  so every card has the same visual rhythm regardless of data.
// ═══════════════════════════════════════════════════════════════

interface AlarmCardProps {
  alarm: AlarmWithRefs;
}

export function AlarmCard({ alarm }: AlarmCardProps) {
  const severityClass = styles[`sev_${alarm.severity}`] ?? "";
  const driverName = alarm.person
    ? `${alarm.person.firstName} ${alarm.person.lastName}`
    : null;

  return (
    <Link
      href={`/objeto/vehiculo/${alarm.assetId}`}
      className={`${styles.card} ${severityClass}`}
    >
      <span className={styles.dot} />
      <div className={styles.body}>
        <div className={styles.line1}>
          <span className={styles.type}>{ALARM_TYPE_LABEL[alarm.type]}</span>
          <span className={styles.sevTag}>{SEVERITY_LABEL[alarm.severity]}</span>
        </div>
        <div className={styles.line2}>
          {alarm.asset.name}
          {alarm.asset.plate && (
            <span className={styles.plate}> · {alarm.asset.plate}</span>
          )}
        </div>
        <div className={styles.line3}>
          {driverName ? (
            <>
              <User size={11} />
              <span>{driverName}</span>
            </>
          ) : (
            <>
              <User size={11} />
              <span className={styles.unassigned}>Sin conductor asignado</span>
            </>
          )}
          <span className={styles.dotSep}>·</span>
          <Clock size={11} />
          <span className={styles.time}>{relativeTime(alarm.triggeredAt)}</span>
        </div>
      </div>
      <ChevronRight size={14} className={styles.chev} />
    </Link>
  );
}
