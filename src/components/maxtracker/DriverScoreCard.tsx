import Link from "next/link";
import { initials } from "@/lib/format";
import type { DriverScoreRow } from "@/types/domain";
import styles from "./DriverScoreCard.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverScoreCard
//  ─────────────────────────────────────────────────────────────
//  Compact card for the worst-N driver leaderboard. Includes:
//    · Avatar with initials (no photos in seed data)
//    · Full name
//    · Horizontal score bar tinted by safety score
//    · Event count over the last 30 days
//
//  Score color thresholds match the Geotab-derived safety scoring
//  bands documented in project memory: <60 critical, <80 caution,
//  ≥80 healthy.
//
//  Sub-lote 3.3: now a Link to /gestion/conductores/[id] (Libro
//  del Conductor).
// ═══════════════════════════════════════════════════════════════

interface DriverScoreCardProps {
  driver: DriverScoreRow;
}

function scoreClass(score: number): string {
  if (score < 60) return "scoreRed";
  if (score < 80) return "scoreAmb";
  return "scoreGrn";
}

export function DriverScoreCard({ driver }: DriverScoreCardProps) {
  const cls = scoreClass(driver.safetyScore);
  // Bar fill: 0-100 maps to 0-100% width
  const fillPct = Math.max(2, Math.min(100, driver.safetyScore));
  return (
    <Link
      href={`/gestion/conductores/${driver.id}`}
      className={styles.card}
    >
      <div className={styles.avatar}>
        {initials(driver.firstName, driver.lastName)}
      </div>
      <div className={styles.body}>
        <div className={styles.name}>
          {driver.firstName} {driver.lastName}
        </div>
        <div className={styles.barRow}>
          <div className={styles.barTrack}>
            <div
              className={`${styles.barFill} ${styles[cls]}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span className={`${styles.score} ${styles[cls]}`}>
            {driver.safetyScore}
          </span>
        </div>
        <div className={styles.meta}>
          {driver.eventCount30d} {driver.eventCount30d === 1 ? "evento" : "eventos"} · 30d
        </div>
      </div>
    </Link>
  );
}
