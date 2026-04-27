"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ActivityHeatmap as HeatmapData } from "@/lib/queries/activity-heatmap";
import styles from "./ActivityHeatmap.module.css";

// ═══════════════════════════════════════════════════════════════
//  ActivityHeatmap · enterprise-style yearly activity grid
//  ─────────────────────────────────────────────────────────────
//  Renders the last 365 days as a 53×7 grid of cells colored by
//  one of 3 selectable metrics: km / tiempo activo / eventos.
//  Color ramp uses Maxtracker's cyan family (matches v8 demo).
//
//  Features:
//    · Metric selector (3 tabs at top)
//    · Quintile-based intensity (4 active levels + zero)
//    · Rich tooltip: date · km · hours · events
//    · Click navigates to /seguimiento/historial of that day
//    · Month labels on top, day labels (L/M/V) on left
// ═══════════════════════════════════════════════════════════════

interface ActivityHeatmapProps {
  data: HeatmapData;
  /** If provided, clicking a day navigates to that asset's day in Históricos. */
  linkAssetId?: string | null;
  /** Optional title override */
  title?: string;
}

type MetricKey = "km" | "active" | "events";

interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  /** Pull the value from a HeatmapDay */
  pick: (d: HeatmapData["days"][number]) => number;
  /** Format for tooltip / total */
  format: (v: number) => string;
}

const METRICS: Record<MetricKey, MetricDef> = {
  km: {
    key: "km",
    label: "Kilómetros",
    unit: "km",
    pick: (d) => d.km,
    format: (v) => v.toLocaleString("es-AR", { maximumFractionDigits: 0 }),
  },
  active: {
    key: "active",
    label: "Tiempo activo",
    unit: "h",
    pick: (d) => d.activeMinutes,
    format: (v) => formatMinutes(v),
  },
  events: {
    key: "events",
    label: "Eventos",
    unit: "ev",
    pick: (d) => d.eventCount,
    format: (v) => v.toLocaleString("es-AR"),
  },
};

const ORDERED_METRICS: MetricKey[] = ["km", "active", "events"];

// Cyan ramp · light → dark · matches v8 demo (#0891B2 base)
// Level 0 is empty (no activity), levels 1-4 are quintile-based
const COLOR_BY_LEVEL = [
  "rgba(15, 23, 42, 0.05)", // 0 · empty / no activity
  "#C7E3EA",                 // 1 · lightest
  "#9DD1DE",                 // 2
  "#5BB3C4",                 // 3
  "#0891B2",                 // 4 · darkest
];

