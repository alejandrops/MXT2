"use client";

import { ChevronDown, LayoutGrid, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./MapViewToggle.module.css";

// ═══════════════════════════════════════════════════════════════
//  MapViewToggle · "Vista única" vs "Mosaico"
//  ─────────────────────────────────────────────────────────────
//  Replaces the old GridLayoutToggle that confused users with a
//  flat list (Única, 2×2, 2×3, ...). Now has two clear modes:
//
//    · Vista única   · single-pane FleetMap (the live map)
//    · Mosaico       · grid of N maps (each pinned to one vehicle)
//
//  When mosaico is active, a small layout selector (2×2 / 2×3 / ...)
//  appears next to it.
//
//  See docs/design-system/shared-blocks.md for rationale.
// ═══════════════════════════════════════════════════════════════

export type GridLayout = "1" | "2x2" | "2x3" | "3x3" | "3x4" | "4x4";

export const GRID_SIZES: Record<GridLayout, { rows: number; cols: number }> = {
  "1": { rows: 1, cols: 1 },
  "2x2": { rows: 2, cols: 2 },
  "2x3": { rows: 2, cols: 3 },
  "3x3": { rows: 3, cols: 3 },
  "3x4": { rows: 3, cols: 4 },
  "4x4": { rows: 4, cols: 4 },
};

export function gridSlotCount(layout: GridLayout): number {
  const { rows, cols } = GRID_SIZES[layout];
  return rows * cols;
}

const MOSAIC_OPTIONS: GridLayout[] = ["2x2", "2x3", "3x3", "3x4", "4x4"];

const MOSAIC_LABELS: Record<GridLayout, string> = {
  "1": "Única",
  "2x2": "2×2",
  "2x3": "2×3",
  "3x3": "3×3",
  "3x4": "3×4",
  "4x4": "4×4",
};

interface MapViewToggleProps {
  value: GridLayout;
  onChange: (next: GridLayout) => void;
}

export function MapViewToggle({ value, onChange }: MapViewToggleProps) {
  const isSingle = value === "1";
  const [layoutOpen, setLayoutOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!layoutOpen) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setLayoutOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLayoutOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [layoutOpen]);

  // When user goes from single to mosaic, default to 2×2
  function activateMosaic() {
    if (isSingle) onChange("2x2");
  }
  function activateSingle() {
    if (!isSingle) onChange("1");
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.toggle} role="group" aria-label="Vista del mapa">
        <button
          type="button"
          className={`${styles.toggleBtn} ${
            isSingle ? styles.toggleBtnActive : ""
          }`}
          onClick={activateSingle}
          aria-pressed={isSingle}
          title="Vista única"
        >
          <Square size={12} />
          <span className={styles.toggleLabel}>Vista única</span>
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${
            !isSingle ? styles.toggleBtnActive : ""
          }`}
          onClick={activateMosaic}
          aria-pressed={!isSingle}
          title="Mosaico"
        >
          <LayoutGrid size={12} />
          <span className={styles.toggleLabel}>Mosaico</span>
        </button>
      </div>

      {/* Layout picker · only shown when mosaico is active */}
      {!isSingle && (
        <div className={styles.layoutWrap}>
          <button
            type="button"
            className={styles.layoutTrigger}
            onClick={() => setLayoutOpen((o) => !o)}
            aria-expanded={layoutOpen}
            title={`Layout · ${MOSAIC_LABELS[value]}`}
          >
            <span className={styles.layoutValue}>{MOSAIC_LABELS[value]}</span>
            <ChevronDown size={11} className={styles.layoutChev} />
          </button>
          {layoutOpen && (
            <div className={styles.layoutMenu} role="listbox">
              {MOSAIC_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={value === opt}
                  className={`${styles.layoutOption} ${
                    value === opt ? styles.layoutOptionActive : ""
                  }`}
                  onClick={() => {
                    onChange(opt);
                    setLayoutOpen(false);
                  }}
                >
                  {MOSAIC_LABELS[opt]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
