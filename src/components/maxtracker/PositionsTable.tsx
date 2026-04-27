"use client";

import { useMemo, useRef } from "react";
import { Download } from "lucide-react";
import type {
  TrajectoryEvent,
  TrajectoryPoint,
} from "@/lib/queries/historicos";
import { EVENT_TYPE_LABEL } from "@/lib/format";
import styles from "./PositionsTable.module.css";

// ═══════════════════════════════════════════════════════════════
//  PositionsTable · sábana de posiciones (F2b)
//  ─────────────────────────────────────────────────────────────
//  Lista cronológica densa de todas las posiciones del rango
//  activo (día completo o rango horario · sale del trajectory
//  ya filtrado).
//
//  Columnas: # · Hora · Lat · Lng · Velocidad · Rumbo · Ignición
//            · Eventos · Δ km · Δ tiempo
//
//  Interacciones:
//    · Click en fila  → onSeek(time)  · mueve scrubber
//    · Hover en fila  → onHover(lat,lng) · marker temporal
//    · Botón "Exportar CSV" · descarga el contenido visible
//
//  Performance:
//    · scroll nativo con max-height
//    · si points > MAX_RENDER_ROWS, se muestra un cap visible
//      (todo se incluye en el CSV)
// ═══════════════════════════════════════════════════════════════

const MAX_RENDER_ROWS = 5000;
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

interface Props {
  points: TrajectoryPoint[];
  events: TrajectoryEvent[];
  /** ISO date YYYY-MM-DD del día activo · para el nombre del CSV */
  dateISO: string;
  /** Asset name + plate · para el nombre del CSV */
  assetName: string;
  assetPlate: string | null;
  /** Cursor actual (tiempo) · highlight de fila activa */
  cursorTime: Date | null;
  onSeek: (t: Date) => void;
  /** Optional · marker temporal en el mapa al hover */
  onHover?: (loc: { lat: number; lng: number } | null) => void;
}

interface Row {
  idx: number;
  recordedAt: Date;
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number;
  ignition: boolean;
  /** Eventos que cayeron en este timestamp ± 30 s */
  events: TrajectoryEvent[];
  deltaKm: number;
  deltaMs: number;
}

