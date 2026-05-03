"use client";

import { ChevronLeft, ChevronRight, Calendar, Clock, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { computePreset, toIsoDateLocal } from "./presets";
import styles from "./DayWithTimePicker.module.css";

// ═══════════════════════════════════════════════════════════════
//  DayWithTimePicker · L3-style · v3 inline
//  ─────────────────────────────────────────────────────────────
//  v3 · ahora inline en 1 fila. Diseñado para vivir DENTRO de un
//  <FilterFieldGroup label="Período">. El componente NO tiene
//  border externo · queda flat para integrarse con el filter bar.
//
//  Visual (1 fila):
//   [‹] [📅 30/04/2026] [›] [Hoy] [Ayer] [⏰ Todo el día ▾]
//
//  Presets de hora (igual que v2):
//   · Todo el día        00:00-24:00 (default)
//   · Hora laboral       08:00-18:00
//   · Mañana             06:00-12:00
//   · Tarde              12:00-18:00
//   · Noche              18:00-24:00
//   · Custom...          → 2 selects nativos pasos 30min
// ═══════════════════════════════════════════════════════════════

export interface DayWithTimeValue {
  day: string; // YYYY-MM-DD
  fromTime: string; // HH:MM
  toTime: string; // HH:MM
}

interface Props {
  value: DayWithTimeValue;
  onChange: (next: DayWithTimeValue) => void;
  today?: Date;
  tzOffsetHours?: number;
  disabled?: boolean;
}

interface TimePreset {
  key: string;
  label: string;
  rangeLabel: string;
  fromTime: string;
  toTime: string;
}

const PRESETS: TimePreset[] = [
  { key: "all", label: "Todo el día", rangeLabel: "00:00 – 24:00", fromTime: "00:00", toTime: "24:00" },
  { key: "work", label: "Hora laboral", rangeLabel: "08:00 – 18:00", fromTime: "08:00", toTime: "18:00" },
  { key: "morning", label: "Mañana", rangeLabel: "06:00 – 12:00", fromTime: "06:00", toTime: "12:00" },
  { key: "afternoon", label: "Tarde", rangeLabel: "12:00 – 18:00", fromTime: "12:00", toTime: "18:00" },
  { key: "night", label: "Noche", rangeLabel: "18:00 – 24:00", fromTime: "18:00", toTime: "24:00" },
];

function detectPreset(fromTime: string, toTime: string): TimePreset | null {
  return (
    PRESETS.find((p) => p.fromTime === fromTime && p.toTime === toTime) ?? null
  );
}

const HOUR_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let h = 0; h < 24; h++) {
    list.push(`${String(h).padStart(2, "0")}:00`);
    list.push(`${String(h).padStart(2, "0")}:30`);
  }
  list.push("24:00");
  return list;
})();

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDay(day: string, delta: number): string {
  const [yStr = "1970", mStr = "01", dStr = "01"] = day.split("-");
  const ms = Date.UTC(
    parseInt(yStr, 10),
    parseInt(mStr, 10) - 1,
    parseInt(dStr, 10),
  );
  const next = new Date(ms + delta * DAY_MS);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DayWithTimePicker({
  value,
  onChange,
  today,
  tzOffsetHours = -3,
  disabled = false,
}: Props) {
  const todayDate = useMemo(() => today ?? new Date(), [today]);
  const todayIso = useMemo(
    () => toIsoDateLocal(todayDate, tzOffsetHours),
    [todayDate, tzOffsetHours],
  );

  const yesterdayIso = useMemo(
    () => computePreset("yesterday", todayDate, tzOffsetHours).from,
    [todayDate, tzOffsetHours],
  );

  const activePreset = detectPreset(value.fromTime, value.toTime);
  const isCustom = activePreset === null;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(isCustom);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  useEffect(() => {
    setShowCustom(activePreset === null);
  }, [activePreset]);

  function setDay(day: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    onChange({ ...value, day });
  }

  function applyPreset(p: TimePreset) {
    onChange({ ...value, fromTime: p.fromTime, toTime: p.toTime });
    setDropdownOpen(false);
    setShowCustom(false);
  }

  function openCustom() {
    setDropdownOpen(false);
    setShowCustom(true);
    if (!isCustom) {
      onChange({ ...value, fromTime: "08:00", toTime: "18:00" });
    }
  }

  function setFromTime(t: string) {
    const safeFrom = t >= value.toTime ? value.toTime : t;
    onChange({ ...value, fromTime: safeFrom });
  }

  function setToTime(t: string) {
    const safeTo = t <= value.fromTime ? value.fromTime : t;
    onChange({ ...value, toTime: safeTo });
  }

  const triggerLabel = activePreset
    ? activePreset.label
    : `${value.fromTime} – ${value.toTime}`;

  return (
    <div className={styles.wrap} aria-disabled={disabled} ref={wrapRef}>
      {/* ── Día con flechas + atajos ───────────────────────── */}
      <button
        type="button"
        className={styles.arrow}
        onClick={() => setDay(shiftDay(value.day, -1))}
        disabled={disabled}
        aria-label="Día anterior"
      >
        <ChevronLeft size={14} />
      </button>

      <div className={styles.dateGroup}>
        <Calendar size={12} className={styles.icon} aria-hidden="true" />
        <input
          type="date"
          className={styles.dateInput}
          value={value.day}
          onChange={(e) => setDay(e.target.value)}
          disabled={disabled}
          aria-label="Fecha"
        />
      </div>

      <button
        type="button"
        className={styles.arrow}
        onClick={() => setDay(shiftDay(value.day, 1))}
        disabled={disabled}
        aria-label="Día siguiente"
      >
        <ChevronRight size={14} />
      </button>

      <button
        type="button"
        className={`${styles.preset} ${value.day === todayIso ? styles.presetActive : ""}`}
        onClick={() => setDay(todayIso)}
        disabled={disabled}
      >
        Hoy
      </button>
      <button
        type="button"
        className={`${styles.preset} ${value.day === yesterdayIso ? styles.presetActive : ""}`}
        onClick={() => setDay(yesterdayIso)}
        disabled={disabled}
      >
        Ayer
      </button>

      <span className={styles.sep} aria-hidden="true" />

      {/* ── Hora · trigger del dropdown ────────────────────── */}
      <div className={styles.timeTriggerWrap}>
        <button
          type="button"
          className={styles.timeTrigger}
          onClick={() => setDropdownOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <Clock size={12} className={styles.icon} aria-hidden="true" />
          <span className={styles.timeTriggerLabel}>{triggerLabel}</span>
          <ChevronDown size={12} />
        </button>

        {dropdownOpen && (
          <div className={styles.dropdown} role="listbox">
            {PRESETS.map((p) => {
              const active = activePreset?.key === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${styles.option} ${active ? styles.optionActive : ""}`}
                  onClick={() => applyPreset(p)}
                >
                  <span className={styles.optionLabel}>{p.label}</span>
                  <span className={styles.optionSub}>{p.rangeLabel}</span>
                </button>
              );
            })}
            <div className={styles.divider} />
            <button
              type="button"
              className={`${styles.option} ${isCustom ? styles.optionActive : ""}`}
              onClick={openCustom}
            >
              <span className={styles.optionLabel}>Custom...</span>
              <span className={styles.optionSub}>Rango personalizado</span>
            </button>
          </div>
        )}
      </div>

      {/* Custom inputs · solo cuando está activo */}
      {showCustom && (
        <div className={styles.customInputs}>
          <select
            className={styles.timeSelect}
            value={value.fromTime}
            onChange={(e) => setFromTime(e.target.value)}
            disabled={disabled}
            aria-label="Hora desde"
          >
            {HOUR_OPTIONS.filter((h) => h !== "24:00").map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className={styles.timeSep}>–</span>
          <select
            className={styles.timeSelect}
            value={value.toTime}
            onChange={(e) => setToTime(e.target.value)}
            disabled={disabled}
            aria-label="Hora hasta"
          >
            {HOUR_OPTIONS.filter((h) => h !== "00:00").map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
