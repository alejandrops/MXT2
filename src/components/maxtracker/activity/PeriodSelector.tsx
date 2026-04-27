"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import type { ActivityPreset } from "@/lib/queries/activity";
import styles from "./PeriodSelector.module.css";

// ═══════════════════════════════════════════════════════════════
//  PeriodSelector · selector de período compartido por todas las
//  sub-pantallas de Actividad.
//  ─────────────────────────────────────────────────────────────
//  Presets: Hoy · Ayer · 7 días · 30 días · Personalizado
//  Custom: 2 inputs date AR-local (YYYY-MM-DD)
// ═══════════════════════════════════════════════════════════════

interface Props {
  preset: ActivityPreset;
  customFrom: string | null;
  customTo: string | null;
  onChange: (next: {
    preset: ActivityPreset;
    customFrom: string | null;
    customTo: string | null;
  }) => void;
}

const PRESET_LABELS: Record<ActivityPreset, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  custom: "Personalizado",
};

const PRESET_ORDER: ActivityPreset[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "custom",
];

export function PeriodSelector({
  preset,
  customFrom,
  customTo,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [draftFrom, setDraftFrom] = useState(customFrom ?? "");
  const [draftTo, setDraftTo] = useState(customTo ?? "");

  useEffect(() => {
    setDraftFrom(customFrom ?? "");
    setDraftTo(customTo ?? "");
  }, [customFrom, customTo]);

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

  function applyPreset(p: ActivityPreset) {
    if (p === "custom") {
      onChange({
        preset: "custom",
        customFrom: draftFrom || customFrom,
        customTo: draftTo || customTo,
      });
    } else {
      onChange({ preset: p, customFrom: null, customTo: null });
    }
    setOpen(false);
  }

  function applyCustom() {
    if (draftFrom && draftTo) {
      onChange({
        preset: "custom",
        customFrom: draftFrom,
        customTo: draftTo,
      });
      setOpen(false);
    }
  }

  const triggerLabel =
    preset === "custom" && customFrom && customTo
      ? `${customFrom} → ${customTo}`
      : PRESET_LABELS[preset];

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Calendar size={12} />
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <ChevronDown size={11} className={styles.triggerChev} />
      </button>
      {open && (
        <div className={styles.menu} role="dialog">
          <div className={styles.presets}>
            {PRESET_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.preset} ${
                  preset === p ? styles.presetActive : ""
                }`}
                onClick={() => applyPreset(p)}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          <div className={styles.customWrap}>
            <div className={styles.customRow}>
              <label className={styles.customLabel}>Desde</label>
              <input
                type="date"
                className={styles.dateInput}
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </div>
            <div className={styles.customRow}>
              <label className={styles.customLabel}>Hasta</label>
              <input
                type="date"
                className={styles.dateInput}
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={styles.applyBtn}
              disabled={
                !draftFrom || !draftTo || draftFrom > draftTo
              }
              onClick={applyCustom}
            >
              Aplicar rango
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
