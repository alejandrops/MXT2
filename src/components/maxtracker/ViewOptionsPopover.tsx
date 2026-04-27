"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import styles from "./ViewOptionsPopover.module.css";

// ═══════════════════════════════════════════════════════════════
//  ViewOptionsPopover · UI preferences for the fleet map
//  ─────────────────────────────────────────────────────────────
//  Replaces what was a sidebar in legacy Maxtracker. Holds the
//  toggles that control how markers and clustering render. These
//  are USER preferences (not org config — that lives in
//  /configuracion).
// ═══════════════════════════════════════════════════════════════

export interface ViewOptions {
  showNoComm: boolean;
  showPlate: boolean;
  groupVehicles: boolean;
  colorByFleet: boolean;
  showVehicleTypeIcons: boolean;
  loadNearbyPoints: boolean;
  showTrail: boolean;
}

export const DEFAULT_VIEW_OPTIONS: ViewOptions = {
  showNoComm: true,
  showPlate: true,
  groupVehicles: true,
  colorByFleet: true,
  showVehicleTypeIcons: false,
  loadNearbyPoints: false,
  showTrail: true,
};

interface ViewOptionsPopoverProps {
  value: ViewOptions;
  onChange: (next: ViewOptions) => void;
}

interface ToggleConfig {
  key: keyof ViewOptions;
  label: string;
  description?: string;
  group: "markers" | "clustering" | "data";
}

const TOGGLES: ToggleConfig[] = [
  {
    key: "showPlate",
    label: "Mostrar patente",
    description: "Etiqueta debajo de cada marcador",
    group: "markers",
  },
  {
    key: "colorByFleet",
    label: "Color por flota",
    description: "Cada grupo tiene un color distinto",
    group: "markers",
  },
  {
    key: "showVehicleTypeIcons",
    label: "Íconos por tipo",
    description: "Camión / moto / silo en lugar de las formas",
    group: "markers",
  },
  {
    key: "groupVehicles",
    label: "Agrupar vehículos",
    description: "Agrupar por proximidad al alejar",
    group: "clustering",
  },
  {
    key: "showTrail",
    label: "Mostrar estela del recorrido",
    description: "Línea con el trayecto reciente del seleccionado",
    group: "clustering",
  },
  {
    key: "showNoComm",
    label: "Mostrar sin comunicación",
    description: "Incluir vehículos con > 48 horas sin reportar",
    group: "data",
  },
  {
    key: "loadNearbyPoints",
    label: "Cargar puntos cercanos",
    description: "Pre-cargar marcadores fuera del área visible",
    group: "data",
  },
];

const GROUP_LABEL: Record<ToggleConfig["group"], string> = {
  markers: "Marcadores",
  clustering: "Agrupación",
  data: "Datos",
};

export function ViewOptionsPopover({
  value,
  onChange,
}: ViewOptionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle(key: keyof ViewOptions) {
    onChange({ ...value, [key]: !value[key] });
  }

  // Group toggles by category for rendering
  const groups = TOGGLES.reduce<Record<string, ToggleConfig[]>>((acc, t) => {
    acc[t.group] ??= [];
    acc[t.group]!.push(t);
    return acc;
  }, {});

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Eye size={13} />
        <span>Vista</span>
        <ChevronDown size={11} className={styles.chev} />
      </button>

      {open && (
        <div className={styles.popover} role="dialog">
          {(["markers", "clustering", "data"] as const).map((groupKey) => (
            <div key={groupKey} className={styles.section}>
              <div className={styles.sectionTitle}>
                {GROUP_LABEL[groupKey]}
              </div>
              {groups[groupKey]?.map((t) => (
                <label key={t.key} className={styles.row}>
                  <div className={styles.rowText}>
                    <span className={styles.rowLabel}>{t.label}</span>
                    {t.description && (
                      <span className={styles.rowDesc}>{t.description}</span>
                    )}
                  </div>
                  <span
                    className={`${styles.switch} ${
                      value[t.key] ? styles.switchOn : ""
                    }`}
                    role="switch"
                    aria-checked={value[t.key]}
                  >
                    <input
                      type="checkbox"
                      checked={value[t.key]}
                      onChange={() => toggle(t.key)}
                      className={styles.input}
                    />
                    <span className={styles.thumb} />
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
