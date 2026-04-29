"use client";

import { Grid3X3, BarChart3, LineChart } from "lucide-react";
import styles from "./ViewToggle.module.css";

// ═══════════════════════════════════════════════════════════════
//  ViewToggle · selector de visualización · módulo Análisis
//  ─────────────────────────────────────────────────────────────
//  Solo vistas operativas · responden "cómo se distribuyó la
//  actividad de mi flota":
//    · heatmap   · matriz vehículos × tiempo (default)
//    · ranking   · barras horizontales ordenadas
//    · multiples · small multiples · scan de N vehículos a la vez
//
//  Las vistas analíticas (scatter, slope, box) se movieron a
//  /direccion · son lectura ejecutiva, no operativa.
// ═══════════════════════════════════════════════════════════════

export type AnalysisView = "heatmap" | "ranking" | "multiples";

const VIEWS: {
  key: AnalysisView;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  enabled: boolean;
  hint: string;
}[] = [
  {
    key: "heatmap",
    label: "Heatmap",
    Icon: Grid3X3,
    enabled: true,
    hint: "Matriz vehículos × tiempo",
  },
  {
    key: "ranking",
    label: "Ranking",
    Icon: BarChart3,
    enabled: true,
    hint: "Barras ordenadas con promedio",
  },
  {
    key: "multiples",
    label: "Small multiples",
    Icon: LineChart,
    enabled: true,
    hint: "Mini-líneas por vehículo",
  },
];

interface Props {
  value: AnalysisView;
  onChange: (next: AnalysisView) => void;
}

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div className={styles.wrap} role="tablist">
      {VIEWS.map((v) => {
        const active = v.key === value;
        return (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={!v.enabled}
            className={`${styles.btn} ${active ? styles.btnActive : ""}`}
            onClick={() => v.enabled && onChange(v.key)}
            title={v.hint}
          >
            <v.Icon size={13} />
            <span>{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
