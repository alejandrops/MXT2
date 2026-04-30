import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DriverAssetHistoryRow } from "@/lib/queries/driver-asset-history";
import styles from "./DriverAssetHistoryPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverAssetHistoryPanel
//  ─────────────────────────────────────────────────────────────
//  Used in /catalogos/vehiculos/[id]?tab=persona to show the full
//  list of drivers who have driven this vehicle in the recent
//  past, with usage stats and a 84-day GitHub-style mini-heatmap
//  per driver.
//
//  Each row is a Link to the driver's 360 view. The currently
//  assigned driver is pinned to the top with a "Actual" badge.
//
//  Data shape comes from getDriverAssetHistory(assetId) which
//  attributes trips to drivers via event-overlap heuristic (see
//  query for details · the schema doesn't yet have a per-trip
//  driver field, this is the honest demo behavior).
//
//  Empty states:
//    · zero drivers       → empty state explainer
//    · one driver, zero
//      trips (only the
//      current assignment) → row renders with "Sin actividad
//                            registrada · 0 viajes"
//
//  Visual reference: Samsara driver-by-vehicle history (similar
//  drilldown · this panel takes the same shape).
// ═══════════════════════════════════════════════════════════════

interface DriverAssetHistoryPanelProps {
  rows: DriverAssetHistoryRow[];
}

export function DriverAssetHistoryPanel({
  rows,
}: DriverAssetHistoryPanelProps) {
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Este vehículo no tiene conductores con historial reciente.</p>
        <p className={styles.emptyHint}>
          La actividad se registra cuando un conductor asignado dispara
          eventos o alarmas operando este vehículo.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {rows.map((r) => (
        <DriverHistoryCard key={r.driverId} row={r} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DriverHistoryCard · single row
// ═══════════════════════════════════════════════════════════════

function DriverHistoryCard({ row }: { row: DriverAssetHistoryRow }) {
  const fullName = `${row.firstName} ${row.lastName}`;
  const initials = (row.firstName[0] ?? "?") + (row.lastName[0] ?? "");
  const scoreClass = scoreAccent(row.safetyScore);

  return (
    <Link
      href={`/catalogos/conductores/${row.driverId}`}
      className={styles.card}
    >
      {/* ── Identity column ─────────────────────────────── */}
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">
          {initials.toUpperCase()}
        </span>
        <div className={styles.nameBlock}>
          <span className={styles.name}>{fullName}</span>
          <div className={styles.metaLine}>
            {row.isCurrent && (
              <span className={styles.currentPill}>Actual</span>
            )}
            <span className={`${styles.scorePill} ${scoreClass}`}>
              Score {row.safetyScore}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats column ────────────────────────────────── */}
      <dl className={styles.stats}>
        <Stat
          value={row.totalTrips.toString()}
          label="viajes"
        />
        <Stat
          value={Math.round(row.totalKm).toLocaleString("es-AR")}
          label="km"
        />
        <Stat
          value={formatHours(row.totalDurationMs)}
          label="al volante"
        />
        <Stat
          value={row.totalDays.toString()}
          label={row.totalDays === 1 ? "día" : "días"}
        />
      </dl>

      {/* ── Heatmap column ──────────────────────────────── */}
      <div className={styles.heatmapCol}>
        <Heatmap cells={row.heatmap} />
        <span className={styles.heatmapCaption}>
          {row.lastActivityAt
            ? `Última actividad ${formatRelative(row.lastActivityAt)}`
            : "Sin actividad en 12 semanas"}
        </span>
      </div>

      <ChevronRight className={styles.chev} size={16} aria-hidden="true" />
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Heatmap · 12 cols × 7 rows · 84 cells
// ═══════════════════════════════════════════════════════════════

// Cyan ramp · matches ActivityHeatmap for visual coherence
const COLOR_BY_LEVEL = [
  "rgba(15, 23, 42, 0.05)", // 0 · empty
  "#C7E3EA",                 // 1
  "#7FBDC9",                 // 2
  "#0891B2",                 // 3 · base cyan
  "#0E7490",                 // 4 · darkest
];

function levelFor(trips: number, max: number): number {
  if (trips <= 0) return 0;
  if (max <= 1) return 4; // any activity at all = max if we never see >1
  // Quartile-ish: divide non-zero range into 4 buckets
  const ratio = trips / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function Heatmap({
  cells,
}: {
  cells: { date: string; trips: number }[];
}) {
  // Determine max trips/day for intensity scaling
  let max = 0;
  for (const c of cells) if (c.trips > max) max = c.trips;

  // Cells are oldest → newest. Render as a 12-column × 7-row grid.
  // Column = week index, row = day-of-week of that date.
  // We compute the day-of-week from the date string (UTC parsed,
  // good enough for AR which is a fixed offset).
  return (
    <div
      className={styles.heatmapGrid}
      role="img"
      aria-label="Actividad de las últimas 12 semanas"
    >
      {cells.map((c, idx) => {
        const col = Math.floor(idx / 7) + 1; // 1..12
        const row = (idx % 7) + 1; // 1..7
        const lvl = levelFor(c.trips, max);
        return (
          <span
            key={c.date}
            className={styles.heatCell}
            style={{
              gridColumn: col,
              gridRow: row,
              background: COLOR_BY_LEVEL[lvl],
            }}
            title={
              c.trips === 0
                ? `${c.date} · sin viajes`
                : `${c.date} · ${c.trips} viaje${c.trips === 1 ? "" : "s"}`
            }
          />
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.stat}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={styles.statValue}>{value}</dd>
    </div>
  );
}

function formatHours(ms: number): string {
  if (ms <= 0) return "0h";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "hace instantes";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

function scoreAccent(score: number): string {
  if (score >= 80) return styles.scoreGood ?? "";
  if (score >= 60) return styles.scoreWarn ?? "";
  return styles.scoreBad ?? "";
}