const DOW_LABELS = ["L", "", "M", "", "V", "", ""]; // Mon, Wed, Fri visible
const MONTH_FULL = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const MONTH_SHORT_CAP = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function ActivityHeatmap({
  data,
  linkAssetId,
  title = "Actividad · Últimos 12 meses",
}: ActivityHeatmapProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("km");
  const def = METRICS[activeMetric];

  // ── Compute quintile thresholds for the active metric ─────
  // Excludes zeros so single high day doesn't dilute everything.
  const thresholds = useMemo(() => {
    const positives = data.days
      .map(def.pick)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (positives.length === 0) return [0, 1, 2, 3];
    return [
      positives[Math.floor(positives.length * 0.25)] ?? 1,
      positives[Math.floor(positives.length * 0.5)] ?? 2,
      positives[Math.floor(positives.length * 0.75)] ?? 3,
      positives[Math.floor(positives.length * 0.9)] ?? 4,
    ];
  }, [data.days, def]);

  function levelFor(value: number): number {
    if (value <= 0) return 0;
    if (value <= thresholds[0]!) return 1;
    if (value <= thresholds[1]!) return 2;
    if (value <= thresholds[2]!) return 3;
    return 4;
  }

  // ── Layout cells into columns × 7 rows (Mon=top, Sun=bottom) ──
  const cells = useMemo(() => {
    const out: {
      day: HeatmapData["days"][number];
      level: number;
      column: number;
      row: number;
    }[] = [];
    const firstDayOfWeek = data.startDayOfWeek; // 0=Sun
    let column = 1;
    for (let i = 0; i < data.days.length; i++) {
      const day = data.days[i]!;
      const dow = (firstDayOfWeek + i) % 7;
      const row = ((dow + 6) % 7) + 1; // Mon = 1, Sun = 7
      if (i > 0 && row === 1) column++;
      out.push({
        day,
        level: levelFor(def.pick(day)),
        column,
        row,
      });
    }
    return out;
  }, [data, thresholds, def]);

  const totalColumns = useMemo(() => {
    let max = 1;
    for (const c of cells) if (c.column > max) max = c.column;
    return max;
  }, [cells]);

  // ── Month labels: anchor to first cell of each month ──────
  const monthAnchors = useMemo(() => {
    const anchors: { col: number; label: string }[] = [];
    let lastMonth = -1;
    for (const c of cells) {
      const m = parseInt(c.day.date.slice(5, 7), 10) - 1;
      if (m !== lastMonth) {
        anchors.push({ col: c.column, label: MONTH_SHORT_CAP[m]! });
        lastMonth = m;
      }
    }
    // Drop very first anchor if it's too close to the start (avoids
    // partial-month label overlapping with next one)
    if (anchors.length > 1 && anchors[1]!.col - anchors[0]!.col < 2) {
      return anchors.slice(1);
    }
    return anchors;
  }, [cells]);

  // ── Hover tooltip state ─────────────────────────────────
  const [hover, setHover] = useState<{
    cell: (typeof cells)[number];
    x: number;
    y: number;
  } | null>(null);

  // ── Header summary ──────────────────────────────────────
  const headerStats = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      `${data.totalKm.toLocaleString("es-AR")} km`,
      formatMinutes(data.totalActiveMinutes),
    );
    if (data.totalEvents > 0) {
      parts.push(`${data.totalEvents} eventos`);
    }
    parts.push(`${data.activeDays} días activos`);
    return parts.join(" · ");
  }, [data]);

  return (
    <section className={styles.wrap}>
      {/* ── Header: title + metric selector + total ──────── */}
      <div className={styles.headerRow}>
        <span className={styles.title}>{title}</span>
        <span className={styles.headerStats}>{headerStats}</span>
      </div>

      <div className={styles.subHeader}>
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
                {METRICS[m].label}
              </button>
            );
          })}
        </div>

        {/* Legend · Less → More */}
        <div className={styles.legend}>
          <span className={styles.legendLabel}>Menos</span>
          {COLOR_BY_LEVEL.slice(1).map((c, i) => (
            <span
              key={i}
              className={styles.legendCell}
              style={{ background: c }}
              aria-hidden="true"
            />
          ))}
          <span className={styles.legendLabel}>Más</span>
        </div>
      </div>

      {/* ── Grid layout ─────────────────────────────────── */}
      <div className={styles.grid}>
        {/* DOW labels column */}
        <div className={styles.dowCol}>
          <div className={styles.monthSpacer} aria-hidden="true" />
          {DOW_LABELS.map((lbl, i) => (
            <span
              key={i}
              className={styles.dowLabel}
              style={{ gridRow: i + 1 }}
            >
              {lbl}
            </span>
          ))}
        </div>

        {/* Main column · months row + cells */}
        <div className={styles.body}>
          <div
            className={styles.months}
            style={{
              gridTemplateColumns: `repeat(${totalColumns}, var(--cell-size))`,
              columnGap: "var(--cell-gap)",
            }}
          >
            {monthAnchors.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className={styles.monthLabel}
                style={{ gridColumn: m.col }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div
            className={styles.cellGrid}
            style={{
              gridTemplateColumns: `repeat(${totalColumns}, var(--cell-size))`,
            }}
          >
            {cells.map((c) => {
              const baseColor = COLOR_BY_LEVEL[c.level]!;
              const cellStyle = {
                gridColumn: c.column,
                gridRow: c.row,
                background: baseColor,
                opacity: c.day.isReal ? 1 : 0.85,
              } as React.CSSProperties;

              const handleEnter = (e: React.MouseEvent<HTMLElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const wrapEl = e.currentTarget.closest(
                  `.${styles.wrap}`,
                ) as HTMLElement | null;
                const wrapRect =
                  wrapEl?.getBoundingClientRect() ?? rect;
                setHover({
                  cell: c,
                  x: rect.left - wrapRect.left + rect.width / 2,
                  y: rect.top - wrapRect.top - 6,
                });
              };
              const handleLeave = () => setHover(null);

              const hasActivity =
                c.day.km > 0 || c.day.activeMinutes > 0 || c.day.eventCount > 0;

              if (linkAssetId && hasActivity) {
                return (
                  <Link
                    key={c.day.date}
                    href={`/seguimiento/historial?assetId=${linkAssetId}&date=${c.day.date}`}
                    className={styles.cell}
                    style={cellStyle}
                    aria-label={shortLabel(c.day, def)}
                    onMouseEnter={handleEnter}
                    onMouseLeave={handleLeave}
                  />
                );
              }
              return (
                <span
                  key={c.day.date}
                  className={styles.cell}
                  style={cellStyle}
                  aria-label={shortLabel(c.day, def)}
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Rich tooltip · all 3 dimensions on hover ───── */}
      {hover && (
        <div
          className={styles.tooltip}
          style={{ left: `${hover.x}px`, top: `${hover.y}px` }}
        >
          <div className={styles.tooltipDate}>
            {formatDateAr(hover.cell.day.date)}
          </div>
          <div className={styles.tooltipRows}>
            <TooltipRow
              label="Kilómetros"
              value={`${hover.cell.day.km.toLocaleString("es-AR")} km`}
              highlight={activeMetric === "km"}
            />
            <TooltipRow
              label="Tiempo activo"
              value={formatMinutes(hover.cell.day.activeMinutes)}
              highlight={activeMetric === "active"}
            />
            <TooltipRow
              label="Eventos"
              value={hover.cell.day.eventCount.toLocaleString("es-AR")}
              highlight={activeMetric === "events"}
              dim={hover.cell.day.eventCount === 0}
            />
          </div>
          {!hover.cell.day.isReal && (
            <div className={styles.tooltipNote}>estimado</div>
          )}
          {linkAssetId &&
            (hover.cell.day.km > 0 ||
              hover.cell.day.activeMinutes > 0 ||
              hover.cell.day.eventCount > 0) && (
              <div className={styles.tooltipHint}>Click para ver el día</div>
            )}
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function TooltipRow({
  label,
  value,
  highlight,
  dim,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`${styles.tooltipRow} ${highlight ? styles.tooltipRowHighlight : ""}`}
    >
      <span className={styles.tooltipRowLabel}>{label}</span>
      <span
        className={`${styles.tooltipRowValue} ${dim ? styles.tooltipRowValueDim : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

const DOW_FULL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function formatDateAr(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = DOW_FULL[date.getUTCDay()]!;
  return `${dow} ${String(d).padStart(2, "0")} ${MONTH_FULL[m - 1]!} ${y}`;
}

function formatMinutes(min: number): string {
  if (min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function shortLabel(
  day: HeatmapData["days"][number],
  def: MetricDef,
): string {
  const date = formatDateAr(day.date);
  const value = def.format(def.pick(day));
  return `${date} · ${value} ${def.unit}${day.isReal ? "" : " (estimado)"}`;
}