export function PositionsTable({
  points,
  events,
  dateISO,
  assetName,
  assetPlate,
  cursorTime,
  onSeek,
  onHover,
}: Props) {
  const rows = useMemo(() => buildRows(points, events), [points, events]);
  const total = rows.length;
  const limited = rows.slice(0, MAX_RENDER_ROWS);
  const truncated = total > MAX_RENDER_ROWS;

  const tableRef = useRef<HTMLDivElement>(null);

  function handleExportCsv() {
    const csv = buildCsv(rows);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename(assetName, assetPlate, dateISO);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Find the row index closest to the cursor for highlighting
  const cursorIdx = useMemo(() => {
    if (!cursorTime) return -1;
    const ts = cursorTime.getTime();
    let best = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < limited.length; i++) {
      const d = Math.abs(limited[i]!.recordedAt.getTime() - ts);
      if (d < bestDelta) {
        bestDelta = d;
        best = i;
      }
    }
    return best;
  }, [limited, cursorTime]);

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        Sin posiciones registradas en el rango seleccionado.
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {/* ── Header bar ──────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Posiciones</span>
          <span className={styles.count}>
            {total.toLocaleString("es-AR")}
            {truncated ? ` · mostrando primeras ${MAX_RENDER_ROWS}` : ""}
          </span>
        </div>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={handleExportCsv}
        >
          <Download size={13} />
          <span>Exportar CSV</span>
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className={styles.tableWrap} ref={tableRef}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.alignRight}`}>#</th>
              <th className={styles.th}>Hora</th>
              <th className={`${styles.th} ${styles.alignRight}`}>Lat</th>
              <th className={`${styles.th} ${styles.alignRight}`}>Lng</th>
              <th className={`${styles.th} ${styles.alignRight}`}>
                Vel · km/h
              </th>
              <th className={`${styles.th} ${styles.alignRight}`}>Rumbo</th>
              <th className={styles.th}>Mot.</th>
              <th className={styles.th}>Eventos</th>
              <th className={`${styles.th} ${styles.alignRight}`}>Δ km</th>
              <th className={`${styles.th} ${styles.alignRight}`}>Δ t</th>
            </tr>
          </thead>
          <tbody>
            {limited.map((r, i) => {
              const isCursor = i === cursorIdx;
              return (
                <tr
                  key={r.idx}
                  className={`${styles.row} ${isCursor ? styles.rowActive : ""}`}
                  onClick={() => onSeek(r.recordedAt)}
                  onMouseEnter={() =>
                    onHover?.({ lat: r.lat, lng: r.lng })
                  }
                  onMouseLeave={() => onHover?.(null)}
                >
                  <td className={`${styles.td} ${styles.alignRight}`}>
                    <span className={styles.dim}>{r.idx + 1}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.mono}>
                      {formatTime(r.recordedAt)}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.alignRight}`}>
                    <span className={styles.monoSm}>{r.lat.toFixed(5)}</span>
                  </td>
                  <td className={`${styles.td} ${styles.alignRight}`}>
                    <span className={styles.monoSm}>{r.lng.toFixed(5)}</span>
                  </td>
                  <td className={`${styles.td} ${styles.alignRight}`}>
                    <span
                      className={`${styles.mono} ${
                        r.speedKmh >= 130
                          ? styles.speedRed
                          : r.speedKmh >= 110
                            ? styles.speedAmb
                            : ""
                      }`}
                    >
                      {Math.round(r.speedKmh)}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.alignRight}`}>
                    <span className={styles.monoSm}>
                      {r.heading}° {degToCardinal(r.heading)}
                    </span>
                  </td>
                  <td className={styles.td}>
                    {r.ignition ? (
                      <span className={styles.ignOn}>ON</span>
                    ) : (
                      <span className={styles.ignOff}>OFF</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {r.events.length === 0 ? (
                      <span className={styles.dim}>—</span>
                    ) : (
                      <span className={styles.eventList}>
                        {r.events.map((e) => (
                          <span
                            key={e.id}
                            className={`${styles.eventChip} ${
                              e.severity === "CRITICAL"
                                ? styles.eventCritical
                                : e.severity === "HIGH"
                                  ? styles.eventHigh
                                  : ""
                            }`}
                            title={EVENT_TYPE_LABEL[e.type] ?? e.type}
                          >
                            {EVENT_TYPE_LABEL[e.type] ?? e.type}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.alignRight}`}>
                    {r.deltaKm > 0 ? (
                      <span className={styles.monoSm}>
                        {r.deltaKm.toFixed(2)}
                      </span>
                    ) : (
                      <span className={styles.dim}>—</span>
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.alignRight}`}>
                    {r.deltaMs > 0 ? (
                      <span className={styles.monoSm}>
                        {formatDelta(r.deltaMs)}
                      </span>
                    ) : (
                      <span className={styles.dim}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {truncated && (
          <div className={styles.truncatedHint}>
            Hay {total.toLocaleString("es-AR")} posiciones en total · se
            muestran las primeras {MAX_RENDER_ROWS.toLocaleString("es-AR")}.
            Exportá a CSV para verlas todas.
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Builders
// ═══════════════════════════════════════════════════════════════

function buildRows(
  points: TrajectoryPoint[],
  events: TrajectoryEvent[],
): Row[] {
  // Bucket events by minute key for O(1) lookup per row.
  // We attach an event to a position if it's within ±30 s.
  const eventByKey = new Map<string, TrajectoryEvent[]>();
  for (const e of events) {
    const key = minuteKey(e.occurredAt);
    if (!eventByKey.has(key)) eventByKey.set(key, []);
    eventByKey.get(key)!.push(e);
  }

  const rows: Row[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const prev = i > 0 ? points[i - 1]! : null;
    const deltaKm = prev ? haversineKm(prev.lat, prev.lng, p.lat, p.lng) : 0;
    const deltaMs = prev
      ? p.recordedAt.getTime() - prev.recordedAt.getTime()
      : 0;
    // Look at this minute and the surrounding minute too,
    // catching events near the boundary.
    const evs: TrajectoryEvent[] = [];
    for (const k of [
      minuteKey(p.recordedAt),
      minuteKey(new Date(p.recordedAt.getTime() - 60_000)),
      minuteKey(new Date(p.recordedAt.getTime() + 60_000)),
    ]) {
      const list = eventByKey.get(k);
      if (!list) continue;
      for (const e of list) {
        const dt = Math.abs(e.occurredAt.getTime() - p.recordedAt.getTime());
        if (dt <= 30_000 && !evs.includes(e)) evs.push(e);
      }
    }
    rows.push({
      idx: i,
      recordedAt: p.recordedAt,
      lat: p.lat,
      lng: p.lng,
      speedKmh: p.speedKmh,
      heading: p.heading,
      ignition: p.ignition,
      events: evs,
      deltaKm,
      deltaMs,
    });
  }
  return rows;
}

function buildCsv(rows: Row[]): string {
  const header = [
    "indice",
    "fecha_hora",
    "lat",
    "lng",
    "velocidad_kmh",
    "rumbo_deg",
    "rumbo_cardinal",
    "motor",
    "eventos",
    "delta_km",
    "delta_segundos",
  ].join(";");
  const lines = [header];
  for (const r of rows) {
    const evs = r.events
      .map((e) => `${EVENT_TYPE_LABEL[e.type] ?? e.type} (${e.severity})`)
      .join(" | ");
    lines.push(
      [
        String(r.idx + 1),
        formatIsoLocal(r.recordedAt),
        r.lat.toFixed(6),
        r.lng.toFixed(6),
        Math.round(r.speedKmh).toString(),
        String(r.heading),
        degToCardinal(r.heading),
        r.ignition ? "ON" : "OFF",
        csvEscape(evs),
        r.deltaKm.toFixed(3),
        Math.round(r.deltaMs / 1000).toString(),
      ].join(";"),
    );
  }
  return lines.join("\n");
}

function csvEscape(s: string): string {
  if (s === "") return "";
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvFilename(
  assetName: string,
  assetPlate: string | null,
  dateISO: string,
): string {
  const slug = (assetPlate ?? assetName)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 30);
  return `posiciones_${slug}_${dateISO}.csv`;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function minuteKey(d: Date): string {
  const localMs = d.getTime() - AR_OFFSET_MS;
  return new Date(localMs).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function formatTime(d: Date): string {
  const local = new Date(d.getTime() - AR_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  const ss = String(local.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatIsoLocal(d: Date): string {
  const local = new Date(d.getTime() - AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const da = String(local.getUTCDate()).padStart(2, "0");
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  const ss = String(local.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${da} ${hh}:${mm}:${ss}`;
}

function formatDelta(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

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

const CARDINAL_BINS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

function degToCardinal(deg: number): string {
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return CARDINAL_BINS[idx]!;
}
