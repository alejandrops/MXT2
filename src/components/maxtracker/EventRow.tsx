// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
import { User } from "lucide-react";
import { EVENT_TYPE_LABEL, relativeTime } from "@/lib/format";
import type { EventWithPerson } from "@/lib/queries/events";
import styles from "./EventRow.module.css";

// ═══════════════════════════════════════════════════════════════
//  EventRow
//  ─────────────────────────────────────────────────────────────
//  Compact, non-clickable row for the recent-events panel inside
//  Libro B Overview. Cheaper than AlarmCard because events
//  rarely require navigation — they exist to give context.
// ═══════════════════════════════════════════════════════════════

interface EventRowProps {
  event: EventWithPerson;
}

export function EventRow({ event }: EventRowProps) {
  const severityClass = styles[`sev_${event.severity}`] ?? "";
  const driverName = event.person
    ? `${event.person.firstName} ${event.person.lastName}`
    : null;

  return (
    <div className={`${styles.row} ${severityClass}`}>
      <span className={styles.dot} />
      <div className={styles.body}>
        <div className={styles.line1}>
          <span className={styles.type}>{EVENT_TYPE_LABEL[event.type]}</span>
          <span className={styles.sevTag}>{event.severity}</span>
        </div>
        <div className={styles.line2}>
          {driverName && (
            <>
              <User size={10} />
              <span>{driverName}</span>
              <span className={styles.dotSep}>·</span>
            </>
          )}
          <span className={styles.time}>{relativeTime(event.occurredAt)}</span>
          {typeof event.speedKmh === "number" && event.speedKmh > 0 && (
            <>
              <span className={styles.dotSep}>·</span>
              <span className={styles.speed}>
                {Math.round(event.speedKmh)} km/h
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
