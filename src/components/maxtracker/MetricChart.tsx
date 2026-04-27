"use client";

import { useMemo, useRef, useState } from "react";
import type { TrajectoryPoint } from "@/lib/queries/historicos";
import styles from "./MetricChart.module.css";

// ═══════════════════════════════════════════════════════════════
//  MetricChart
//  ─────────────────────────────────────────────────────────────
//  SVG line/area chart over the day's trajectory, with a metric
//  selector on top: Velocidad / Distancia acumulada / Aceleración.
//
//  Synchronized with the playback cursor: a vertical line marks
//  the current time and a callout shows the current value with
//  units. Click on the chart to seek the cursor.
//
//  All metrics are computed from the same TrajectoryPoint stream
//  so we don't need extra DB columns:
//    · speed       · already on the point
//    · distance    · cumulative haversine
//    · acceleration · delta speed / delta time over rolling window
// ═══════════════════════════════════════════════════════════════

export type MetricKey = "speed" | "distance" | "acceleration";

interface MetricChartProps {
  points: TrajectoryPoint[];
  startAt: Date;
  endAt: Date;
  cursor: number; // 0..1
  onSeek?: (cursor: number) => void;
  /** Initial metric · defaults to "speed" */
  defaultMetric?: MetricKey;
}

interface MetricDef {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  /** How to format a value for callout / max display */
  format: (v: number) => string;
  /** Convert raw points → array of {tFrac, value} for plotting */
  derive: (points: TrajectoryPoint[], startAt: Date, endAt: Date) => DerivedPoint[];
  /** Color for the line */
  color: string;
}

interface DerivedPoint {
  tFrac: number;
  value: number;
}

const MAX_BUCKETS = 200;
const HEIGHT = 80;
const VERT_PADDING = 6;

// ═══════════════════════════════════════════════════════════════
//  Metric definitions
// ═══════════════════════════════════════════════════════════════

const METRICS: Record<MetricKey, MetricDef> = {
  speed: {
    key: "speed",
    label: "Velocidad",
    shortLabel: "Velocidad",
    unit: "km/h",
    format: (v) => `${Math.round(v)}`,
    color: "var(--blu, #2563eb)",
    derive: (points, startAt, endAt) =>
      bucketize(points, startAt, endAt, "max", (p) => p.speedKmh),
  },
  distance: {
    key: "distance",
    label: "Distancia",
    shortLabel: "Distancia",
    unit: "km",
    format: (v) => v.toLocaleString("es-AR", { maximumFractionDigits: 1 }),
    color: "#16a34a",
    derive: (points, startAt, endAt) => {
      // Cumulative distance · haversine between consecutive points
      let cumKm = 0;
      const cumByIdx: number[] = [];
      for (let i = 0; i < points.length; i++) {
        if (i > 0) {
          cumKm += haversineKm(
            points[i - 1]!.lat,
            points[i - 1]!.lng,
            points[i]!.lat,
            points[i]!.lng,
          );
        }
        cumByIdx.push(cumKm);
      }
      const totalMs = endAt.getTime() - startAt.getTime();
      if (totalMs <= 0 || points.length === 0) return [];
      const bucketCount = Math.min(MAX_BUCKETS, points.length);
      const bucketMs = totalMs / bucketCount;
      const out: DerivedPoint[] = [];
      let bucketStart = startAt.getTime();
      let pIdx = 0;
      let lastCum = 0;
      for (let b = 0; b < bucketCount; b++) {
        const bucketEnd = bucketStart + bucketMs;
        while (
          pIdx < points.length &&
          points[pIdx]!.recordedAt.getTime() < bucketEnd
        ) {
          lastCum = cumByIdx[pIdx]!;
          pIdx++;
        }
        out.push({ tFrac: (b + 0.5) / bucketCount, value: lastCum });
        bucketStart = bucketEnd;
      }
      return out;
    },
  },
  acceleration: {
    key: "acceleration",
    label: "Aceleración",
    shortLabel: "Aceleración",
    unit: "km/h/s",
    format: (v) => v.toLocaleString("es-AR", { maximumFractionDigits: 1 }),
    color: "#9333ea",
    derive: (points, startAt, endAt) => {
      // For each point: (speed[i] - speed[i-1]) / (t[i] - t[i-1])
      const totalMs = endAt.getTime() - startAt.getTime();
      if (totalMs <= 0 || points.length < 2) return [];
      const acc: { tFrac: number; value: number }[] = [];
      for (let i = 1; i < points.length; i++) {
        const dt = (points[i]!.recordedAt.getTime() - points[i - 1]!.recordedAt.getTime()) / 1000;
        if (dt <= 0) continue;
        const dv = points[i]!.speedKmh - points[i - 1]!.speedKmh;
        const a = dv / dt;
        acc.push({
          tFrac: (points[i]!.recordedAt.getTime() - startAt.getTime()) / totalMs,
          value: a,
        });
      }
      // Bucketize by max abs value to preserve peaks
      const bucketCount = Math.min(MAX_BUCKETS, acc.length);
      if (bucketCount === 0) return [];
      const bucketWidth = 1 / bucketCount;
      const out: DerivedPoint[] = [];
      let aIdx = 0;
      for (let b = 0; b < bucketCount; b++) {
        const bEnd = (b + 1) * bucketWidth;
        let peak = 0;
        let peakAbs = 0;
        let any = false;
        while (aIdx < acc.length && acc[aIdx]!.tFrac < bEnd) {
          const cur = acc[aIdx]!.value;
          if (Math.abs(cur) > peakAbs) {
            peakAbs = Math.abs(cur);
            peak = cur;
          }
          any = true;
          aIdx++;
        }
        if (any || out.length === 0) {
          out.push({ tFrac: (b + 0.5) * bucketWidth, value: peak });
        } else {
          out.push({ tFrac: (b + 0.5) * bucketWidth, value: 0 });
        }
      }
      return out;
    },
  },
};

