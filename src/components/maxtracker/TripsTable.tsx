"use client";

import { ArrowDown, ArrowUp, ChevronRight, MapPin, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { TripRow } from "@/lib/queries/trips";
import { formatDuration } from "@/lib/format";
import {
  arLocalTimeHHMM,
  buildHistoricosHref,
} from "@/lib/url-historicos";
import {
  buildTripsHref,
  type SortKey,
  type TripsParams,
} from "@/lib/url-trips";
import styles from "./TripsTable.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripsTable · cross-fleet trip listing
//  ─────────────────────────────────────────────────────────────
//  Click on a row → navigates to /seguimiento/historial?assetId
//  =X&date=Y so the user can replay that day with the scrubber
//  positioned roughly at the trip's start.
//
//  Sort is URL-driven · clicking a sortable header navigates to
//  the same page with sort/dir params changed. Sort is applied
//  client-side over the trips array (no re-fetch needed).
// ═══════════════════════════════════════════════════════════════

interface TripsTableProps {
  trips: TripRow[];
  /** highlight a trip row (e.g. when hovered on the map) */
  highlightedTripId?: string | null;
  onHoverTrip?: (id: string | null) => void;
  /** Current URL state · used to preserve filters when sorting */
  sortParams: TripsParams;
  /**
   * Optional override for sort header href construction. Defaults to
   * `buildTripsHref` which targets `/seguimiento/viajes`. Pass a custom
   * builder when embedding this table elsewhere (e.g. the Histórico
   * tab inside a vehicle's 360 view) so sort clicks stay on the
   * current surface.
   */
  buildSortHref?: (
    current: TripsParams,
    override: Partial<TripsParams>,
  ) => string;
}

interface SortableColumn {
  key: SortKey;
  label: string;
  align: "left" | "right" | "center";
  defaultDir: "asc" | "desc";
}

const COLUMNS: SortableColumn[] = [
  { key: "asset", label: "Vehículo", align: "left", defaultDir: "asc" },
  { key: "driver", label: "Conductor", align: "left", defaultDir: "asc" },
  { key: "startedAt", label: "Inicio", align: "left", defaultDir: "desc" },
  // "Fin" follows the same direction as "Inicio" so we don't add a
  // separate sort key; users sort by start time and the table stays
  // chronological end-to-end.
  { key: "duration", label: "Duración", align: "right", defaultDir: "desc" },
  { key: "distance", label: "Distancia", align: "right", defaultDir: "desc" },
  // avg/max speed and idle are not sortable to keep the URL surface
  // small · most users sort by date or distance
  { key: "events", label: "Eventos", align: "center", defaultDir: "desc" },
];

export function TripsTable({
  trips,
  highlightedTripId,
  onHoverTrip,
  sortParams,
  buildSortHref = buildTripsHref,
}: TripsTableProps) {
  const router = useRouter();

  // ── Apply sort client-side ───────────────────────────────
  const sortedTrips = useMemo(() => {
    const arr = [...trips];
    const { sort, sortDir } = sortParams;
    const mult = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort) {
        case "asset":
          return mult * a.assetName.localeCompare(b.assetName, "es");
        case "driver":
          return (
            mult *
            (a.driverName ?? "").localeCompare(b.driverName ?? "", "es")
          );
        case "distance":
          return mult * (a.distanceKm - b.distanceKm);
        case "duration":
          return mult * (a.durationMs - b.durationMs);
        case "events":
          return mult * (a.eventCount - b.eventCount);
        case "startedAt":
        default:
          return mult * (a.startedAt.getTime() - b.startedAt.getTime());
      }
    });
    return arr;
  }, [trips, sortParams.sort, sortParams.sortDir]);

  function onSort(col: SortableColumn) {
    let nextDir: "asc" | "desc";
    if (sortParams.sort === col.key) {
      // Same column · toggle direction
      nextDir = sortParams.sortDir === "asc" ? "desc" : "asc";
    } else {
      // New column · use its default direction
      nextDir = col.defaultDir;
    }
    router.push(buildSortHref(sortParams, { sort: col.key, sortDir: nextDir }));
  }

  if (trips.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No hay viajes en el rango seleccionado.</p>
        <p className={styles.emptyHint}>
          Probá ampliar el rango de fechas o quitar los filtros.
        </p>
      </div>
    );
  }

  function renderSortHeader(col: SortableColumn) {
    const active = sortParams.sort === col.key;
    const Arrow = sortParams.sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        className={`${styles.thButton} ${active ? styles.thButtonActive : ""}`}
        onClick={() => onSort(col)}
      >
        {col.label}
        {active ? (
          <Arrow size={10} className={styles.thArrow} />
        ) : (
          <span className={styles.thArrowSpacer} aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thLeft}>{renderSortHeader(COLUMNS[0]!)}</th>
            <th className={styles.thLeft}>{renderSortHeader(COLUMNS[1]!)}</th>
            <th className={styles.thLeft}>{renderSortHeader(COLUMNS[2]!)}</th>
            <th className={styles.thLeft}>Fin</th>
            <th className={styles.thRight}>{renderSortHeader(COLUMNS[3]!)}</th>
            <th className={styles.thRight}>{renderSortHeader(COLUMNS[4]!)}</th>
            <th className={styles.thRight}>Vel. prom</th>
            <th className={styles.thRight}>Vel. máx</th>
            <th className={styles.thRight}>Ralentí</th>
            <th className={styles.thCenter}>{renderSortHeader(COLUMNS[5]!)}</th>
            <th aria-label="Abrir" />
          </tr>
        </thead>
        <tbody>
          {sortedTrips.map((t) => {
            const date = ymd(t.startedAt);
            // F2: pass the trip's start/end as HH:MM so the historial
            // page lands clipped exactly to this trip. The user can
            // widen the range from the time inputs if needed.
            const fromTime = arLocalTimeHHMM(t.startedAt);
            const toTime = arLocalTimeHHMM(t.endedAt);
            const href = buildHistoricosHref(
              { assetId: null, date: null, fromTime: null, toTime: null },
              {
                assetId: t.assetId,
                date,
                fromTime,
                toTime: fromTime < toTime ? toTime : null,
              },
            );
            const isHi = highlightedTripId === t.id;
            return (
              <tr
                key={t.id}
                className={`${styles.row} ${isHi ? styles.rowHi : ""}`}
                onMouseEnter={() => onHoverTrip?.(t.id)}
                onMouseLeave={() => onHoverTrip?.(null)}
              >
                <td className={styles.tdLeft}>
                  <Link className={styles.assetLink} href={href}>
                    <span className={styles.assetName}>{t.assetName}</span>
                    {t.assetPlate && (
                      <span className={styles.assetPlate}>{t.assetPlate}</span>
                    )}
                  </Link>
                </td>
                <td className={styles.tdLeft}>
                  {t.driverName ? (
                    <span className={styles.driver}>
                      <User size={11} className={styles.driverIcon} />
                      {t.driverName}
                    </span>
                  ) : (
                    <span className={styles.noDriver}>—</span>
                  )}
                </td>
                <td className={styles.tdLeft}>
                  <DateTimeCell date={t.startedAt} />
                </td>
                <td className={styles.tdLeft}>
                  <DateTimeCell date={t.endedAt} />
                </td>
                <td className={styles.tdRight}>
                  <span className={styles.numeric}>
                    {formatDuration(t.durationMs)}
                  </span>
                </td>
                <td className={styles.tdRight}>
                  <span className={styles.numeric}>
                    {t.distanceKm.toLocaleString("es-AR", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    <span className={styles.unit}>km</span>
                  </span>
                </td>
                <td className={styles.tdRight}>
                  <span className={styles.numeric}>
                    {Math.round(t.avgSpeedKmh)}{" "}
                    <span className={styles.unit}>km/h</span>
                  </span>
                </td>
                <td className={styles.tdRight}>
                  <span
                    className={`${styles.numeric} ${
                      t.maxSpeedKmh >= 110 ? styles.speedWarn : ""
                    } ${t.maxSpeedKmh >= 130 ? styles.speedCrit : ""}`}
                  >
                    {Math.round(t.maxSpeedKmh)}{" "}
                    <span className={styles.unit}>km/h</span>
                  </span>
                </td>
                <td className={styles.tdRight}>
                  <span className={styles.numericMuted}>
                    {formatDuration(t.idleMs)}
                  </span>
                </td>
                <td className={styles.tdCenter}>
                  {t.eventCount > 0 ? (
                    <span
                      className={`${styles.eventBadge} ${
                        t.highSeverityEventCount > 0
                          ? styles.eventBadgeWarn
                          : ""
                      }`}
                    >
                      {t.eventCount}
                    </span>
                  ) : (
                    <span className={styles.eventNone}>—</span>
                  )}
                </td>
                <td className={styles.tdAction}>
                  <Link className={styles.actionLink} href={href}>
                    <ChevronRight size={13} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function DateTimeCell({ date }: { date: Date }) {
  const d = new Date(date);
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const dateStr = local.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
  const timeStr = local.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return (
    <div className={styles.dateTime}>
      <span className={styles.dateStr}>{dateStr}</span>
      <span className={styles.timeStr}>{timeStr}</span>
    </div>
  );
}

function ymd(date: Date): string {
  const localMs = date.getTime() - 3 * 60 * 60 * 1000;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
