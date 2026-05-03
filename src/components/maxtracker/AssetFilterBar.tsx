"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  buildAssetsHref,
  hasActiveFilters,
  type AssetsSearchParams,
} from "@/lib/url";
import { ASSET_STATUS_LABEL, MOBILITY_LABEL } from "@/lib/format";
import type { AssetStatus, MobilityType } from "@/types/domain";
import { FilterFieldGroup, SelectField, SearchField } from "./ui";
import styles from "./AssetFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetFilterBar · L3-style-2 · Alt 2 (zonas con labels)
//  ─────────────────────────────────────────────────────────────
//  Layout enterprise · cada filtro es un FilterFieldGroup con
//  label uppercase chiquito arriba para coherencia con Trips,
//  Historial y Boletín.
//
//   BÚSQUEDA       CUENTA      GRUPO     ESTADO     MOVILIDAD
//   [____________] [...]       [...]     [...]      [...]
//
//  Cada control es independiente · solo afecta su param URL.
//  Search commits on Enter o blur (no en cada keystroke).
// ═══════════════════════════════════════════════════════════════

interface AssetFilterBarProps {
  current: AssetsSearchParams;
  accounts: { id: string; name: string }[];
  groups: { id: string; name: string; accountId: string }[];
}

const STATUS_OPTIONS: AssetStatus[] = [
  "MOVING",
  "IDLE",
  "STOPPED",
  "OFFLINE",
  "MAINTENANCE",
];
const MOBILITY_OPTIONS: MobilityType[] = ["MOBILE", "FIXED"];

export function AssetFilterBar({
  current,
  accounts,
  groups,
}: AssetFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Filter visible groups by active account
  const visibleGroups = current.accountId
    ? groups.filter((g) => g.accountId === current.accountId)
    : groups;

  function nav(override: Partial<AssetsSearchParams>) {
    const href = buildAssetsHref(current, override);
    startTransition(() => router.push(href));
  }

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Búsqueda">
        <SearchField
          value={current.search ?? null}
          onCommit={(v) => nav({ search: v })}
          placeholder="Nombre o patente…"
          width="240px"
        />
      </FilterFieldGroup>

      {accounts.length > 1 && (
        <FilterFieldGroup label="Cuenta">
          <SelectField
            label="Cuenta"
            value={current.accountId}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            onChange={(v) =>
              nav({ accountId: v, groupId: null })
            }
            variant="bare"
          />
        </FilterFieldGroup>
      )}

      <FilterFieldGroup label="Grupo">
        <SelectField
          label="Grupo"
          value={current.groupId}
          options={visibleGroups.map((g) => ({ value: g.id, label: g.name }))}
          onChange={(v) => nav({ groupId: v })}
          variant="bare"
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Estado">
        <SelectField
          label="Estado"
          value={current.status}
          options={STATUS_OPTIONS.map((s) => ({
            value: s,
            label: ASSET_STATUS_LABEL[s] ?? s,
          }))}
          onChange={(v) => nav({ status: v as AssetStatus | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Movilidad">
        <SelectField
          label="Movilidad"
          value={current.mobility}
          options={MOBILITY_OPTIONS.map((m) => ({
            value: m,
            label: MOBILITY_LABEL[m] ?? m,
          }))}
          onChange={(v) => nav({ mobility: v as MobilityType | null })}
          variant="bare"
        />
      </FilterFieldGroup>

      {hasActiveFilters(current) && (
        <Link
          href="/gestion/vehiculos"
          className={styles.clearAll}
          scroll={false}
        >
          <X size={11} />
          Limpiar
        </Link>
      )}
    </div>
  );
}
