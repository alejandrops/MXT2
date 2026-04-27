"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import type { SelectionMode } from "./MultiMapGrid";
import { MotorGlyph } from "./MotorGlyph";
import styles from "./VehicleSelectorModal.module.css";

// ═══════════════════════════════════════════════════════════════
//  VehicleSelectorModal · pick vehicles for the multi-map grid
//  ─────────────────────────────────────────────────────────────
//  Shows the full fleet as a checkable list. Two modes:
//    · Auto      · system picks moving vehicles, refreshed live
//    · Manual    · user checks specific vehicles
//
//  Filters: search by name/plate. Quick chips to filter by status.
// ═══════════════════════════════════════════════════════════════

interface VehicleSelectorModalProps {
  open: boolean;
  assets: FleetAssetLive[];
  initialMode: SelectionMode;
  initialSelectedIds: string[];
  onClose: () => void;
  onApply: (mode: SelectionMode, selectedIds: string[]) => void;
}

export function VehicleSelectorModal({
  open,
  assets,
  initialMode,
  initialSelectedIds,
  onClose,
  onApply,
}: VehicleSelectorModalProps) {
  const [mode, setMode] = useState<SelectionMode>(initialMode);
  const [selectedIds, setSelectedIds] =
    useState<string[]>(initialSelectedIds);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "MOVING" | "STOPPED" | "OFF"
  >("ALL");

  // Reset internal state when reopened
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setSelectedIds(initialSelectedIds);
      setQuery("");
      setStatusFilter("ALL");
    }
  }, [open, initialMode, initialSelectedIds]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (statusFilter !== "ALL" && a.motorState !== statusFilter)
        return false;
      if (!q) return true;
      const tokens = q.split(/\s+/);
      const hay = [a.name, a.plate, a.make, a.model]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [assets, query, statusFilter]);

  const counts = useMemo(() => {
    const c = { ALL: assets.length, MOVING: 0, STOPPED: 0, OFF: 0 };
    for (const a of assets) c[a.motorState]++;
    return c;
  }, [assets]);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllVisible() {
    const visibleIds = filtered.map((a) => a.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  function clearAll() {
    setSelectedIds([]);
  }

  function handleApply() {
    onApply(mode, selectedIds);
    onClose();
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Vehículos a supervisar</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </header>

        {/* ── Mode picker ──────────────────────────────────── */}
        <div className={styles.modeRow}>
          <label
            className={`${styles.modeOpt} ${
              mode === "auto" ? styles.modeOptActive : ""
            }`}
          >
            <input
              type="radio"
              name="selection-mode"
              checked={mode === "auto"}
              onChange={() => setMode("auto")}
              className={styles.modeRadio}
            />
            <Sparkles size={13} />
            <div className={styles.modeText}>
              <span className={styles.modeLabel}>Auto</span>
              <span className={styles.modeDesc}>
                El sistema elige los más relevantes (en movimiento primero)
              </span>
            </div>
          </label>
          <label
            className={`${styles.modeOpt} ${
              mode === "manual" ? styles.modeOptActive : ""
            }`}
          >
            <input
              type="radio"
              name="selection-mode"
              checked={mode === "manual"}
              onChange={() => setMode("manual")}
              className={styles.modeRadio}
            />
            <div className={styles.modeText}>
              <span className={styles.modeLabel}>Manual</span>
              <span className={styles.modeDesc}>
                Elegí vehículos específicos (la lista de abajo)
              </span>
            </div>
          </label>
        </div>

        {/* ── Search + chips ──────────────────────────────── */}
        <div
          className={`${styles.filters} ${
            mode === "auto" ? styles.filtersDimmed : ""
          }`}
        >
          <div className={styles.searchRow}>
            <Search size={12} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Buscar nombre, patente, marca…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={mode === "auto"}
            />
          </div>
          <div className={styles.chips}>
            {(
              [
                { k: "ALL" as const, label: "Todos" },
                { k: "MOVING" as const, label: "En movimiento" },
                { k: "STOPPED" as const, label: "Detenidos" },
                { k: "OFF" as const, label: "Apagados" },
              ]
            ).map((f) => (
              <button
                key={f.k}
                type="button"
                disabled={mode === "auto"}
                className={`${styles.chip} ${
                  statusFilter === f.k ? styles.chipActive : ""
                }`}
                onClick={() => setStatusFilter(f.k)}
              >
                {f.label}
                <span className={styles.chipCount}>{counts[f.k]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── List ────────────────────────────────────────── */}
        <div
          className={`${styles.list} ${
            mode === "auto" ? styles.listDimmed : ""
          }`}
        >
          {filtered.length === 0 ? (
            <div className={styles.emptyList}>Sin resultados.</div>
          ) : (
            filtered.map((a) => {
              const checked = selectedIds.includes(a.id);
              return (
                <label
                  key={a.id}
                  className={`${styles.row} ${
                    checked ? styles.rowChecked : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={checked}
                    onChange={() => toggle(a.id)}
                    disabled={mode === "auto"}
                  />
                  <span
                    className={`${styles.shape} ${styles[`shape${a.motorState}`]}`}
                  >
                    <MotorGlyph state={a.motorState} size={10} />
                  </span>
                  <div className={styles.rowText}>
                    <div className={styles.rowName}>
                      {a.name}
                      {a.plate && (
                        <span className={styles.rowPlate}>{a.plate}</span>
                      )}
                    </div>
                    <div className={styles.rowMeta}>
                      <span
                        className={`${styles.commDot} ${
                          styles[`comm${a.commState}`]
                        }`}
                      />
                      {a.motorState === "MOVING"
                        ? `${Math.round(a.speedKmh)} km/h`
                        : motorLabel(a.motorState)}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className={styles.footer}>
          <div className={styles.footerLeft}>
            {mode === "manual" ? (
              <>
                <span className={styles.selectionCount}>
                  {selectedIds.length} seleccionados
                </span>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={selectAllVisible}
                >
                  Seleccionar todos visibles
                </button>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={clearAll}
                >
                  Limpiar
                </button>
              </>
            ) : (
              <span className={styles.selectionCount}>
                Modo automático activado
              </span>
            )}
          </div>
          <div className={styles.footerRight}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleApply}
            >
              Aplicar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════

function motorLabel(state: FleetAssetLive["motorState"]): string {
  if (state === "MOVING") return "En movimiento";
  if (state === "STOPPED") return "Detenido";
  return "Apagado";
}
