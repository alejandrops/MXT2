"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, BarChart3 } from "lucide-react";
import {
  METRIC_LABELS,
  type ActivityMetric,
} from "@/lib/queries/activity";
import styles from "./MetricSelector.module.css";

interface Props {
  value: ActivityMetric;
  onChange: (next: ActivityMetric) => void;
}

const ORDER: ActivityMetric[] = [
  "distanceKm",
  "activeMin",
  "idleMin",
  "tripCount",
  "fuelLiters",
  "eventCount",
  "highEventCount",
  "speedingCount",
  "maxSpeedKmh",
];

export function MetricSelector({ value, onChange }: Props) {
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

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <BarChart3 size={12} />
        <span className={styles.triggerLabel}>{METRIC_LABELS[value]}</span>
        <ChevronDown size={11} className={styles.triggerChev} />
      </button>
      {open && (
        <div className={styles.menu} role="listbox">
          {ORDER.map((m) => (
            <button
              key={m}
              type="button"
              role="option"
              aria-selected={value === m}
              className={`${styles.option} ${
                value === m ? styles.optionActive : ""
              }`}
              onClick={() => {
                onChange(m);
                setOpen(false);
              }}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
