"use client";

import { ArrowRight, Pause, Square } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { Segment } from "@/lib/queries/historicos";
import styles from "./SegmentList.module.css";

// ═══════════════════════════════════════════════════════════════
//  SegmentList
//  ─────────────────────────────────────────────────────────────
//  Renders the day's segments (TRIPs, STOPs, IDLEs) as a dense
//  clickable list. Click a segment to seek the playback cursor
//  to its start.
//
//  Visual encoding by kind:
//    · TRIP · arrow icon · primary text "Viaje"
//    · STOP · square icon (stop) · "Detención"
//    · IDLE · pause icon · "Ralentí"
// ═══════════════════════════════════════════════════════════════

interface SegmentListProps {
  segments: Segment[];
  onSegmentClick?: (segment: Segment) => void;
}

export function SegmentList({ segments, onSegmentClick }: SegmentListProps) {
  if (segments.length === 0) {
    return <div className={styles.empty}>Sin segmentos en este día.</div>;
  }

  const interactive = Boolean(onSegmentClick);

  return (
    <ol className={styles.list}>
      {segments.map((seg) => {
        const meta = describe(seg);
        const Inner = (
          <>
            <span className={`${styles.icon} ${styles[`icon${seg.kind}`]}`}>
              {meta.icon}
            </span>
            <span className={styles.time}>
              {formatTime(new Date(seg.startAt))}
              <span className={styles.timeSep}>→</span>
              {formatTime(new Date(seg.endAt))}
            </span>
            <span className={styles.label}>{meta.label}</span>
            <span className={styles.duration}>
              {formatDuration(seg.durationMs)}
            </span>
            {seg.kind === "TRIP" && seg.distanceKm > 0 && (
              <span className={styles.extra}>
                {seg.distanceKm.toFixed(1)} km
                {seg.maxSpeedKmh > 0 && (
                  <> · {Math.round(seg.maxSpeedKmh)} km/h</>
                )}
              </span>
            )}
          </>
        );

        return (
          <li key={seg.id} className={styles.item}>
            {interactive ? (
              <button
                type="button"
                className={styles.row}
                onClick={() => onSegmentClick?.(seg)}
                title="Saltar al inicio del segmento"
              >
                {Inner}
              </button>
            ) : (
              <div className={styles.row}>{Inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function describe(seg: Segment): { icon: React.ReactNode; label: string } {
  switch (seg.kind) {
    case "TRIP":
      return { icon: <ArrowRight size={11} />, label: "Viaje" };
    case "IDLE":
      return { icon: <Pause size={10} />, label: "Ralentí" };
    case "STOP":
      return { icon: <Square size={10} />, label: "Detención" };
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
