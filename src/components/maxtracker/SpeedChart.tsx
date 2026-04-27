"use client";

import { useMemo, useRef } from "react";
import type { TrajectoryPoint } from "@/lib/queries/historicos";
import styles from "./SpeedChart.module.css";

// ═══════════════════════════════════════════════════════════════
//  SpeedChart
//  ─────────────────────────────────────────────────────────────
//  SVG line chart showing speed (km/h) over time across the day.
//  Synchronized with the playback cursor: a vertical line marks
//  the current time and a callout shows the current speed.
//
//  Click anywhere on the chart to seek the cursor to that time.
//
//  We sample the points down to ~200 buckets if there are many
//  more, to keep the SVG light without losing the shape of the
//  curve. Each bucket holds the max speed in its time window —
//  preserves peaks better than averaging would.
// ═══════════════════════════════════════════════════════════════

interface SpeedChartProps {
  points: TrajectoryPoint[];
  startAt: Date;
  endAt: Date;
  cursor: number; // 0..1
  onSeek?: (cursor: number) => void;
}

const MAX_BUCKETS = 200;
const HEIGHT = 80;
const VERT_PADDING = 6;

export function SpeedChart({
  points,
  startAt,
  endAt,
  cursor,
  onSeek,
}: SpeedChartProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const totalMs = endAt.getTime() - startAt.getTime();

  // Bucketize for clean rendering
  const buckets = useMemo(() => {
    if (points.length === 0 || totalMs <= 0) return [];
    const bucketCount = Math.min(MAX_BUCKETS, points.length);
    const bucketMs = totalMs / bucketCount;
    const result: { tFrac: number; speed: number }[] = [];
    let bucketStart = startAt.getTime();
    let pIdx = 0;
    for (let b = 0; b < bucketCount; b++) {
      const bucketEnd = bucketStart + bucketMs;
      let max = 0;
      let any = false;
      while (
        pIdx < points.length &&
        points[pIdx]!.recordedAt.getTime() < bucketEnd
      ) {
        const sp = points[pIdx]!.speedKmh;
        if (sp > max) max = sp;
        any = true;
        pIdx++;
      }
      // If no points in this bucket, fall back to interpolating
      // by carrying forward the previous max (visually flat).
      if (!any && result.length > 0) {
        max = result[result.length - 1]!.speed;
      }
      result.push({
        tFrac: (b + 0.5) / bucketCount,
        speed: max,
      });
      bucketStart = bucketEnd;
    }
    return result;
  }, [points, startAt, endAt, totalMs]);

  // Compute SVG path
  const { pathD, areaD, maxSpeed } = useMemo(() => {
    if (buckets.length === 0) {
      return { pathD: "", areaD: "", maxSpeed: 0 };
    }
    const max = Math.max(...buckets.map((b) => b.speed), 60);
    const W = 1000; // virtual width · viewBox
    const H = HEIGHT;
    const yScale = (s: number) =>
      H - VERT_PADDING - (s / max) * (H - 2 * VERT_PADDING);
    const xScale = (f: number) => f * W;

    let path = "";
    let area = "";
    buckets.forEach((b, i) => {
      const x = xScale(b.tFrac);
      const y = yScale(b.speed);
      if (i === 0) {
        path = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        area = `M ${x.toFixed(1)} ${H} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        area += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });
    if (buckets.length > 0) {
      const lastX = xScale(buckets[buckets.length - 1]!.tFrac);
      area += ` L ${lastX.toFixed(1)} ${H} Z`;
    }
    return { pathD: path, areaD: area, maxSpeed: max };
  }, [buckets]);

  if (totalMs <= 0 || buckets.length === 0) return null;

  // Current speed at cursor (for callout)
  const currentSpeed = sampleSpeed(buckets, cursor);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSeek || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, frac)));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Velocidad (km/h)</span>
        <span className={styles.legendMax}>máx {Math.round(maxSpeed)}</span>
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        onClick={handleClick}
        title="Click para saltar a ese momento"
      >
        <svg
          viewBox={`0 0 1000 ${HEIGHT}`}
          preserveAspectRatio="none"
          className={styles.svg}
          aria-hidden="true"
        >
          {/* Grid lines: 0, 50%, 100% of max */}
          <line
            x1="0"
            x2="1000"
            y1={HEIGHT - VERT_PADDING}
            y2={HEIGHT - VERT_PADDING}
            className={styles.grid}
          />
          <line
            x1="0"
            x2="1000"
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            className={styles.grid}
            strokeDasharray="2 3"
          />

          {/* Area fill */}
          <path d={areaD} className={styles.area} />
          {/* Line */}
          <path d={pathD} className={styles.line} />

          {/* Cursor */}
          <line
            x1={cursor * 1000}
            x2={cursor * 1000}
            y1={0}
            y2={HEIGHT}
            className={styles.cursor}
          />
        </svg>

        {/* Speed callout near cursor */}
        <div
          className={styles.callout}
          style={{ left: `${cursor * 100}%` }}
        >
          {Math.round(currentSpeed)} km/h
        </div>
      </div>
    </div>
  );
}

function sampleSpeed(
  buckets: { tFrac: number; speed: number }[],
  frac: number,
): number {
  if (buckets.length === 0) return 0;
  // Find closest bucket by tFrac
  let lo = 0;
  let hi = buckets.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (buckets[mid]!.tFrac <= frac) lo = mid;
    else hi = mid;
  }
  return buckets[lo]!.speed;
}
