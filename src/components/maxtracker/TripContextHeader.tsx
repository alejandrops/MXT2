import { Calendar, Truck } from "lucide-react";
import type { DailyTrajectory } from "@/lib/queries/historicos";
import styles from "./TripContextHeader.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripContextHeader
//  ─────────────────────────────────────────────────────────────
//  Big, visible header that anchors the user's attention to:
//    · WHICH vehicle they're looking at (name + plate + make/model)
//    · WHICH date the playback represents (formatted in Spanish
//      with day of week)
//
//  Lives at the top of the right column on /seguimiento/historial.
//  Filter bar above shows the same info but as form controls;
//  this header is the "title page" of the day in review.
// ═══════════════════════════════════════════════════════════════

interface TripContextHeaderProps {
  trajectory: DailyTrajectory;
}

export function TripContextHeader({ trajectory }: TripContextHeaderProps) {
  const { asset, dateISO } = trajectory;

  // Format date as "miércoles 23 de abril de 2026"
  // Date interpretation: dateISO is the local AR day (YYYY-MM-DD).
  // We construct the Date so it represents that local day reliably.
  const date = new Date(`${dateISO}T12:00:00`); // noon avoids any TZ edge
  const formatted = formatDateLong(date);

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <Truck size={14} className={styles.icon} />
        <div className={styles.text}>
          <div className={styles.assetName}>{asset.name}</div>
          {asset.plate && (
            <div className={styles.assetPlate}>{asset.plate}</div>
          )}
        </div>
      </div>

      {(asset.make || asset.model) && (
        <div className={styles.makeModel}>
          {[asset.make, asset.model].filter(Boolean).join(" · ")}
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.row}>
        <Calendar size={14} className={styles.icon} />
        <div className={styles.dateText}>{formatted}</div>
      </div>
    </header>
  );
}

function formatDateLong(d: Date): string {
  const formatted = d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Capitalize first letter (es-AR returns lowercase weekday)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
