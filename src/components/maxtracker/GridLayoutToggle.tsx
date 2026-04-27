"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./GridLayoutToggle.module.css";

// ═══════════════════════════════════════════════════════════════
//  GridLayoutToggle · compact dropdown for multi-map layout
//  ─────────────────────────────────────────────────────────────
//  Button shows current grid as a mini-SVG so you can tell at a
//  glance whether you're in 1, 2×2, 3×3, etc.
//  Click → menu with all 6 options.
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

const LABELS: Record<GridLayout, string> = {
  "1": "Única",
  "2x2": "2×2",
  "2x3": "2×3",
  "3x3": "3×3",
  "3x4": "3×4",
  "4x4": "4×4",
};

export function gridSlotCount(layout: GridLayout): number {
  const { rows, cols } = GRID_SIZES[layout];
  return rows * cols;
}

const ALL_LAYOUTS: GridLayout[] = ["1", "2x2", "2x3", "3x3", "3x4", "4x4"];

interface GridLayoutToggleProps {
  value: GridLayout;
  onChange: (next: GridLayout) => void;
}

export function GridLayoutToggle({ value, onChange }: GridLayoutToggleProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Disposición · ${LABELS[value]}`}
      >
        <MiniGrid layout={value} size={14} />
        <span className={styles.triggerLabel}>{LABELS[value]}</span>
        <ChevronDown size={11} className={styles.triggerChev} />
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          {ALL_LAYOUTS.map((opt) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={value === opt}
              className={`${styles.menuItem} ${
                value === opt ? styles.menuItemActive : ""
              }`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              <MiniGrid layout={opt} size={14} />
              <span className={styles.menuLabel}>{LABELS[opt]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MiniGrid · SVG icon showing the layout shape at given size
// ═══════════════════════════════════════════════════════════════

function MiniGrid({
  layout,
  size,
}: {
  layout: GridLayout;
  size: number;
}) {
  const { rows, cols } = GRID_SIZES[layout];
  const VB = 14; // viewBox 14×14
  const padding = 1;
  const gap = 1.4;
  const cellW = (VB - padding * 2 - gap * (cols - 1)) / cols;
  const cellH = (VB - padding * 2 - gap * (rows - 1)) / rows;

  const rects: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rects.push({
        x: padding + c * (cellW + gap),
        y: padding + r * (cellH + gap),
        w: cellW,
        h: cellH,
      });
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      fill="currentColor"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx="0.6"
        />
      ))}
    </svg>
  );
}
