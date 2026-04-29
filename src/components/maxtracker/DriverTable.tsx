import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, AlertTriangle } from "lucide-react";
import {
  buildDriversHref,
  type DriverSort,
  type DriversSearchParams,
} from "@/lib/url-drivers";
import { PersonActionsKebab } from "@/app/(product)/catalogos/conductores/PersonActionsKebab";
import type { DriverListRow } from "@/lib/queries/persons";
import styles from "./DriverTable.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverTable
//  ─────────────────────────────────────────────────────────────
//  Twin of AssetTable: sortable columns, full-row clickable
//  links to /objeto/conductor/[id].
//
//  Self-contained sort header to keep AssetTable unchanged.
// ═══════════════════════════════════════════════════════════════

interface DriverTableProps {
  rows: DriverListRow[];
  current: DriversSearchParams;
  /** Si true, muestra kebab Editar/Eliminar. Si false, chevron a Libro. */
  showActions?: boolean;
}

export function DriverTable({
  rows,
  current,
  showActions = false,
}: DriverTableProps) {
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        No hay conductores que cumplan los filtros aplicados.
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <SortableTh
              field="name"
              label="Conductor"
              current={current}
            />
            <Th label="Documento" />
            <Th label="Cuenta" />
            <Th label="Vehículo asignado" />
            <SortableTh
              field="safetyScore"
              label="Score"
              current={current}
              align="right"
            />
            <SortableTh
              field="events30d"
              label="Eventos 30d"
              current={current}
              align="right"
            />
            <Th label="Licencia" />
            <th className={styles.thAction} aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <DriverRow key={row.id} row={row} showActions={showActions} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DriverRow({
  row,
  showActions,
}: {
  row: DriverListRow;
  showActions: boolean;
}) {
  const href = `/objeto/conductor/${row.id}`;
  const fullName = `${row.firstName} ${row.lastName}`;

  return (
    <tr className={styles.row}>
      {/* Name + initials */}
      <Cell href={href}>
        <div className={styles.driverCell}>
          <span className={styles.avatar} aria-hidden="true">
            {row.firstName[0]}
            {row.lastName[0]}
          </span>
          <span className={styles.driverName}>{fullName}</span>
        </div>
      </Cell>

      {/* Document */}
      <Cell href={href}>
        <span className={styles.mono}>{row.document}</span>
      </Cell>

      {/* Account */}
      <Cell href={href}>
        <span className={styles.dim}>{row.accountName}</span>
      </Cell>

      {/* Assigned asset */}
      <Cell href={href}>
        {row.currentAsset ? (
          <span className={styles.assetCell}>
            <span className={styles.assetName}>{row.currentAsset.name}</span>
            {row.currentAsset.plate && (
              <span className={styles.assetPlate}>{row.currentAsset.plate}</span>
            )}
          </span>
        ) : (
          <span className={styles.inactive}>Sin asignar</span>
        )}
      </Cell>

      {/* Score */}
      <Cell href={href} align="right">
        <span
          className={`${styles.score} ${
            row.safetyScore < 60
              ? styles.scoreRed
              : row.safetyScore < 80
                ? styles.scoreAmb
                : styles.scoreGrn
          }`}
        >
          {row.safetyScore}
        </span>
      </Cell>

      {/* Events 30d */}
      <Cell href={href} align="right">
        <span
          className={`${styles.events} ${
            row.events30d === 0 ? styles.dim : ""
          }`}
        >
          {row.events30d}
        </span>
      </Cell>

      {/* License */}
      <Cell href={href}>
        <LicenseCell
          expiresAt={row.licenseExpiresAt}
          expiringSoon={row.licenseExpiringSoon}
        />
      </Cell>

      {/* Acción · kebab si CRUD, chevron clásico si no */}
      <td className={`${styles.td} ${styles.alignRight} ${styles.actionTd}`}>
        {showActions ? (
          <PersonActionsKebab
            personId={row.id}
            fullName={`${row.firstName} ${row.lastName}`}
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

function LicenseCell({
  expiresAt,
  expiringSoon,
}: {
  expiresAt: Date | null;
  expiringSoon: boolean;
}) {
  if (!expiresAt) {
    return <span className={styles.dim}>—</span>;
  }
  const ms = expiresAt.getTime() - Date.now();
  const expired = ms < 0;
  const formatted = formatShortDate(expiresAt);

  if (expired) {
    return (
      <span className={`${styles.licenseCell} ${styles.licenseExpired}`}>
        <AlertTriangle size={12} className={styles.warnIcon} />
        Vencida · {formatted}
      </span>
    );
  }
  if (expiringSoon) {
    return (
      <span className={`${styles.licenseCell} ${styles.licenseSoon}`}>
        <AlertTriangle size={12} className={styles.warnIcon} />
        Vence {formatted}
      </span>
    );
  }
  return <span className={styles.dim}>{formatted}</span>;
}

function formatShortDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ═══════════════════════════════════════════════════════════════
//  Sortable header
// ═══════════════════════════════════════════════════════════════

function SortableTh({
  field,
  label,
  current,
  align,
}: {
  field: DriverSort;
  label: string;
  current: DriversSearchParams;
  align?: "right";
}) {
  const isActive = current.sort === field;
  const nextDir =
    isActive && current.dir === "asc" ? "desc" : "asc";
  const href = buildDriversHref(current, {
    sort: field,
    dir: nextDir,
  });

  return (
    <th className={`${styles.th} ${align === "right" ? styles.thRight : ""}`}>
      <Link
        href={href}
        scroll={false}
        className={`${styles.sortLink} ${isActive ? styles.sortLinkActive : ""}`}
      >
        <span>{label}</span>
        {isActive ? (
          current.dir === "asc" ? (
            <ArrowUp size={11} />
          ) : (
            <ArrowDown size={11} />
          )
        ) : (
          <ArrowUpDown size={11} className={styles.sortIconIdle} />
        )}
      </Link>
    </th>
  );
}

function Th({ label }: { label: string }) {
  return <th className={styles.th}>{label}</th>;
}

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
    <td
      className={`${styles.td} ${align === "right" ? styles.alignRight : ""}`}
    >
      <Link href={href} className={styles.cellLink}>
        {children}
      </Link>
    </td>
  );
}
