"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  ChevronUp,
  ChevronDown,
  Download,
  ChevronRight,
} from "lucide-react";
import { exportRowsToCsv, type CsvColumn } from "@/lib/export/csv";
import { exportRowsToXlsx } from "@/lib/export/xlsx";
import { exportRowsToPdf } from "@/lib/export/pdf";
import styles from "./DataTable.module.css";

// ═══════════════════════════════════════════════════════════════
//  DataTable v2 · S5-T1 · patrón unificado estilo "Posiciones"
//  ─────────────────────────────────────────────────────────────
//  Tabla densa Tufte para todas las sábanas del producto.
//  Estética validada con el usuario · referencia tabla de
//  Posiciones del libro del vehículo:
//
//    · Headers uppercase pequeños en gris · poco peso visual
//    · Tipografía monoespaciada en datos numéricos · alineación
//      perfecta por dígito, escaneo vertical sin esfuerzo
//    · Numeración de fila opcional (#) · activable por prop
//    · Zebra striping muy sutil
//    · Hover state con tinte azul muy claro
//    · Sin bordes verticales · solo separadores horizontales
//    · Header del bloque con título + conteo + botón export
//    · Sticky header al scroll
//    · Empty state · una línea gris centrada
//    · Click-row → side panel (callback opcional)
//    · Sortable headers · click cambia dir
//    · Paginación footer estándar
//
//  Backwards-compat con DataTable v1 · la API mantiene
//  ColumnDef<R>, rows, rowKey, defaultSort, density · agrega
//  props nuevos (title, count, onRowClick, etc.) opcionales.
//  ScorecardClient (único user de v1) sigue funcionando sin
//  cambios.
// ═══════════════════════════════════════════════════════════════

export interface ColumnDef<R> {
  key: string;
  label: ReactNode;
  /** Alignment · default "left". Numeric va en "right". */
  align?: "left" | "center" | "right";
  /** First column sticky · útil para nombre de objeto */
  sticky?: boolean;
  /** Aplica monospace + tabular-nums + alignRight */
  numeric?: boolean;
  /** Forzar mono sin alinear a la derecha (timestamps, IDs, coords) */
  mono?: boolean;
  /** Sortable · default true. Cuando false el header no responde al click. */
  sortable?: boolean;
  /** Función para obtener el valor de sort · default r[key] */
  sortValue?: (row: R) => number | string;
  /** Render del header · default = label */
  renderHeader?: () => ReactNode;
  /** Render de la celda · default = String(r[key]) */
  render?: (row: R) => ReactNode;
  /** Tooltip del header */
  title?: string;
  /** Min-width en px */
  minWidth?: number;
  /** Width fijo · si se da, no se reparte */
  width?: string;
}

export type ExportFormat = "csv" | "xlsx" | "pdf";

interface DataTableProps<R> {
  // ── Datos ──────────────────────────────────────────────────
  columns: ColumnDef<R>[];
  rows: R[];
  rowKey: (row: R) => string;

  // ── Layout & visual ────────────────────────────────────────
  density?: "compact" | "normal";
  /** Mostrar columna # con número de fila (1-indexed por página) */
  showRowNumber?: boolean;
  /** Highlight on hover · default true */
  hoverable?: boolean;

  // ── Sort ───────────────────────────────────────────────────
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /** Sort controlado (desde server) · si se pasa, se ignora defaultSort */
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;

  // ── Header del bloque ─────────────────────────────────────
  /** Título arriba · ej. "Infracciones" */
  title?: string;
  /** Conteo a la derecha del título · ej. 1230 */
  count?: number;
  /** Acciones extras a la derecha del header · ej. botón "Nuevo" */
  headerActions?: ReactNode;

  // ── Interacción ───────────────────────────────────────────
  /** Click en fila · típicamente abre side panel */
  onRowClick?: (row: R) => void;
  /** Row key actualmente seleccionada · para highlight */
  selectedRowKey?: string | null;

  // ── Empty state ───────────────────────────────────────────
  emptyMessage?: string;

  // ── Paginación ────────────────────────────────────────────
  page?: number;
  pageCount?: number;
  totalCount?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;

  // ── Export ────────────────────────────────────────────────
  /** Formatos disponibles · default ['csv'] si exportFilename está dado */
  exportFormats?: ExportFormat[];
  /** Filename base (sin extensión) · ej. "infracciones-2026-05" */
  exportFilename?: string;
  /** Columnas para export · si no se da, usa las visibles. Cada columna
   *  toma el valor de row[key] o aplica una función custom. */
  exportColumns?: CsvColumn<R>[];
  /** Override completo · si se pasa, se llama con el formato y la
   *  pantalla decide cómo exportar (típicamente XLSX server-side). */
  onExport?: (format: ExportFormat) => Promise<void> | void;

