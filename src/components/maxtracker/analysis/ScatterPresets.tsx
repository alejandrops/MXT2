"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ActivityMetric } from "@/lib/queries";
import styles from "./ScatterPresets.module.css";

// ═══════════════════════════════════════════════════════════════
//  ScatterPresets · selector de preset configurado para Scatter
//  ─────────────────────────────────────────────────────────────
//  Los presets representan combinaciones X / Y / invertY que
//  responden a preguntas operativas frecuentes:
//
//    · "Choferes seguros"       · distancia × excesos · Y invertida
//    · "Vehículos eficientes"    · distancia × ralentí · Y invertida
//    · "Uso vs eventos"          · horas activas × eventos · Y invertida
//    · "Personalizado"           · X / Y / invertY libres
//
//  En todos los presets con Y invertida, el cuadrante "ideal"
//  queda arriba-derecha · ojo entrenado para detectar performance.
// ═══════════════════════════════════════════════════════════════

export type ScatterPresetKey =
  | "drivers-safety"
  | "vehicles-efficiency"
  | "use-events"
  | "custom";

export interface ScatterPreset {
  key: ScatterPresetKey;
  label: string;
  desc: string;
  x: ActivityMetric | null;
  y: ActivityMetric | null;
  invertY: boolean;
}

export const SCATTER_PRESETS: ScatterPreset[] = [
  {
    key: "drivers-safety",
    label: "Choferes seguros",
    desc: "Distancia × Excesos · 0 infracciones arriba",
    x: "distanceKm",
    y: "speedingCount",
    invertY: true,
  },
  {
    key: "vehicles-efficiency",
    label: "Vehículos eficientes",
    desc: "Distancia × Ralentí · 0 idle arriba",
    x: "distanceKm",
    y: "idleMin",
    invertY: true,
  },
  {
    key: "use-events",
    label: "Uso vs eventos",
    desc: "Horas activas × Eventos · 0 eventos arriba",
    x: "activeMin",
    y: "eventCount",
    invertY: true,
  },
  {
    key: "custom",
    label: "Personalizado",
    desc: "Elegir métricas y dirección libremente",
    x: null,
    y: null,
    invertY: false,
  },
];

/** Detecta qué preset matchea el estado actual · "custom" si nada matchea */
export function detectPreset(
  x: ActivityMetric,
  y: ActivityMetric,
  invertY: boolean,
): ScatterPresetKey {
  for (const p of SCATTER_PRESETS) {
    if (p.key === "custom") continue;
    if (p.x === x && p.y === y && p.invertY === invertY) {
      return p.key;
    }
  }
  return "custom";
}

interface Props {
  value: ScatterPresetKey;
  onChange: (preset: ScatterPreset) => void;
}

export function ScatterPresetsSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = SCATTER_PRESETS.find((p) => p.key === value)
    ?? SCATTER_PRESETS[SCATTER_PRESETS.length - 1]!;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.triggerLabel}>Preset:</span>
        <span className={styles.triggerValue}>{current.label}</span>
        <ChevronDown size={11} className={styles.triggerChev} />
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          {SCATTER_PRESETS.map((p) => {
            const active = p.key === value;
            return (
              <button
                key={p.key}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.option} ${active ? styles.optionActive : ""}`}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
              >
                <span className={styles.optionLabel}>{p.label}</span>
                <span className={styles.optionDesc}>{p.desc}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
