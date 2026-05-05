"use client";

import type { InfractionSeverityFilter } from "@/lib/queries/infractions-list";
import styles from "./InfractionSeverityFilter.module.css";

// ═══════════════════════════════════════════════════════════════
//  InfractionSeverityFilter · S4-L3c
//  ─────────────────────────────────────────────────────────────
//  Multi-select inline de severidades de infracción · 3 valores.
//  Mismo patrón visual que SeverityFilter de eventos.
//
//  Códigos cromáticos (alineados con RecentInfractionCard):
//    LEVE  · ámbar suave
//    MEDIA · ámbar fuerte
//    GRAVE · rojo
// ═══════════════════════════════════════════════════════════════

const SEVERITIES: {
  key: InfractionSeverityFilter;
  label: string;
  color: string;
}[] = [
  { key: "LEVE", label: "Leve", color: "#f59e0b" },
  { key: "MEDIA", label: "Media", color: "#ea580c" },
  { key: "GRAVE", label: "Grave", color: "#dc2626" },
];

interface Props {
  selected: InfractionSeverityFilter[];
  onChange: (next: InfractionSeverityFilter[]) => void;
}

export function InfractionSeverityFilterChips({ selected, onChange }: Props) {
  const set = new Set(selected);

  function toggle(s: InfractionSeverityFilter) {
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
              active ? { borderColor: s.color, color: s.color } : undefined
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