const ORDERED_METRICS: MetricKey[] = ["speed", "distance", "acceleration"];

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bucketize(
  points: TrajectoryPoint[],
  startAt: Date,
  endAt: Date,
  agg: "max" | "avg",
  pick: (p: TrajectoryPoint) => number,
): DerivedPoint[] {
  const totalMs = endAt.getTime() - startAt.getTime();
  if (points.length === 0 || totalMs <= 0) return [];
  const bucketCount = Math.min(MAX_BUCKETS, points.length);
  const bucketMs = totalMs / bucketCount;
  const out: DerivedPoint[] = [];
  let bucketStart = startAt.getTime();
  let pIdx = 0;
  for (let b = 0; b < bucketCount; b++) {
    const bucketEnd = bucketStart + bucketMs;
    let acc = agg === "max" ? 0 : 0;
    let count = 0;
    while (
      pIdx < points.length &&
      points[pIdx]!.recordedAt.getTime() < bucketEnd
    ) {
      const v = pick(points[pIdx]!);
      if (agg === "max") {
        if (v > acc) acc = v;
      } else {
        acc += v;
      }
      count++;
      pIdx++;
    }
    let val: number;
    if (count === 0) {
      val = out.length > 0 ? out[out.length - 1]!.value : 0;
    } else if (agg === "max") {
      val = acc;
    } else {
      val = acc / count;
    }
    out.push({ tFrac: (b + 0.5) / bucketCount, value: val });
    bucketStart = bucketEnd;
  }
  return out;
}

function sampleAt(buckets: DerivedPoint[], frac: number): number {
  if (buckets.length === 0) return 0;
  let lo = 0;
  let hi = buckets.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (buckets[mid]!.tFrac <= frac) lo = mid;
    else hi = mid;
  }
  return buckets[lo]!.value;
}

// ═══════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════

export function MetricChart({
  points,
  startAt,
  endAt,
  cursor,
  onSeek,
  defaultMetric = "speed",
}: MetricChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>(defaultMetric);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const totalMs = endAt.getTime() - startAt.getTime();

  const def = METRICS[activeMetric];

  const buckets = useMemo(
    () => def.derive(points, startAt, endAt),
    [def, points, startAt, endAt],
  );

  // ── Compute paths ──────────────────────────────────────
  const { pathD, areaD, maxValue, minValue } = useMemo(() => {
    if (buckets.length === 0) {
      return { pathD: "", areaD: "", maxValue: 0, minValue: 0 };
    }
    let maxV = -Infinity;
    let minV = Infinity;
    for (const b of buckets) {
      if (b.value > maxV) maxV = b.value;
      if (b.value < minV) minV = b.value;
    }
    // For acceleration: use a symmetric scale around 0 so the
    // baseline sits in the middle.
    let yMin: number, yMax: number;
    if (activeMetric === "acceleration") {
      const peak = Math.max(Math.abs(maxV), Math.abs(minV), 1);
      yMin = -peak;
      yMax = peak;
    } else {
      yMin = 0;
      yMax = Math.max(maxV, activeMetric === "speed" ? 60 : 1);
    }
    const W = 1000;
    const H = HEIGHT;
    const yScale = (v: number) => {
      const range = yMax - yMin || 1;
      const norm = (v - yMin) / range;
      return H - VERT_PADDING - norm * (H - 2 * VERT_PADDING);
    };
    const xScale = (f: number) => f * W;

    let path = "";
    let area = "";
    const baselineY = yScale(activeMetric === "acceleration" ? 0 : yMin);
    buckets.forEach((b, i) => {
      const x = xScale(b.tFrac);
      const y = yScale(b.value);
      if (i === 0) {
        path = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        area = `M ${x.toFixed(1)} ${baselineY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        area += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });
    const lastX = xScale(buckets[buckets.length - 1]!.tFrac);
    area += ` L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} Z`;
    return { pathD: path, areaD: area, maxValue: maxV, minValue: minV };
  }, [buckets, activeMetric]);

  if (totalMs <= 0 || buckets.length === 0) return null;

  const currentValue = sampleAt(buckets, cursor);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onSeek || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, frac)));
  }

  // Format max/min footer
  const maxLabel =
    activeMetric === "acceleration"
      ? `pico ${def.format(Math.max(Math.abs(maxValue), Math.abs(minValue)))} ${def.unit}`
      : activeMetric === "distance"
        ? `total ${def.format(maxValue)} ${def.unit}`
        : `máx ${def.format(maxValue)} ${def.unit}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist">
          {ORDERED_METRICS.map((m) => {
            const isActive = m === activeMetric;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                onClick={() => setActiveMetric(m)}
              >
                {METRICS[m].shortLabel}
              </button>
            );
          })}
        </div>
        <span className={styles.headerMax}>{maxLabel}</span>
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
          {/* Grid lines · adapt to symmetric scale */}
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

          {/* Area + line */}
          <path d={areaD} className={styles.area} style={{ fill: def.color, fillOpacity: 0.12 }} />
          <path d={pathD} className={styles.line} style={{ stroke: def.color }} />

          {/* Cursor */}
          <line
            x1={cursor * 1000}
            x2={cursor * 1000}
            y1={0}
            y2={HEIGHT}
            className={styles.cursor}
          />
        </svg>

        <div
          className={styles.callout}
          style={{ left: `${cursor * 100}%` }}
        >
          {def.format(currentValue)} {def.unit}
        </div>
      </div>
    </div>
  );
}
