"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  buildAssetsHref,
  hasActiveFilters,
  type AssetsSearchParams,
} from "@/lib/url";
import {
  ASSET_STATUS_LABEL,
  MOBILITY_LABEL,
} from "@/lib/format";
import type { AssetStatus, MobilityType } from "@/types/domain";
import styles from "./AssetFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetFilterBar
//  ─────────────────────────────────────────────────────────────
//  Client component because it needs:
//    · Controlled search input (uncommitted text state)
//    · Programmatic navigation on dropdown change
//
//  Each control updates exactly one URL param. Search commits on
//  Enter or blur (not on every keystroke, which would thrash the
//  URL).
//
//  When the active account changes, the group dropdown resets —
//  groups are scoped to the parent account and showing groups
//  from a different account would be broken.
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
  const [searchValue, setSearchValue] = useState(current.search ?? "");

  // Filter the visible groups by the active account, if any.
  const visibleGroups = current.accountId
    ? groups.filter((g) => g.accountId === current.accountId)
    : groups;

  function nav(override: Partial<AssetsSearchParams>) {
    const href = buildAssetsHref(current, override);
    startTransition(() => router.push(href));
  }

  function commitSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = searchValue.trim();
    nav({ search: trimmed.length > 0 ? trimmed : null });
  }

  function clearSearch() {
    setSearchValue("");
    nav({ search: null });
  }

  return (
    <div className={styles.bar}>
      {/* ── Search ─────────────────────────────────────────── */}
      <form onSubmit={commitSearch} className={styles.searchForm}>
        <Search size={13} className={styles.searchIcon} />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onBlur={commitSearch}
          placeholder="Buscar por nombre o patente…"
          className={styles.searchInput}
        />
        {searchValue.length > 0 && (
          <button
            type="button"
            onClick={clearSearch}
            className={styles.clearBtn}
            aria-label="Limpiar búsqueda"
          >
            <X size={11} />
          </button>
        )}
      </form>

      {/* ── Account ────────────────────────────────────────── */}
      <Select
        label="Cuenta"
        value={current.accountId}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        onChange={(v) =>
          // Reset group when account changes since groups are scoped
          nav({ accountId: v, groupId: null })
        }
      />

      {/* ── Group ──────────────────────────────────────────── */}
      <Select
        label="Grupo"
        value={current.groupId}
        options={visibleGroups.map((g) => ({ value: g.id, label: g.name }))}
        onChange={(v) => nav({ groupId: v })}
      />

      {/* ── Status ─────────────────────────────────────────── */}
      <Select
        label="Estado"
        value={current.status}
        options={STATUS_OPTIONS.map((s) => ({
          value: s,
          label: ASSET_STATUS_LABEL[s] ?? s,
        }))}
        onChange={(v) => nav({ status: v as AssetStatus | null })}
      />

      {/* ── Mobility ───────────────────────────────────────── */}
      <Select
        label="Movilidad"
        value={current.mobility}
        options={MOBILITY_OPTIONS.map((m) => ({
          value: m,
          label: MOBILITY_LABEL[m] ?? m,
        }))}
        onChange={(v) => nav({ mobility: v as MobilityType | null })}
      />

      {/* ── Clear all ──────────────────────────────────────── */}
      {hasActiveFilters(current) && (
        <Link
          href="/gestion/vehiculos"
          className={styles.clearAll}
          scroll={false}
        >
          <X size={11} />
          Limpiar filtros
        </Link>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Local Select component
//  ─────────────────────────────────────────────────────────────
//  Native <select> styled to look like a pill. Native is the right
//  call for accessibility and mobile UX. Custom dropdowns come in
//  Lote 2+ if we need more advanced features (multi-select, async).
// ═══════════════════════════════════════════════════════════════

interface SelectProps {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
  const isActive = value !== null;
  return (
    <label
      className={`${styles.select} ${isActive ? styles.selectActive : ""}`}
    >
      <span className={styles.selectLabel}>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className={styles.selectNative}
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
