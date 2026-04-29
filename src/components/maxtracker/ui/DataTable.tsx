"use client";

import { useState, useMemo, type ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import styles from "./DataTable.module.css";

// ═══════════════════════════════════════════════════════════════
//  DataTable · componente unificado
//  ─────────────────────────────────────────────────────────────
//  Reemplaza las 5+ implementaciones que había en los .module.css
//  de cada Reportes/Scorecard. Parametrización mínima:
//
//    columns · array de definiciones · key, label, align, sticky, render
//    rows    · array de objetos arbitrarios
//    rowKey  · función que da el key único de cada row
//
//  Soporta:
//    · sticky first column (para nombre de objeto en filas largas)
//    · sort por column (ascendente/descendente)
//    · density (compact | normal)
//    · render custom por celda · permite chips, links, sparklines
//    · numeric alignment + tabular-nums automático
//    · empty state inline
//
//  Uso típico:
//    <DataTable
//      columns={[
//        { key: "name", label: "Vehículo", sticky: true,
//          render: (r) => <Link href={...}>{r.name}</Link> },
//        { key: "km",   label: "Km",       align: "right", numeric: true },
//        { key: "evt",  label: "Eventos",  align: "right", numeric: true },
//      ]}
//      rows={data}
//      rowKey={(r) => r.id}
//      density="compact"
//      defaultSort={{ key: "km", dir: "desc" }}
//    />
// ═══════════════════════════════════════════════════════════════

export interface ColumnDef<R> {
  key: string;
  label: ReactNode;
  /** Alignment horizontal · default "left". Numeric va en "right". */
  align?: "left" | "center" | "right";
  /** Si true, primera columna sticky (suele ser el nombre del objeto) */
  sticky?: boolean;
  /** Si true, aplica monospace + tabular-nums + alignRight si no se especificó */
  numeric?: boolean;
  /** Sort permitido · default true */
  sortable?: boolean;
  /** Valor para sort · si no se da, usa r[key] */
  sortValue?: (row: R) => number | string;
  /** Render del header · default = label */
  renderHeader?: () => ReactNode;
  /** Render de la celda · default = String(r[key]) */
  render?: (row: R) => ReactNode;
  /** Tooltip del header · opcional */
  title?: string;
  /** Min width en px · útil para columnas con sparkline */
  minWidth?: number;
}

interface DataTableProps<R> {
  columns: ColumnDef<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  /** Density · default "normal" */
  density?: "compact" | "normal";
  /** Sort inicial */
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /** Mensaje cuando no hay rows */
  emptyMessage?: string;
  /** Foot · ej "Total flota" */
  footRow?: ReactNode[];
  /** Highlight en hover · default true */
  hoverable?: boolean;
}

export function DataTable<R>({
  columns,
  rows,
  rowKey,
  density = "normal",
  defaultSort,
  emptyMessage = "Sin datos para mostrar.",
  footRow,
  hoverable = true,
}: DataTableProps<R>) {
  const [sortKey, setSortKey] = useState<string | null>(
    defaultSort?.key ?? null,
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    defaultSort?.dir ?? "desc",
  );

  function handleSort(col: ColumnDef<R>) {
    if (col.sortable === false) return;
    if (sortKey === col.key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col.key);
      setSortDir("desc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const getVal = col.sortValue
      ? col.sortValue
      : (r: R) => (r as Record<string, unknown>)[sortKey] as number | string;
    const sorted = [...rows].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va === vb) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb), "es-AR")
        : String(vb).localeCompare(String(va), "es-AR");
    });
    return sorted;
  }, [rows, sortKey, sortDir, columns]);

  const densityClass = density === "compact" ? styles.compact : styles.normal;

  return (
    <div className={styles.tableWrap}>
      <table
        className={`${styles.table} ${densityClass} ${hoverable ? styles.hoverable : ""}`}
      >
        <thead>
          <tr>
            {columns.map((col) => {
              const align = col.align ?? (col.numeric ? "right" : "left");
              const isSorted = sortKey === col.key;
              const cls = [
                styles.th,
                align === "right" ? styles.alignRight : "",
                align === "center" ? styles.alignCenter : "",
                col.sticky ? styles.thSticky : "",
                col.sortable !== false ? styles.thSortable : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <th
                  key={col.key}
                  className={cls}
                  title={col.title}
                  style={
                    col.minWidth ? { minWidth: `${col.minWidth}px` } : undefined
                  }
                  onClick={() => handleSort(col)}
                >
                  <span className={styles.thInner}>
                    {col.renderHeader ? col.renderHeader() : col.label}
                    {col.sortable !== false && isSorted && (
                      <span className={styles.sortIcon}>
                        {sortDir === "asc" ? (
                          <ChevronUp size={11} />
                        ) : (
                          <ChevronDown size={11} />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => (
              <tr key={rowKey(row)} className={styles.row}>
                {columns.map((col) => {
                  const align =
                    col.align ?? (col.numeric ? "right" : "left");
                  const cls = [
                    styles.td,
                    align === "right" ? styles.alignRight : "",
                    align === "center" ? styles.alignCenter : "",
                    col.sticky ? styles.tdSticky : "",
                    col.numeric ? styles.numeric : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const content = col.render
                    ? col.render(row)
                    : String(
                        (row as Record<string, unknown>)[col.key] ?? "",
                      );
                  return (
                    <td key={col.key} className={cls}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        {footRow && sortedRows.length > 0 && (
          <tfoot>
            <tr className={styles.footRow}>
              {footRow.map((cell, i) => {
                const col = columns[i];
                const align =
                  col?.align ?? (col?.numeric ? "right" : "left");
                const cls = [
                  styles.tdFoot,
                  align === "right" ? styles.alignRight : "",
                  align === "center" ? styles.alignCenter : "",
                  col?.sticky ? styles.tdSticky : "",
                  col?.numeric ? styles.numeric : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <td key={i} className={cls}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
