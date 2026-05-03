"use client";

import { ChevronDown, Truck, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import { FilterFieldGroup } from "./ui";
import styles from "./FleetFilterBar.module.css";

// ═══════════════════════════════════════════════════════════════
//  FleetFilterBar · L3-style-2 · narrow which vehicles render
//  ─────────────────────────────────────────────────────────────
//  Drives FleetTrackingClient's `visibleAssets`. Layout:
//
//   GRUPOS              VEHÍCULOS         [Mostrando X de Y] [Limpiar]
//   [...]               [...]
// ═══════════════════════════════════════════════════════════════

interface FleetFilterBarProps {
  assets: FleetAssetLive[];
  selectedGroupIds: string[];
  selectedAssetIds: string[];
  onChangeGroups: (ids: string[]) => void;
  onChangeAssets: (ids: string[]) => void;
}

export function FleetFilterBar({
  assets,
  selectedGroupIds,
  selectedAssetIds,
  onChangeGroups,
  onChangeAssets,
}: FleetFilterBarProps) {
  // Derive groups list from the assets
  const groups = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) {
      if (a.groupId && a.groupName && !map.has(a.groupId)) {
        map.set(a.groupId, a.groupName);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, label: name })).sort(
      (a, b) => a.label.localeCompare(b.label, "es"),
    );
  }, [assets]);

  const assetOptions = useMemo(
    () =>
      assets
        .map((a) => ({
          id: a.id,
          label: a.name,
          sublabel: a.plate ?? undefined,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [assets],
  );

  const hasActive =
    selectedGroupIds.length > 0 || selectedAssetIds.length > 0;

  // Visible / matched count after filter
  const visibleCount = useMemo(() => {
    return assets.filter((a) => {
      if (
        selectedGroupIds.length > 0 &&
        (!a.groupId || !selectedGroupIds.includes(a.groupId))
      ) {
        return false;
      }
      if (
        selectedAssetIds.length > 0 &&
        !selectedAssetIds.includes(a.id)
      ) {
        return false;
      }
      return true;
    }).length;
  }, [assets, selectedGroupIds, selectedAssetIds]);

  return (
    <div className={styles.bar}>
      <FilterFieldGroup label="Grupos">
        <MultiPicker
          label="Grupos"
          icon={<Users size={12} />}
          emptyLabel="Todos"
          options={groups}
          selectedIds={selectedGroupIds}
          onChange={onChangeGroups}
        />
      </FilterFieldGroup>

      <FilterFieldGroup label="Vehículos">
        <MultiPicker
          label="Vehículos"
          icon={<Truck size={12} />}
          emptyLabel="Todos"
          options={assetOptions}
          selectedIds={selectedAssetIds}
          onChange={onChangeAssets}
        />
      </FilterFieldGroup>

      <div className={styles.spacer} />

      <span className={styles.summary}>
        Mostrando <strong>{visibleCount}</strong> de {assets.length}
      </span>

      {hasActive && (
        <button
          type="button"
          className={styles.clearAll}
          onClick={() => {
            onChangeGroups([]);
            onChangeAssets([]);
          }}
        >
          <X size={11} />
          Limpiar
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MultiPicker · same pattern as TripsFilterBar's picker
// ═══════════════════════════════════════════════════════════════

interface MultiOption {
  id: string;
  label: string;
  sublabel?: string;
}

function MultiPicker({
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
    function onDoc(e: MouseEvent) {
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
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
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
        <span className={styles.pickerText}>
          {label}: {buttonLabel}
        </span>
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
