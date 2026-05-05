"use client";

import type { Severity } from "@/types/domain";
import styles from "./SeverityFilter.module.css";

// ═══════════════════════════════════════════════════════════════
//  SeverityFilter · S4-L2 · multi-select inline de severidades
//  ─────────────────────────────────────────────────────────────
//  Solo 4 valores · render como chips toggleables.
// ═══════════════════════════════════════════════════════════════

const SEVERITIES: { key: Severity; label: string; color: string }[] = [
  { key: "LOW", label: "Baja", color: "#64748b" },
  { key: "MEDIUM", label: "Media", color: "#f59e0b" },
  { key: "HIGH", label: "Alta", color: "#ea580c" },
  { key: "CRITICAL", label: "Crítica", color: "#dc2626" },
];

interface Props {
  selected: Severity[];
  onChange: (next: Severity[]) => void;
}

export function SeverityFilter({ selected, onChange }: Props) {
  const set = new Set(selected);

  function toggle(s: Severity) {
    if (set.has(s)) {
      onChange(selected.filter((x) => x !== s));
    } else {
      onChange([...selected, s]);
    }
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Severidad</span>
      {SEVERITIES.map((s) => {
        const active = set.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            className={`${styles.chip} ${active ? styles.chipActive : ""}`}
            style={
              active
                ? { borderColor: s.color, color: s.color }
                : undefined
            }
            onClick={() => toggle(s.key)}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
