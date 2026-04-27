import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SortHeader } from "./SortHeader";
import { StatusPill } from "./StatusPill";
import type { AssetsSearchParams } from "@/lib/url";
import type { AssetListRow } from "@/types/domain";
import styles from "./AssetTable.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetTable
//  ─────────────────────────────────────────────────────────────
//  Renders the assets table with sortable columns and entirely
//  clickable rows.
//
//  The clickability pattern: each <td> wraps its content in a
//  Link to /gestion/vehiculos/[id]. Together they form a full-row
//  hit area while preserving table semantics. The outer <tr>
//  carries a hover style triggered by `tr:hover` on any of the
//  inner Links.
//
//  Why not a `<tr onClick>`? Because that breaks accessibility
//  and prevents browser's native cmd-click for "open in new tab".
// ═══════════════════════════════════════════════════════════════

interface AssetTableProps {
  rows: AssetListRow[];
  current: AssetsSearchParams;
}

export function AssetTable({ rows, current }: AssetTableProps) {
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        No hay assets que cumplan los filtros aplicados.
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <SortHeader field="name" label="Asset" current={current} />
            <SortHeader field={null} label="Patente" current={current} />
            <SortHeader field={null} label="Grupo" current={current} />
            <SortHeader field={null} label="Conductor" current={current} />
            <SortHeader field="status" label="Estado" current={current} />
            <SortHeader
              field="safetyScore"
              label="Score"
              current={current}
              align="right"
            />
            <th className={styles.thAction} aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <AssetRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AssetRow · single row (each cell is a Link to Libro B)
// ═══════════════════════════════════════════════════════════════

function AssetRow({ row }: { row: AssetListRow }) {
  const href = `/gestion/vehiculos/${row.id}`;
  const driver = row.currentDriver;

  return (
    <tr className={styles.row}>
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

      {/* Score */}
      <Cell href={href} align="right">
        {driver ? (
          <span
            className={`${styles.score} ${
              driver.safetyScore < 60
                ? styles.scoreRed
                : driver.safetyScore < 80
                  ? styles.scoreAmb
                  : styles.scoreGrn
            }`}
          >
            {driver.safetyScore}
          </span>
        ) : (
          <span className={styles.dim}>—</span>
        )}
      </Cell>

      {/* Chevron action cell */}
      <Cell href={href} align="right">
        <ChevronRight size={14} className={styles.chev} />
      </Cell>
    </tr>
  );
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
