"use client";

import {
  Calendar,
  ChevronDown,
  Truck,
  Users,
  UserCircle,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetForFilter } from "@/lib/queries/historicos";
import type { GroupForFilter } from "@/lib/queries/groups";
import type { DriverForFilter } from "@/lib/queries/persons";
import { buildTripsHref, type TripsParams } from "@/lib/url-trips";
import styles from "./TripsFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripsFilterBar · range + multi-select filters
//  ─────────────────────────────────────────────────────────────
//  Drives URL state. Three multi-select pickers:
//    · Vehículos    (one or more assets · empty = all)
//    · Grupos       (one or more groups · empty = all)
//    · Conductores  (one or more drivers · empty = all)
//
//  Plus the date range and quick presets.
// ═══════════════════════════════════════════════════════════════

interface TripsFilterBarProps {
  current: TripsParams;
  assets: AssetForFilter[];
  groups: GroupForFilter[];
  drivers: DriverForFilter[];
}

export function TripsFilterBar({
  current,
  assets,
  groups,
  drivers,
}: TripsFilterBarProps) {
  const router = useRouter();

  function applyDate(field: "fromDate" | "toDate", value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    router.push(buildTripsHref(current, { [field]: value }));
  }

  function applyPreset(preset: "yesterday" | "7d" | "30d") {
    const today = new Date("2026-04-26T12:00:00.000Z");
    let from: Date, to: Date;
    if (preset === "yesterday") {
      from = new Date(today.getTime() - 1 * 86400000);
      to = from;
    } else if (preset === "7d") {
      from = new Date(today.getTime() - 6 * 86400000);
      to = today;
    } else {
      from = new Date(today.getTime() - 29 * 86400000);
      to = today;
    }
    router.push(
      buildTripsHref(current, {
        fromDate: ymd(from),
        toDate: ymd(to),
      }),
    );
  }

  const hasActive =
    current.assetIds.length > 0 ||
    current.groupIds.length > 0 ||
    current.personIds.length > 0;

  return (
    <div className={styles.bar}>
      <div className={styles.dateBlock}>
        <Calendar size={13} className={styles.dateIcon} />
        <input
          type="date"
          className={styles.dateInput}
          value={current.fromDate}
          max={current.toDate}
          onChange={(e) => applyDate("fromDate", e.target.value)}
        />
        <span className={styles.dateSep}>→</span>
        <input
          type="date"
          className={styles.dateInput}
          value={current.toDate}
          min={current.fromDate}
          onChange={(e) => applyDate("toDate", e.target.value)}
        />
      </div>

      <div className={styles.presets}>
        <button
          type="button"
          className={styles.preset}
          onClick={() => applyPreset("yesterday")}
        >
          Ayer
        </button>
        <button
          type="button"
          className={styles.preset}
          onClick={() => applyPreset("7d")}
        >
          7 días
        </button>
        <button
          type="button"
          className={styles.preset}
          onClick={() => applyPreset("30d")}
        >
          30 días
        </button>
      </div>

      <div className={styles.spacer} />

      {/* ── Multi-select pickers ────────────────────────────── */}
      <MultiSelectPicker
        label="Vehículos"
        icon={<Truck size={12} />}
        emptyLabel="Toda la flota"
        options={assets.map((a) => ({
          id: a.id,
          label: a.name,
          sublabel: a.plate ?? undefined,
        }))}
        selectedIds={current.assetIds}
        onChange={(ids) =>
          router.push(buildTripsHref(current, { assetIds: ids }))
        }
      />

      <MultiSelectPicker
        label="Grupos"
        icon={<Users size={12} />}
        emptyLabel="Todos los grupos"
        options={groups.map((g) => ({ id: g.id, label: g.name }))}
        selectedIds={current.groupIds}
        onChange={(ids) =>
          router.push(buildTripsHref(current, { groupIds: ids }))
        }
      />

      <MultiSelectPicker
        label="Conductores"
        icon={<UserCircle size={12} />}
        emptyLabel="Todos"
        options={drivers.map((d) => ({
          id: d.id,
          label: `${d.firstName} ${d.lastName}`,
        }))}
        selectedIds={current.personIds}
        onChange={(ids) =>
          router.push(buildTripsHref(current, { personIds: ids }))
        }
      />

      {hasActive && (
        <button
          type="button"
          className={styles.clearAll}
          onClick={() =>
            router.push(
              buildTripsHref(current, {
                assetIds: [],
                groupIds: [],
                personIds: [],
              }),
            )
          }
        >
          <X size={11} />
          Limpiar
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MultiSelectPicker · self-contained dropdown with search
// ═══════════════════════════════════════════════════════════════

interface MultiOption {
  id: string;
  label: string;
  sublabel?: string;
}

function MultiSelectPicker({
  label,
  icon,
  emptyLabel,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  emptyLabel: string;
  options: MultiOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const buttonLabel =
    selectedIds.length === 0
      ? emptyLabel
      : selectedIds.length === 1
        ? options.find((o) => o.id === selectedIds[0])?.label ?? "1"
        : `${selectedIds.length} ${label.toLowerCase()}`;

  const isEmpty = selectedIds.length === 0;

  return (
    <div ref={wrapRef} className={styles.pickerWrap}>
      <button
        type="button"
        className={`${styles.pickerButton} ${
          isEmpty ? "" : styles.pickerButtonActive
        }`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.pickerIcon}>{icon}</span>
        <span className={styles.pickerText}>{buttonLabel}</span>
        <ChevronDown size={11} className={styles.pickerChev} />
      </button>

      {open && (
        <div className={styles.pickerDropdown} role="dialog">
          <div className={styles.pickerHeader}>
            <input
              type="search"
              className={styles.pickerSearch}
              placeholder={`Buscar ${label.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {selectedIds.length > 0 && (
              <button
                type="button"
                className={styles.pickerClear}
                onClick={() => onChange([])}
              >
                Limpiar ({selectedIds.length})
              </button>
            )}
          </div>

          <div className={styles.pickerList}>
            {filtered.length === 0 ? (
              <div className={styles.pickerEmpty}>Sin resultados</div>
            ) : (
              filtered.map((opt) => {
                const checked = selectedIds.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`${styles.pickerOption} ${
                      checked ? styles.pickerOptionChecked : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className={styles.pickerCheckbox}
                      checked={checked}
                      onChange={() => toggle(opt.id)}
                    />
                    <span className={styles.pickerOptionLabel}>
                      {opt.label}
                      {opt.sublabel && (
                        <span className={styles.pickerOptionSub}>
                          {opt.sublabel}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
