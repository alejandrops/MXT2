"use client";

import {
  ChevronDown,
  Grid3x3,
  LayoutGrid,
  Radar,
  Rows3,
  Square,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./MapViewToggle.module.css";

// ═══════════════════════════════════════════════════════════════
//  MapViewToggle · selector de modo de vista del Mapa
//  ─────────────────────────────────────────────────────────────
//  Cinco modos:
//    · mapa        · single-pane Leaflet con tiles claras
//    · mosaico     · grid de N mapas (cada uno fijado a un asset)
//    · scada       · single-pane oscuro + trails 5min + halos pulsantes
//    · aeropuerto  · tabla densa flight-board, cero mapa
//    · kanban      · 5 columnas de cards/chips por estado
//
//  Cuando el modo es "mosaico", aparece un sub-selector de layout
//  (2×2 / 2×3 / 3×3 / 3×4 / 4×4) al costado.
//  En los demás modos el sub-selector NO aparece (decisión de UX:
//  desaparece del DOM, no se desactiva).
//
//  Nota tipos:
//    · ViewMode  · qué pantalla se muestra (5-way enum)
//    · GridLayout · cómo se subdivide cuando ViewMode === "mosaico"
// ═══════════════════════════════════════════════════════════════

export type ViewMode = "mapa" | "mosaico" | "scada" | "aeropuerto" | "kanban";

export type GridLayout = "2x2" | "2x3" | "3x3" | "3x4" | "4x4";

export const GRID_SIZES: Record<GridLayout, { rows: number; cols: number }> = {
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

const GRID_OPTIONS: GridLayout[] = ["2x2", "2x3", "3x3", "3x4", "4x4"];

const GRID_LABELS: Record<GridLayout, string> = {
  "2x2": "2×2",
  "2x3": "2×3",
  "3x3": "3×3",
  "3x4": "3×4",
  "4x4": "4×4",
};

interface ModeOption {
  key: ViewMode;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
}

const MODE_OPTIONS: ModeOption[] = [
  { key: "mapa", label: "Mapa", Icon: Square },
  { key: "mosaico", label: "Mosaico", Icon: LayoutGrid },
  { key: "scada", label: "SCADA", Icon: Radar },
  { key: "aeropuerto", label: "Aeropuerto", Icon: Rows3 },
  { key: "kanban", label: "Kanban", Icon: Grid3x3 },
];

const MODE_BY_KEY: Record<ViewMode, ModeOption> = MODE_OPTIONS.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<ViewMode, ModeOption>,
);

interface MapViewToggleProps {
  /** Modo actual */
  mode: ViewMode;
  onModeChange: (next: ViewMode) => void;
  /** Sub-layout del mosaico · solo se usa cuando mode === "mosaico" */
  gridLayout: GridLayout;
  onGridLayoutChange: (next: GridLayout) => void;
}

export function MapViewToggle({
  mode,
  onModeChange,
  gridLayout,
  onGridLayoutChange,
}: MapViewToggleProps) {
  const [modeOpen, setModeOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close popovers on outside click / Escape
  useEffect(() => {
    if (!modeOpen && !gridOpen) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setModeOpen(false);
        setGridOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModeOpen(false);
        setGridOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [modeOpen, gridOpen]);

  const ActiveIcon = MODE_BY_KEY[mode].Icon;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {/* ── Dropdown de modo ─────────────────────────────────── */}
      <div className={styles.modeWrap}>
        <button
          type="button"
          className={styles.modeTrigger}
          onClick={() => {
            setModeOpen((o) => !o);
            setGridOpen(false);
          }}
          aria-expanded={modeOpen}
          title={`Vista · ${MODE_BY_KEY[mode].label}`}
        >
          <ActiveIcon size={12} />
          <span className={styles.modeLabel}>{MODE_BY_KEY[mode].label}</span>
          <ChevronDown size={11} className={styles.modeChev} />
        </button>
        {modeOpen && (
          <div className={styles.modeMenu} role="listbox">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.Icon;
              const isActive = opt.key === mode;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`${styles.modeOption} ${
                    isActive ? styles.modeOptionActive : ""
                  }`}
                  onClick={() => {
                    onModeChange(opt.key);
                    setModeOpen(false);
                  }}
                >
                  <Icon size={13} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sub-selector de layout · sólo en mosaico ────────── */}
      {mode === "mosaico" && (
        <div className={styles.layoutWrap}>
          <button
            type="button"
            className={styles.layoutTrigger}
            onClick={() => {
              setGridOpen((o) => !o);
              setModeOpen(false);
            }}
            aria-expanded={gridOpen}
            title={`Layout · ${GRID_LABELS[gridLayout]}`}
          >
            <span className={styles.layoutValue}>
              {GRID_LABELS[gridLayout]}
            </span>
            <ChevronDown size={11} className={styles.layoutChev} />
          </button>
          {gridOpen && (
            <div className={styles.layoutMenu} role="listbox">
              {GRID_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={gridLayout === opt}
                  className={`${styles.layoutOption} ${
                    gridLayout === opt ? styles.layoutOptionActive : ""
                  }`}
                  onClick={() => {
                    onGridLayoutChange(opt);
                    setGridOpen(false);
                  }}
                >
                  {GRID_LABELS[opt]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