  // ── Footer extra ──────────────────────────────────────────
  /** Fila de footer · ej. "Total flota". Se aplica sobre tbody. */
  footRow?: ReactNode[];
}

// ═══════════════════════════════════════════════════════════════
//  Componente principal
// ═══════════════════════════════════════════════════════════════

export function DataTable<R>({
  columns,
  rows,
  rowKey,
  density = "normal",
  showRowNumber = false,
  hoverable = true,
  defaultSort,
  sortKey: sortKeyProp,
  sortDir: sortDirProp,
  onSort,
  title,
  count,
  headerActions,
  onRowClick,
  selectedRowKey,
  emptyMessage = "Sin datos para mostrar.",
  page,
  pageCount,
  totalCount,
  pageSize,
  onPageChange,
  exportFormats,
  exportFilename,
  exportColumns,
  onExport,
  footRow,
}: DataTableProps<R>) {
  // Sort interno (cliente) si no es controlado
  const [internalSort, setInternalSort] = useState<{
    key: string;
    dir: "asc" | "desc";
  } | null>(defaultSort ?? null);

  const isControlled = sortKeyProp !== undefined;
  const sortKey = isControlled ? sortKeyProp : internalSort?.key;
  const sortDir = isControlled ? sortDirProp : internalSort?.dir;

  const handleHeaderClick = (col: ColumnDef<R>) => {
    if (col.sortable === false) return;
    if (onSort) {
      onSort(col.key);
    } else {
      setInternalSort((curr) => {
        if (curr?.key === col.key) {
          return { key: col.key, dir: curr.dir === "asc" ? "desc" : "asc" };
        }
        return { key: col.key, dir: "desc" };
      });
    }
  };

  // Sort cliente · solo si no es controlado
  const displayRows = useMemo(() => {
    if (isControlled || !internalSort) return rows;
    const { key, dir } = internalSort;
    const col = columns.find((c) => c.key === key);
    if (!col) return rows;
    const getValue = col.sortValue ?? ((r: R) => (r as Record<string, unknown>)[key] as number | string);
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return dir === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, internalSort, isControlled]);

  // Export · default = csv + xlsx + pdf cuando hay filename
  const formats = exportFormats ?? (exportFilename ? ["csv", "xlsx", "pdf"] : []);
  const canExport = formats.length > 0 && rows.length > 0;

  async function handleExport(format: ExportFormat) {
    if (onExport) {
      await onExport(format);
      return;
    }
    if (!exportFilename) return;
    const cols: CsvColumn<R>[] = exportColumns
      ? exportColumns
      : columns.map((c) => ({
          header: typeof c.label === "string" ? c.label : c.key,
          value: (row: R) =>
            (row as Record<string, unknown>)[c.key] as
              | string
              | number
              | null
              | undefined,
        }));

    if (format === "csv") {
      exportRowsToCsv(exportFilename, displayRows, cols);
    } else if (format === "xlsx") {
      await exportRowsToXlsx(exportFilename, displayRows, cols);
    } else if (format === "pdf") {
      await exportRowsToPdf(exportFilename, displayRows, cols, {
        title: title ?? exportFilename,
        subtitle:
          count !== undefined
            ? `${count.toLocaleString("es-AR")} registros · exportados ${displayRows.length}`
            : undefined,
      });
    }
  }

  return (
    <div className={styles.wrap}>
      {/* ── Header del bloque ───────────────────────────────── */}
      {(title || canExport || headerActions) && (
        <div className={styles.tableHeader}>
          {title && (
            <div className={styles.titleGroup}>
              <span className={styles.title}>{title}</span>
              {count !== undefined && (
                <span className={styles.count}>
                  {count.toLocaleString("es-AR")}
                </span>
              )}
            </div>
          )}
          <div className={styles.headerActions}>
            {headerActions}
            {canExport && <ExportMenu formats={formats} onExport={handleExport} />}
          </div>
        </div>
      )}

      {/* ── Tabla ───────────────────────────────────────────── */}
      <div className={styles.scrollWrap}>
        <table
          className={`${styles.table} ${density === "compact" ? styles.compact : ""} ${hoverable ? styles.hoverable : ""}`}
        >
          <thead className={styles.thead}>
            <tr>
              {showRowNumber && (
                <th className={`${styles.th} ${styles.thRowNum}`}>#</th>
              )}
              {columns.map((col) => {
                const align = col.align ?? (col.numeric ? "right" : "left");
                const isActive = sortKey === col.key;
                const sortable = col.sortable !== false;
                const styleObj: React.CSSProperties = {};
                if (col.minWidth) styleObj.minWidth = col.minWidth;
                if (col.width) styleObj.width = col.width;
                return (
                  <th
                    key={col.key}
                    className={`${styles.th} ${styles[`align-${align}`]} ${col.sticky ? styles.sticky : ""} ${sortable ? styles.sortable : ""}`}
                    style={styleObj}
                    onClick={sortable ? () => handleHeaderClick(col) : undefined}
                    title={col.title}
                  >
                    <span className={styles.thInner}>
                      {col.renderHeader ? col.renderHeader() : col.label}
                      {sortable && isActive && sortDir === "asc" && (
                        <ChevronUp size={11} className={styles.sortIcon} />
                      )}
                      {sortable && isActive && sortDir === "desc" && (
                        <ChevronDown size={11} className={styles.sortIcon} />
                      )}
                    </span>
                  </th>
                );
              })}
              {onRowClick && <th className={`${styles.th} ${styles.thChevron}`} />}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length +
                    (showRowNumber ? 1 : 0) +
                    (onRowClick ? 1 : 0)
                  }
                  className={styles.empty}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayRows.map((row, idx) => {
                const k = rowKey(row);
                const isSelected = selectedRowKey === k;
                return (
                  <tr
                    key={k}
                    className={`${styles.row} ${isSelected ? styles.rowSelected : ""} ${onRowClick ? styles.rowClickable : ""}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {showRowNumber && (
                      <td className={`${styles.td} ${styles.tdRowNum}`}>
                        {(page && pageSize ? (page - 1) * pageSize : 0) + idx + 1}
                      </td>
                    )}
                    {columns.map((col) => {
                      const align = col.align ?? (col.numeric ? "right" : "left");
                      return (
                        <td
                          key={col.key}
                          className={`${styles.td} ${styles[`align-${align}`]} ${col.sticky ? styles.sticky : ""} ${col.numeric || col.mono ? styles.mono : ""}`}
                        >
                          {col.render
                            ? col.render(row)
                            : ((row as Record<string, unknown>)[col.key] as ReactNode) ?? null}
                        </td>
                      );
                    })}
                    {onRowClick && (
                      <td className={`${styles.td} ${styles.tdChevron}`}>
                        <ChevronRight size={14} className={styles.chevron} />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          {footRow && (
            <tfoot>
              <tr>
                {showRowNumber && <td className={styles.td} />}
                {footRow.map((cell, i) => (
                  <td
                    key={i}
                    className={`${styles.td} ${styles.footCell}`}
                  >
                    {cell}
                  </td>
                ))}
                {onRowClick && <td className={styles.td} />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Paginación ─────────────────────────────────────── */}
      {pageCount !== undefined && pageCount > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={!page || page <= 1}
            onClick={() => page && onPageChange?.(page - 1)}
          >
            ← Anterior
          </button>
          <span className={styles.pageInfo}>
            Página {page} de {pageCount}
            {totalCount !== undefined && (
              <>
                {" · "}
                {totalCount.toLocaleString("es-AR")} resultados
              </>
            )}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={!page || page >= pageCount}
            onClick={() => page && onPageChange?.(page + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ExportMenu · subcomponente · botón Download con dropdown
// ═══════════════════════════════════════════════════════════════

function ExportMenu({
  formats,
  onExport,
}: {
  formats: ExportFormat[];
  onExport: (format: ExportFormat) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Si solo un formato, click directo
  if (formats.length === 1) {
    const f = formats[0]!;
    return (
      <button
        type="button"
        className={styles.exportBtn}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onExport(f);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={13} />
        <span>{busy ? "Exportando…" : `Exportar ${f.toUpperCase()}`}</span>
      </button>
    );
  }

  return (
    <div className={styles.exportMenuWrap}>
      <button
        type="button"
        className={styles.exportBtn}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        <Download size={13} />
        <span>{busy ? "Exportando…" : "Exportar"}</span>
      </button>
      {open && (
        <div className={styles.exportMenu}>
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              className={styles.exportMenuItem}
              onClick={async () => {
                setOpen(false);
                setBusy(true);
                try {
                  await onExport(f);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
