"use client";

import {
  ChevronDown,
  Truck,
  Users,
  UserCircle,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { AssetForFilter } from "@/lib/queries/historicos";
import type { GroupForFilter } from "@/lib/queries/groups";
import type { DriverForFilter } from "@/lib/queries/persons";
import { buildTripsHref, type TripsParams } from "@/lib/url-trips";
import { TimeRangePicker } from "./time";
import { FilterFieldGroup } from "./ui/FilterFieldGroup";
import styles from "./TripsFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripsFilterBar · L3-style · range + multi-select con FilterFieldGroup
//  ─────────────────────────────────────────────────────────────
//  Layout enterprise · zonas con label uppercase chiquito arriba
//  para coherencia visual con HistoricosFilterBar y otros futuros.
//
//   PERÍODO          VEHÍCULOS     GRUPOS    CONDUCTORES
//   [📅 ... ›]       [..]          [..]      [..]
//
//  Filters:
//    · time range   (TimeRangePicker · rango libre + presets)
//    · vehículos    (one or more assets · empty = all)
//    · grupos       (one or more groups · empty = all)
//    · conductores  (one or more drivers · empty = all)
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
  const [, startTransition] = useTransition();

  // PERF-1 · todos los router.push() pasan por nav() que los
  // envuelve en startTransition · evita bloquear la UI durante la
  // navegación al cambiar filtros.
  function nav(href: string) {
    startTransition(() => router.push(href));
  }

  // L3 · "today" hardcoded a la fecha del demo seed para que los
  // presets relativos ("Ayer", "7 días") matcheen con la data
  // disponible. En producción se quita el override y usa Date.now().
  const today = useMemo(() => new Date("2026-04-26T12:00:00.000Z"), []);

  const hasActive =
    current.assetIds.length > 0 ||
    current.groupIds.length > 0 ||
    current.personIds.length > 0;

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Período">
        <TimeRangePicker
          value={{ from: current.fromDate, to: current.toDate }}
          onChange={(next) =>
            nav(
              buildTripsHref(current, {
                fromDate: next.from,
                toDate: next.to,
              }),
            )
          }
          presets={["yesterday", "7d", "30d"]}
          today={today}
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Vehículos">
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
            nav(buildTripsHref(current, { assetIds: ids }))
          }
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Grupos">
        <MultiSelectPicker
          label="Grupos"
          icon={<Users size={12} />}
          emptyLabel="Todos los grupos"
          options={groups.map((g) => ({ id: g.id, label: g.name }))}
          selectedIds={current.groupIds}
          onChange={(ids) =>
            nav(buildTripsHref(current, { groupIds: ids }))
          }
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Conductores">
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
            nav(buildTripsHref(current, { personIds: ids }))
          }
        />
      </FilterFieldGroup>

      {hasActive && (
        <button
          type="button"
          className={styles.clearAll}
          onClick={() =>
            nav(
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
