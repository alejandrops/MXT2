"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  buildDriversHref,
  type DriversSearchParams,
} from "@/lib/url-drivers";
import styles from "./DriverFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  DriverFilterBar
//  ─────────────────────────────────────────────────────────────
//  Twin of AssetFilterBar adapted for /catalogos/conductores:
//    · Search by name or document
//    · Account select
//    · Status pill: Todos / Activos / Inactivos
// ═══════════════════════════════════════════════════════════════

interface DriverFilterBarProps {
  current: DriversSearchParams;
  accounts: { id: string; name: string }[];
}

const STATUS_PILLS: { value: "active" | "inactive" | null; label: string }[] = [
  { value: null, label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

export function DriverFilterBar({ current, accounts }: DriverFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(current.search ?? "");

  function nav(override: Partial<DriversSearchParams>) {
    startTransition(() => router.push(buildDriversHref(current, override)));
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

  const hasFilters =
    current.search !== null ||
    current.accountId !== null ||
    current.status !== null;

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
          placeholder="Buscar por nombre o documento…"
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
        onChange={(v) => nav({ accountId: v })}
      />

      {/* ── Status pills ───────────────────────────────────── */}
      <div className={styles.pillsGroup}>
        {STATUS_PILLS.map((p) => {
          const active = current.status === p.value;
          return (
            <button
              key={String(p.value ?? "all")}
              type="button"
              className={`${styles.pill} ${active ? styles.pillActive : ""}`}
              onClick={() => nav({ status: p.value })}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Clear all ──────────────────────────────────────── */}
      {hasFilters && (
        <Link
          href="/catalogos/conductores"
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
//  Local Select · styled native
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
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value)
        }
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
