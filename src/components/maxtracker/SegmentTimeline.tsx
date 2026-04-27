"use client";

import { useRef } from "react";
import type { Segment } from "@/lib/queries/historicos";
import styles from "./SegmentTimeline.module.css";

// ═══════════════════════════════════════════════════════════════
//  SegmentTimeline
//  ─────────────────────────────────────────────────────────────
//  Compact horizontal Gantt-style view of the day's segments.
//  Goes between the map and the playback scrubber. Each segment
//  is a colored block proportional to its duration. Hover for
//  tooltip. Click to seek the cursor to its start.
//
//  The cursor is rendered as a vertical line at the current
//  fractional position in the day.
// ═══════════════════════════════════════════════════════════════

interface SegmentTimelineProps {
  segments: Segment[];
  startAt: Date;
  endAt: Date;
  cursor: number; // 0..1
  onSegmentClick?: (segment: Segment) => void;
}

export function SegmentTimeline({
  segments,
  startAt,
  endAt,
  cursor,
  onSegmentClick,
}: SegmentTimelineProps) {
  const totalMs = endAt.getTime() - startAt.getTime();
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (totalMs <= 0 || segments.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={`${styles.dot} ${styles.dotTRIP}`} /> Viajes
        <span className={`${styles.dot} ${styles.dotIDLE}`} /> Ralentí
        <span className={`${styles.dot} ${styles.dotSTOP}`} /> Detención
      </div>
      <div className={styles.track} ref={trackRef}>
        {segments.map((s) => {
          const segStart = new Date(s.startAt).getTime();
          const segEnd = new Date(s.endAt).getTime();
          const left =
            ((segStart - startAt.getTime()) / totalMs) * 100;
          const width = ((segEnd - segStart) / totalMs) * 100;
          return (
            <button
              key={s.id}
              type="button"
              className={`${styles.block} ${styles[`kind${s.kind}`]}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onSegmentClick?.(s)}
              title={describeSegment(s)}
            />
          );
        })}
        {/* Cursor */}
        <div
          className={styles.cursor}
          style={{ left: `${cursor * 100}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function describeSegment(s: Segment): string {
  const kindLabel =
    s.kind === "TRIP"
      ? "Viaje"
      : s.kind === "IDLE"
        ? "Ralentí"
        : "Detención";
  const start = formatTime(new Date(s.startAt));
  const end = formatTime(new Date(s.endAt));
  const dur = formatDur(s.durationMs);
  const extra =
    s.kind === "TRIP" && s.distanceKm > 0
      ? ` · ${s.distanceKm.toFixed(1)} km`
      : "";
  return `${kindLabel}  ${start} → ${end}  (${dur})${extra}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDur(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
