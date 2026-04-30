"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  AnalysisGranularity,
  ColLabel,
  FleetAnalysisData,
  FleetCell,
  FleetRow,
} from "@/lib/queries/analysis";
import styles from "./FleetHeatmap.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetHeatmap · matriz uniforme (vehículos × subdivisiones)
//  ─────────────────────────────────────────────────────────────
//  Estilo GitHub contributions:
//    · Celdas cuadradas redondeadas (12-14px)
//    · 5 niveles de intensidad azul
//    · Today con outline azul
//    · Weekend con tinte naranja sutil
//    · Hover muestra tooltip
//    · Click en celda con drillTo → drill-down
//
//  Cambia solo cantidad de columnas según granularidad. Mismas
//  dimensiones de celda en todas las vistas.
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: FleetAnalysisData;
  onDrill: (date: string, drillTo: AnalysisGranularity) => void;
  formatValue: (v: number) => string;
}

export function FleetHeatmap({ data, onDrill, formatValue }: Props) {
  const [hover, setHover] = useState<{
    cell: FleetCell;
    row: FleetRow;
    x: number;
    y: number;
  } | null>(null);

  const layout = layoutForGranularity(data.granularity, data.colCount);

  function bucket(v: number): 0 | 1 | 2 | 3 | 4 {
    if (v <= 0 || data.maxCellValue <= 0) return 0;
    const r = v / data.maxCellValue;
    if (r < 0.1) return 1;
    if (r < 0.35) return 2;
    if (r < 0.7) return 3;
    return 4;
  }

  return (
    <div className={styles.wrap}>
      <div
        className={styles.scroll}
        style={{
          // CSS variables · controlan tamaño de celda
          ["--cell-w" as any]: `${layout.cellW}px`,
          ["--cell-h" as any]: `${layout.cellH}px`,
          ["--cell-gap" as any]: `${layout.gap}px`,
          ["--col-count" as any]: data.colCount,
        }}
      >
        <table className={styles.matrix}>
          <colgroup>
            <col className={styles.colAsset} />
            {Array.from({ length: data.colCount }).map((_, i) => (
              <col key={i} className={styles.colCell} />
            ))}
            <col className={styles.colTotal} />
          </colgroup>

          {/* Header · column labels */}
          <thead>
            <tr className={styles.headerRow}>
              <th className={styles.thAsset}>Vehículo</th>
              {Array.from({ length: data.colCount }).map((_, i) => {
                const lbl = data.colLabels.find((l) => l.col === i);
                return (
                  <th
                    key={`h-${i}`}
                    className={`${styles.thCell} ${
                      lbl?.isWeekend ? styles.thWeekend : ""
                    } ${lbl?.isToday ? styles.thToday : ""}`}
                  >
                    {lbl?.label ?? ""}
                  </th>
                );
              })}
              <th className={styles.thTotal}>Total</th>
            </tr>
          </thead>

          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={data.colCount + 2}
                  className={styles.emptyRow}
                >
                  Sin vehículos para los filtros aplicados.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.assetId} className={styles.row}>
                  <td className={styles.tdAsset}>
                    <Link
                      href={`/catalogos/vehiculos/${row.assetId}`}
                      className={styles.assetLink}
                    >
                      <span className={styles.assetName}>
                        {row.assetName}
                      </span>
                      {row.assetPlate && (
                        <span className={styles.assetPlate}>
                          {row.assetPlate}
                        </span>
                      )}
                    </Link>
                  </td>
                  {row.cells.map((c) => {
                    const intensity = bucket(c.value);
                    const interactive = c.drillTo !== null;
                    return (
                      <td
                        key={c.col}
                        className={`${styles.tdCell} ${
                          c.isWeekend ? styles.cellWeekend : ""
                        } ${c.isToday ? styles.cellToday : ""} ${
                          interactive ? styles.cellInteractive : ""
                        }`}
                        data-intensity={intensity}
                        onClick={
                          interactive && c.drillDate && c.drillTo
                            ? () => onDrill(c.drillDate!, c.drillTo!)
                            : undefined
                        }
                        onMouseEnter={(e) =>
                          setHover({
                            cell: c,
                            row,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                        onMouseMove={(e) =>
                          setHover((prev) =>
                            prev
                              ? { ...prev, x: e.clientX, y: e.clientY }
                              : null,
                          )
                        }
                        onMouseLeave={() => setHover(null)}
                        role={interactive ? "button" : undefined}
                        aria-label={`${row.assetName} · ${c.fullLabel} · ${formatValue(c.value)}`}
                      />
                    );
                  })}
                  <td className={styles.tdTotal}>
                    {formatValue(row.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Footer · column totals */}
          {data.rows.length > 0 && (
            <tfoot>
              <tr className={styles.footRow}>
                <td className={styles.tdFootAsset}>Total flota</td>
                {Array.from({ length: data.colCount }).map((_, i) => {
                  const sum = data.rows.reduce(
                    (acc, r) => acc + (r.cells[i]?.value ?? 0),
                    0,
                  );
                  return (
                    <td
                      key={`f-${i}`}
                      className={styles.tdFootCell}
                      title={formatValue(sum)}
                    >
                      <FootBar
                        value={sum}
                        max={data.rows.reduce((m, r) => {
                          let rowMax = 0;
                          for (const c of r.cells)
                            if (c.value > rowMax) rowMax = c.value;
                          return Math.max(m, rowMax * data.rows.length);
                        }, 1)}
                      />
                    </td>
                  );
                })}
                <td className={styles.tdFootTotal}>
                  {formatValue(data.total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Menos</span>
        <span className={styles.legendCell} data-intensity="0" />
        <span className={styles.legendCell} data-intensity="1" />
        <span className={styles.legendCell} data-intensity="2" />
        <span className={styles.legendCell} data-intensity="3" />
        <span className={styles.legendCell} data-intensity="4" />
        <span className={styles.legendLabel}>Más</span>
        {data.maxCellValue > 0 && (
          <span className={styles.legendNote}>
            · máx {formatValue(data.maxCellValue)} por celda
          </span>
        )}
      </div>

      {/* Tooltip */}
      {hover && (
        <div
          className={styles.tooltip}
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className={styles.tooltipName}>{hover.row.assetName}</div>
          <div className={styles.tooltipMeta}>{hover.cell.fullLabel}</div>
          <div className={styles.tooltipValue}>
            {formatValue(hover.cell.value)}
          </div>
          {hover.cell.drillTo && (
            <div className={styles.tooltipHint}>Click para abrir detalle</div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Footer mini-bar · pequeña barra que muestra suma por columna
// ═══════════════════════════════════════════════════════════════

function FootBar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(1, value / max);
  return (
    <div className={styles.footBar}>
      <div className={styles.footBarFill} style={{ height: `${pct * 100}%` }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Layout helper · cell sizing por granularidad
// ═══════════════════════════════════════════════════════════════

interface CellLayout {
  cellW: number;
  cellH: number;
  gap: number;
}

function layoutForGranularity(
  g: AnalysisGranularity,
  colCount: number,
): CellLayout {
  // Default · GitHub small (12-14px) para vistas largas
  // y ligeramente más grandes para vistas cortas (manteniendo proporción)
  switch (g) {
    case "day-hours":
      return { cellW: 22, cellH: 14, gap: 3 };
    case "week-days":
      return { cellW: 56, cellH: 14, gap: 3 };
    case "month-days":
      return { cellW: 16, cellH: 14, gap: 3 };
    case "year-weeks":
      return { cellW: 12, cellH: 14, gap: 2 };
    case "year-months":
      return { cellW: 38, cellH: 14, gap: 3 };
  }
}
