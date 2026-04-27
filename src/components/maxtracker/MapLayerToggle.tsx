"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Layers,
  Map as MapIcon,
  Moon,
  Satellite,
} from "lucide-react";
import styles from "./MapLayerToggle.module.css";

// ═══════════════════════════════════════════════════════════════
//  MapLayerToggle · compact dropdown for basemap selection
// ═══════════════════════════════════════════════════════════════

export type MapLayer = "STANDARD" | "BW" | "SATELLITE";

interface OptionDef {
  key: MapLayer;
  label: string;
  icon: React.ReactNode;
}

const OPTIONS: OptionDef[] = [
  {
    key: "STANDARD",
    label: "Estándar",
    icon: <MapIcon size={13} />,
  },
  {
    key: "BW",
    label: "Blanco y negro",
    icon: <Moon size={13} />,
  },
  {
    key: "SATELLITE",
    label: "Satélite",
    icon: <Satellite size={13} />,
  },
];

interface MapLayerToggleProps {
  value: MapLayer;
  onChange: (next: MapLayer) => void;
}

export function MapLayerToggle({ value, onChange }: MapLayerToggleProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  const current = OPTIONS.find((o) => o.key === value) ?? OPTIONS[0]!;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Capa · ${current.label}`}
      >
        <Layers size={13} className={styles.triggerLeadIcon} />
        <span className={styles.triggerIconWrap}>{current.icon}</span>
        <ChevronDown size={11} className={styles.triggerChev} />
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="option"
              aria-selected={value === opt.key}
              className={`${styles.menuItem} ${
                value === opt.key ? styles.menuItemActive : ""
              }`}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
            >
              <span className={styles.menuItemIcon}>{opt.icon}</span>
              <span className={styles.menuItemLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
