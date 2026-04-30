"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SortHeader } from "./SortHeader";
import { StatusPill } from "./StatusPill";
import { AssetActionsKebab } from "@/app/(product)/catalogos/vehiculos/AssetActionsKebab";
import type { AssetsSearchParams } from "@/lib/url";
import type { AssetListRow } from "@/types/domain";
import styles from "./AssetTable.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetTable
//  ─────────────────────────────────────────────────────────────
//  Renders the assets table with sortable columns and entirely
//  clickable rows.
//
//  A6a · ahora es client component (necesario para checkboxes
//  controlados de bulk select). El cambio es transparente para
//  el server caller · el rendering sigue siendo el mismo.
// ═══════════════════════════════════════════════════════════════

interface BulkSelection {
  /** IDs actualmente seleccionados */
  selectedIds: Set<string>;
  /** Toggle de un asset individual */
  onToggle: (id: string) => void;
  /** Toggle de "todos" (los visibles) */
  onToggleAll: () => void;
  /** IDs visibles · usado para el header checkbox */
  visibleIds: string[];
}

interface AssetTableProps {
  rows: AssetListRow[];
  current: AssetsSearchParams;
  /** Si true, muestra el kebab con Editar/Eliminar (CRUD).
   *  Si false, muestra el chevron clásico → Libro del Objeto. */
  showActions?: boolean;
  /** Si presente, agrega columna de checkbox para bulk select */
  bulkSelection?: BulkSelection;
  /** H7b · permisos granulares · default true para no romper call sites
   *  que no los pasan explícitamente */
  canEditAsset?: boolean;
  canDeleteAsset?: boolean;
}

export function AssetTable({
  rows,
  current,
  showActions = false,
  bulkSelection,
  canEditAsset = true,
  canDeleteAsset = true,
}: AssetTableProps) {
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        No hay assets que cumplan los filtros aplicados.
      </div>
    );
  }

  const allSelected =
    bulkSelection !== undefined &&
    bulkSelection.visibleIds.length > 0 &&
    bulkSelection.visibleIds.every((id) => bulkSelection.selectedIds.has(id));
  const someSelected =
    bulkSelection !== undefined &&
    !allSelected &&
    bulkSelection.visibleIds.some((id) => bulkSelection.selectedIds.has(id));

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {bulkSelection && (
              <th className={styles.thCheckbox}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => bulkSelection.onToggleAll()}
                  aria-label="Seleccionar todos"
                />
              </th>
            )}
            <SortHeader field="name" label="Asset" current={current} />
            <SortHeader field={null} label="Patente" current={current} />
            <SortHeader field={null} label="Grupo" current={current} />
            <SortHeader field={null} label="Conductor" current={current} />
            <SortHeader field="status" label="Estado" current={current} />
            <SortHeader
              field="speedKmh"
              label="Velocidad"
              current={current}
              align="right"
            />
            <th className={styles.thAction} aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AssetRow
              key={row.id}
              row={row}
              showActions={showActions}
              bulkSelection={bulkSelection}
              canEditAsset={canEditAsset}
              canDeleteAsset={canDeleteAsset}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AssetRow · single row (each cell is a Link to Libro B)
// ═══════════════════════════════════════════════════════════════

function AssetRow({
  row,
  showActions,
  bulkSelection,
  canEditAsset,
  canDeleteAsset,
}: {
  row: AssetListRow;
  showActions: boolean;
  bulkSelection?: BulkSelection;
  canEditAsset: boolean;
  canDeleteAsset: boolean;
}) {
  const href = `/objeto/vehiculo/${row.id}`;
  const driver = row.currentDriver;
  const isSelected =
    bulkSelection !== undefined && bulkSelection.selectedIds.has(row.id);

  return (
    <tr
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
    >
      {bulkSelection && (
        <td
          className={styles.tdCheckbox}
          onClick={(e) => {
            // Evitar que el click en el td (que no tiene Link envuelto)
            // se propague raro · solo el checkbox dispara
            e.stopPropagation();
          }}
        >
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={isSelected}
            onChange={() => bulkSelection.onToggle(row.id)}
            aria-label={`Seleccionar ${row.name}`}
          />
        </td>
      )}

      {/* Name + secondary: make/model */}
      <Cell href={href}>
        <div className={styles.assetCell}>
          <span className={styles.assetName}>{row.name}</span>
          {(row.make || row.model) && (
            <span className={styles.assetSub}>
              {[row.make, row.model].filter(Boolean).join(" ")}
            </span>
          )}
        </div>
      </Cell>

      {/* Plate */}
      <Cell href={href}>
        <span className={styles.mono}>{row.plate ?? "—"}</span>
      </Cell>

      {/* Group */}
      <Cell href={href}>
        <span className={styles.dim}>{row.group?.name ?? "—"}</span>
      </Cell>

      {/* Driver */}
      <Cell href={href}>
        {driver ? (
          <span>
            {driver.firstName} {driver.lastName}
          </span>
        ) : (
          <span className={styles.dim}>—</span>
        )}
      </Cell>

      {/* Status */}
      <Cell href={href}>
        <StatusPill status={row.status} />
      </Cell>

      {/* Velocidad instantánea (E6-A) */}
      <Cell href={href} align="right">
        <SpeedCell lastPosition={row.lastPosition} />
      </Cell>

      {/* Acción · kebab si CRUD, chevron clásico si no */}
      <td className={`${styles.td} ${styles.alignRight} ${styles.actionTd}`}>
        {showActions ? (
          <AssetActionsKebab
            assetId={row.id}
            assetName={row.name}
            canEdit={canEditAsset}
            canDelete={canDeleteAsset}
          />
        ) : (
          <Link href={href} className={styles.cellLink}>
            <ChevronRight size={14} className={styles.chev} />
          </Link>
        )}
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SpeedCell · velocidad instantánea con accent por umbral
//  ─────────────────────────────────────────────────────────────
//  Reglas:
//    · Sin lastPosition → "—" (asset nunca reportó)
//    · ignition=false   → "—" (motor apagado · no hay velocidad
//                              instantánea relevante)
//    · 0 km/h           → "0 km/h" en color dim (detenido con
//                              motor encendido)
//    · ≥130 km/h        → rojo
//    · ≥110 km/h        → ámbar
//    · resto            → normal
// ═══════════════════════════════════════════════════════════════

function SpeedCell({
  lastPosition,
}: {
  lastPosition: AssetListRow["lastPosition"];
}) {
  if (!lastPosition || !lastPosition.ignition) {
    return <span className={styles.dim}>—</span>;
  }
  const v = Math.round(lastPosition.speedKmh);
  const cls =
    v >= 130
      ? styles.scoreRed
      : v >= 110
        ? styles.scoreAmb
        : v === 0
          ? styles.dim
          : styles.scoreGrn;
  return <span className={`${styles.score} ${cls}`}>{v} km/h</span>;
}

// ═══════════════════════════════════════════════════════════════
//  Cell · TD that wraps its content in a Link covering the cell
// ═══════════════════════════════════════════════════════════════

function Cell({
  href,
  children,
  align,
}: {
  href: string;
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td className={`${styles.td} ${align === "right" ? styles.alignRight : ""}`}>
      <Link href={href} className={styles.cellLink}>
        {children}
      </Link>
    </td>
  );
}
