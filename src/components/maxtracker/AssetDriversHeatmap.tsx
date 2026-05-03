"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DriverHeatmapResult } from "@/lib/queries/asset-drivers";
import styles from "./AssetDriversHeatmap.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetDriversHeatmap · grilla 1 fila por chofer × N semanas
//  ─────────────────────────────────────────────────────────────
//  Forma B (confirmada por usuario en E5-A):
//    · Filas = choferes (current primero, luego por aparición)
//    · Columnas = semanas (52-53), oldest left, newest right
//    · Color = paleta determinística por chofer (colorSlot 0..5)
//    · Intensidad = km de la semana / maxWeekKm (4 niveles + 0)
//    · Click en celda con datos → navega a /objeto/conductor/[id]
//    · Hover muestra tooltip con nombre, semana y km
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: DriverHeatmapResult;
}

interface CellInfo {
  personId: string;
  personName: string;
  weekStartISO: string;
  km: number;
  days: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  colorSlot: number;
}

export function AssetDriversHeatmap({ data }: Props) {
  const router = useRouter();
  const [hover, setHover] = useState<{
    cell: CellInfo;
    x: number;
    y: number;
  } | null>(null);

  const max = data.maxWeekKm || 1;

  // Build cell lookup: personId → weekStartISO → CellInfo
  const cellByPersonWeek = new Map<string, Map<string, CellInfo>>();
  for (const d of data.drivers) {
    cellByPersonWeek.set(d.personId, new Map());
  }
  for (const w of data.weeks) {
    for (const p of w.byPerson) {
      const intensity = bucketIntensity(p.km / max);
      const driver = data.drivers.find((d) => d.personId === p.personId);
      if (!driver) continue;
      cellByPersonWeek.get(p.personId)!.set(w.weekStartISO, {
        personId: p.personId,
        personName: `${driver.firstName} ${driver.lastName}`,
        weekStartISO: w.weekStartISO,
        km: p.km,
        days: p.days,
        intensity,
        colorSlot: driver.colorSlot,
      });
    }
  }

  // Month dividers · we want vertical separators where the month
  // changes from one week to the next (visual grouping like a
  // calendar grip without explicit labels for every column).
  const monthBoundaries = new Set<string>();
  let lastMonth = -1;
  for (const w of data.weeks) {
    const month = parseInt(w.weekStartISO.slice(5, 7), 10);
    if (lastMonth !== -1 && month !== lastMonth) {
      monthBoundaries.add(w.weekStartISO);
    }
    lastMonth = month;
  }

  const handleCellClick = (cell: CellInfo) => {
    router.push(`/objeto/conductor/${cell.personId}`);
  };

  return (
    <div className={styles.wrap}>
      {/* ── Month axis ──────────────────────────────────────── */}
      <div className={styles.axisRow}>
        <div className={styles.driverColSpacer} />
        <div className={styles.cellsRow}>
          {data.weeks.map((w, idx) => {
            const month = parseInt(w.weekStartISO.slice(5, 7), 10);
            const showLabel =
              idx === 0 || monthBoundaries.has(w.weekStartISO);
            return (
              <div key={w.weekStartISO} className={styles.axisCell}>
                {showLabel && (
                  <span className={styles.axisLabel}>
                    {MONTH_NAMES[month - 1]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Driver rows ─────────────────────────────────────── */}
      {data.drivers.map((driver) => {
        const lookup = cellByPersonWeek.get(driver.personId)!;
        return (
          <div key={driver.personId} className={styles.row}>
            <div className={styles.driverLabel}>
              <button
                type="button"
                className={styles.driverNameBtn}
                onClick={() =>
                  router.push(`/objeto/conductor/${driver.personId}`)
                }
                title={`Ver detalle de ${driver.firstName} ${driver.lastName}`}
              >
                <span
                  className={styles.swatch}
                  data-slot={driver.colorSlot}
                  aria-hidden="true"
                />
                <span className={styles.driverName}>
                  {driver.firstName} {driver.lastName}
                </span>
                {driver.isCurrent && (
                  <span className={styles.currentPill}>Actual</span>
                )}
              </button>
            </div>
            <div className={styles.cellsRow}>
              {data.weeks.map((w) => {
                const cell = lookup.get(w.weekStartISO);
                const isMonthStart = monthBoundaries.has(w.weekStartISO);
                return (
                  <div
                    key={w.weekStartISO}
                    className={`${styles.cell} ${isMonthStart ? styles.monthStart : ""}`}
                    data-slot={cell ? driver.colorSlot : undefined}
                    data-intensity={cell ? cell.intensity : 0}
                    onClick={cell ? () => handleCellClick(cell) : undefined}
                    onMouseEnter={
                      cell
                        ? (e) =>
                            setHover({
                              cell,
                              x: e.clientX,
                              y: e.clientY,
                            })
                        : undefined
                    }
                    onMouseMove={
                      cell
                        ? (e) =>
                            setHover((prev) =>
                              prev
                                ? { ...prev, x: e.clientX, y: e.clientY }
                                : null,
                            )
                        : undefined
                    }
                    onMouseLeave={
                      cell ? () => setHover(null) : undefined
                    }
                    role={cell ? "button" : undefined}
                    aria-label={
                      cell
                        ? `${cell.personName} · semana del ${formatDate(cell.weekStartISO)} · ${cell.km} km`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Legend ──────────────────────────────────────────── */}
      <div className={styles.legendRow}>
        <div className={styles.driverColSpacer} />
        <div className={styles.legend}>
          <span className={styles.legendLabel}>Menos km</span>
          <span
            className={styles.legendCell}
            data-slot="legend"
            data-intensity="1"
          />
          <span
            className={styles.legendCell}
            data-slot="legend"
            data-intensity="2"
          />
          <span
            className={styles.legendCell}
            data-slot="legend"
            data-intensity="3"
          />
          <span
            className={styles.legendCell}
            data-slot="legend"
            data-intensity="4"
          />
          <span className={styles.legendLabel}>Más km</span>
          <span className={styles.legendNote}>
            Color por conductor · intensidad por km de la semana · máx{" "}
            {data.maxWeekKm.toLocaleString("es-AR")} km
          </span>
        </div>
      </div>

      {/* ── Tooltip ─────────────────────────────────────────── */}
      {hover && (
        <div
          className={styles.tooltip}
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className={styles.tooltipName}>{hover.cell.personName}</div>
          <div className={styles.tooltipMeta}>
            Semana del {formatDate(hover.cell.weekStartISO)}
          </div>
          <div className={styles.tooltipStats}>
            {hover.cell.km.toLocaleString("es-AR", {
              maximumFractionDigits: 1,
            })}{" "}
            km · {hover.cell.days}{" "}
            {hover.cell.days === 1 ? "día" : "días"}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function bucketIntensity(ratio: number): 0 | 1 | 2 | 3 | 4 {
  if (ratio <= 0) return 0;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y!.slice(2)}`;
}
