"use client";

import { useState } from "react";
import type {
  AnalysisCell,
  AnalysisData,
  AnalysisGranularity,
} from "@/lib/queries";
import styles from "./Heatmap.module.css";

// ═══════════════════════════════════════════════════════════════
//  Heatmap · grilla unificada para todas las granularidades
//  ─────────────────────────────────────────────────────────────
//  Layout responde a data.granularity:
//    · year-weeks · 7×53 · estilo GitHub · celdas 12px
//    · year-months · 1×12 · celdas grandes 80px
//    · month-days · 5-6×7 · grid calendario
//    · week-days · 1×7 · celdas grandes
//    · day-hours · 1×24 · celdas medianas
//
//  Color: azul gradiente · 5 buckets de intensidad.
//  Click en celda con drillTo → onDrill(date, drillTo)
// ═══════════════════════════════════════════════════════════════

interface Props {
  data: AnalysisData;
  onDrill: (date: string, drillTo: AnalysisGranularity) => void;
  formatValue: (v: number) => string;
}

export function Heatmap({ data, onDrill, formatValue }: Props) {
  const [hover, setHover] = useState<{
    cell: AnalysisCell;
    x: number;
    y: number;
  } | null>(null);

  // Cells indexed by (row, col) for fast lookup
  const cellGrid: (AnalysisCell | undefined)[][] = [];
  for (let r = 0; r < data.rows; r++) cellGrid.push([]);
  for (const c of data.cells) {
    if (cellGrid[c.row]) cellGrid[c.row]![c.col] = c;
  }

  function bucket(value: number): 0 | 1 | 2 | 3 | 4 {
    if (value <= 0 || data.maxCellValue <= 0) return 0;
    const r = value / data.maxCellValue;
    if (r < 0.25) return 1;
    if (r < 0.5) return 2;
    if (r < 0.75) return 3;
    return 4;
  }

  function handleClick(c: AnalysisCell) {
    if (c.drillDate && c.drillTo) onDrill(c.drillDate, c.drillTo);
  }

  // Variant chooses which layout shape we use
  const variant = data.granularity;
  const variantClass =
    variant === "year-weeks"
      ? styles.varYearWeeks
      : variant === "year-months"
        ? styles.varYearMonths
        : variant === "month-days"
          ? styles.varMonthDays
          : variant === "week-days"
            ? styles.varWeekDays
            : styles.varDayHours;

  return (
    <div className={`${styles.wrap} ${variantClass}`}>
      {/* ── Optional · column labels (months) for year-weeks ── */}
      {variant === "year-weeks" && data.colLabels.length > 0 && (
        <div className={styles.colLabelRow}>
          <div className={styles.rowLabelSpacer} />
          <div className={styles.colLabels}>
            {data.colLabels.map((l) => (
              <span
                key={`${l.col}-${l.label}`}
                className={styles.colLabel}
                style={{ left: `${l.col * 14}px` }}
              >
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── For week-days · header ─────────────────────────── */}
      {variant === "week-days" && (
        <div className={styles.weekHeader}>
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d, i) => (
            <span
              key={d}
              className={`${styles.weekHeaderLabel} ${
                i >= 5 ? styles.weekHeaderWeekend : ""
              }`}
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* ── For month-days · header ────────────────────────── */}
      {variant === "month-days" && (
        <div className={styles.monthHeader}>
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d, i) => (
            <span
              key={d}
              className={`${styles.monthHeaderLabel} ${
                i >= 5 ? styles.monthHeaderWeekend : ""
              }`}
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* ── For day-hours · 24 axis labels ─────────────────── */}
      {variant === "day-hours" && (
        <div className={styles.dayAxis}>
          {[0, 6, 12, 18].map((h) => (
            <span
              key={h}
              className={styles.dayAxisLabel}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────── */}
      <div className={styles.gridScroll}>
        <div className={styles.gridWrap}>
          {variant === "year-weeks" && (
            <div className={styles.rowLabels}>
              {data.rowLabels.map((l, i) => (
                <span
                  key={l}
                  className={styles.rowLabel}
                  style={{
                    visibility: i % 2 === 0 ? "visible" : "hidden",
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          )}

          <div
            className={styles.grid}
            style={{
              gridTemplateRows: `repeat(${data.rows}, var(--cell-h))`,
              gridTemplateColumns: `repeat(${data.cols}, var(--cell-w))`,
            }}
          >
            {data.cells.map((c) => {
              const intensity = bucket(c.value);
              const interactive = c.hasData && c.drillTo !== null;
              return (
                <div
                  key={c.key}
                  className={`${styles.cell} ${
                    !c.hasData ? styles.cellEmpty : ""
                  } ${c.isToday ? styles.cellToday : ""} ${
                    c.isWeekend ? styles.cellWeekend : ""
                  } ${interactive ? styles.cellInteractive : ""}`}
                  data-intensity={c.hasData ? intensity : undefined}
                  style={{
                    gridRow: c.row + 1,
                    gridColumn: c.col + 1,
                  }}
                  onClick={interactive ? () => handleClick(c) : undefined}
                  onMouseEnter={
                    c.hasData
                      ? (e) =>
                          setHover({ cell: c, x: e.clientX, y: e.clientY })
                      : undefined
                  }
                  onMouseMove={
                    c.hasData
                      ? (e) =>
                          setHover((prev) =>
                            prev
                              ? { ...prev, x: e.clientX, y: e.clientY }
                              : null,
                          )
                      : undefined
                  }
                  onMouseLeave={c.hasData ? () => setHover(null) : undefined}
                  role={interactive ? "button" : undefined}
                  aria-label={
                    c.hasData
                      ? `${c.fullLabel} · ${formatValue(c.value)}`
                      : undefined
                  }
                >
                  {c.shortLabel && (
                    <span className={styles.cellLabel}>{c.shortLabel}</span>
                  )}
                  {variant === "year-months" && c.hasData && (
                    <span className={styles.cellSubValue}>
                      {formatValue(c.value)}
                    </span>
                  )}
                  {variant === "week-days" && c.hasData && (
                    <span className={styles.cellSubValue}>
                      {formatValue(c.value)}
                    </span>
                  )}
                  {variant === "day-hours" && c.hasData && c.value > 0 && (
                    <span className={styles.cellSubMicro}>
                      {formatValue(c.value)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────── */}
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
            · máx {formatValue(data.maxCellValue)}
          </span>
        )}
      </div>

      {/* ── Tooltip ──────────────────────────────────────────── */}
      {hover && (
        <div
          className={styles.tooltip}
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className={styles.tooltipName}>{hover.cell.fullLabel}</div>
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
