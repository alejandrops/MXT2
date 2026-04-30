"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  buildAlarmsHref,
  hasActiveAlarmFilters,
  type AlarmsSearchParams,
} from "@/lib/url-alarms";
import {
  ALARM_STATUS_LABEL,
  ALARM_TYPE_LABEL,
  SEVERITY_LABEL,
} from "@/lib/format";
import type { AlarmStatus, AlarmType, Severity } from "@/types/domain";
import styles from "./AlarmFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  AlarmFilterBar
//  ─────────────────────────────────────────────────────────────
//  Client component for /seguridad/alarmas. Mirror of
//  AssetFilterBar but with alarm-specific filters.
//
//  Filters: search (asset name/plate), status, severity, type,
//  account.
//
//  Search commits on Enter or blur (not per-keystroke), all the
//  others on change.
// ═══════════════════════════════════════════════════════════════

interface AlarmFilterBarProps {
  current: AlarmsSearchParams;
  accounts: { id: string; name: string }[];
}

const STATUS_OPTIONS: AlarmStatus[] = [
  "OPEN",
  "ATTENDED",
  "CLOSED",
  "DISMISSED",
];
const SEVERITY_OPTIONS: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// Only Seguridad-domain alarm types appear here. This is the
// inbox of the Seguridad module — Conducción alarms (HARSH_DRIVING_PATTERN
// etc.) live in their own /conduccion module (future).
const TYPE_OPTIONS: AlarmType[] = [
  "PANIC",
  "UNAUTHORIZED_USE",
  "SABOTAGE",
  "GPS_DISCONNECT",
  "POWER_DISCONNECT",
  "JAMMING",
  "TRAILER_DETACH",
  "CARGO_BREACH",
  "DOOR_BREACH",
  "GEOFENCE_BREACH_CRITICAL",
  "DEVICE_OFFLINE",
];

export function AlarmFilterBar({ current, accounts }: AlarmFilterBarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(current.search ?? "");

  function nav(override: Partial<AlarmsSearchParams>) {
    const href = buildAlarmsHref(current, override);
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
          placeholder="Buscar por asset (nombre o patente)…"
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

      {/* ── Status ─────────────────────────────────────────── */}
      <Select
        label="Estado"
        value={current.status}
        options={STATUS_OPTIONS.map((s) => ({
          value: s,
          label: ALARM_STATUS_LABEL[s] ?? s,
        }))}
        onChange={(v) => nav({ status: v as AlarmStatus | null })}
      />

      {/* ── Severity ───────────────────────────────────────── */}
      <Select
        label="Severidad"
        value={current.severity}
        options={SEVERITY_OPTIONS.map((s) => ({
          value: s,
          label: SEVERITY_LABEL[s] ?? s,
        }))}
        onChange={(v) => nav({ severity: v as Severity | null })}
      />

      {/* ── Type ───────────────────────────────────────────── */}
      <Select
        label="Tipo"
        value={current.type}
        options={TYPE_OPTIONS.map((t) => ({
          value: t,
          label: ALARM_TYPE_LABEL[t] ?? t,
        }))}
        onChange={(v) => nav({ type: v as AlarmType | null })}
      />

      {/* ── Account ────────────────────────────────────────── */}
      {accounts.length > 1 && (
        <Select
        label="Cuenta"
        value={current.accountId}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        onChange={(v) => nav({ accountId: v })}
      />
      )}

      {/* ── Clear all ──────────────────────────────────────── */}
      {hasActiveAlarmFilters(current) && (
        <Link
          href="/seguridad/alarmas"
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
//  Identical pattern to AssetFilterBar's Select. Could be
//  extracted to a shared primitive later (Lote 4 form components).
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
